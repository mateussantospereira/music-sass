import { Hono } from "hono";
import type { Context } from "hono";
import { and, count, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db } from "../db";
import { compartilhamentos, playlistMusicas, musicas, usuarios } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { registrar, ipDe } from "../services/log-service";
import { sessao } from "../services/auth-service";
import {
  baixarAudio,
  baixarCapa,
  extrairMetadados,
  validarUrlYouTube,
} from "../services/youtube";
import {
  enviarAudio,
  enviarCapa,
  obterObjeto,
  removerObjeto,
} from "../services/minio";
import { LIMITE_MUSICAS_GRATIS } from "../services/plano";
import type { Env } from "../types";
import type { Papel } from "../services/auth-service";

const recursos = new Hono<Env>();

function ehAdmin(role: Papel): boolean {
  return role === "admin";
}

/**
 * Middleware das rotas de stream: aceita o token pelo header (fetch) OU pela
 * query `?token=`, porque uma tag <audio> não envia header.
 * A query só é lida AQUI, nunca nas demais rotas.
 */
const streamAuth = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header("Authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer ?? c.req.query("token") ?? null;

  if (!token) {
    return c.json({ error: "Token ausente" }, 401);
  }

  const resultado = await sessao(token);
  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as 401 | 503);
  }

  c.set("usuarioId", resultado.dados.usuarioId);
  c.set("role", resultado.dados.role);
  c.set("nome", resultado.dados.nome);
  c.set("email", resultado.dados.email);
  c.set("premium", Boolean(resultado.dados.premium));
  c.set("permissoes", resultado.dados.permissoes ?? []);

  await next();
});

/**
 * IDs das músicas que alguém liberou para `usuarioId`.
 * Direto (`compartilhamentos.musica_id`) ou via playlist compartilhada.
 */
async function idsCompartilhadosCom(usuarioId: number): Promise<number[]> {
  const diretos = await db
    .select({ id: compartilhamentos.musicaId })
    .from(compartilhamentos)
    .where(and(eq(compartilhamentos.usuarioId, usuarioId), isNotNull(compartilhamentos.musicaId)));

  const viaPlaylist = await db
    .select({ id: playlistMusicas.musicaId })
    .from(compartilhamentos)
    .innerJoin(
      playlistMusicas,
      eq(playlistMusicas.playlistId, compartilhamentos.playlistId)
    )
    .where(eq(compartilhamentos.usuarioId, usuarioId));

  return [...new Set([...diretos, ...viaPlaylist].map((l) => Number(l.id)).filter(Number.isInteger))];
}

/** Regra de leitura: admin, dono, ou alguém liberou explicitamente. */
async function podeLer(
  musica: typeof musicas.$inferSelect,
  usuarioId: number,
  role: Papel
): Promise<boolean> {
  if (ehAdmin(role) || musica.usuarioId === usuarioId) return true;
  const ids = await idsCompartilhadosCom(usuarioId);
  return ids.includes(musica.id);
}

function podeEditarOuApagar(
  musica: typeof musicas.$inferSelect,
  usuarioId: number,
  role: Papel
): boolean {
  return ehAdmin(role) || musica.usuarioId === usuarioId;
}

async function carregarMusica(id: number) {
  if (!Number.isInteger(id)) return null;
  const [linha] = await db.select().from(musicas).where(eq(musicas.id, id)).limit(1);
  return linha ?? null;
}

function recusaAcesso(c: Context<Env>, motivo: string) {
  return c.json(
    {
      error: motivo,
      permissao_exigida: "ler:musica",
      papel: c.get("role"),
      sua_conta: c.get("usuarioId"),
    },
    403
  );
}

function resumo(musica: typeof musicas.$inferSelect, donoNome?: string | null) {
  return {
    id: musica.id,
    usuarioId: musica.usuarioId,
    donoNome: donoNome ?? undefined,
    titulo: musica.titulo,
    artista: musica.artista,
    origemUrl: musica.origemUrl,
    duracaoSeg: musica.duracaoSeg,
    status: musica.status,
    temAudio: Boolean(musica.chaveAudio),
    temCapa: Boolean(musica.chaveCapa),
    contentType: musica.contentType,
    tamanho: musica.tamanho,
    erroMsg: musica.erroMsg,
    criadoEm: musica.criadoEm,
    atualizadoEm: musica.atualizadoEm,
  };
}

/**
 * Processa a extração em background. O registro já existe com
 * status='processando'; aqui ele vira 'pronta' ou 'erro'.
 */
async function processarExtracao(musicaId: number, url: string, usuarioId: number, origem: Context<Env>) {
  try {
    const info = await extrairMetadados(url);
    await db
      .update(musicas)
      .set({
        titulo: info.titulo,
        artista: info.artista,
        duracaoSeg: info.duracaoSeg,
      })
      .where(eq(musicas.id, musicaId));

    const audio = await baixarAudio(url);
    const chave = await enviarAudio(usuarioId, musicaId, audio.fileName, audio.bytes, audio.ext);

    let chaveCapa: string | undefined;
    if (info.thumbnail) {
      const capa = await baixarCapa(info.thumbnail);
      if (capa) {
        chaveCapa = await enviarCapa(usuarioId, musicaId, capa.bytes, capa.contentType, capa.ext);
      }
    }

    await db
      .update(musicas)
      .set({
        status: "pronta",
        chaveAudio: chave,
        chaveCapa: chaveCapa ?? null,
        contentType: "audio/mp4",
        tamanho: audio.bytes.length,
        erroMsg: null,
      })
      .where(eq(musicas.id, musicaId));

    await registrar({
      acao: "musica_pronta",
      usuario_id: usuarioId,
      usuario: null,
      papel: null,
      recurso: `musica:${musicaId}`,
      detalhe: `Extração concluída · ${info.titulo}`,
      ip: ipDe(origem as never),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[musicas] extração de ${musicaId} falhou: ${motivo}`);
    await db
      .update(musicas)
      .set({ status: "erro", erroMsg: motivo.slice(0, 500) })
      .where(eq(musicas.id, musicaId));

    await registrar({
      acao: "extracao_falhou",
      usuario_id: usuarioId,
      recurso: `musica:${musicaId}`,
      detalhe: motivo.slice(0, 500),
      ip: null,
    });
  }
}

/* ---------------------------------- rotas --------------------------------- */

/** GET /api/musicas/compartilhaveis — ouvintes que podem receber o acesso. */
recursos.get("/compartilhaveis", authMiddleware, exigePermissao("compartilhar:musica"), async (c) => {
  const ouvintes = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.role, "ouvinte"))
    .orderBy(usuarios.nome);
  return c.json({ usuarios: ouvintes });
});

/** GET /api/musicas — admin: tudo; curador: suas; ouvinte: compartilhadas. */
recursos.get("/", authMiddleware, exigePermissao("ler:musica"), async (c) => {
  const usuarioId = c.get("usuarioId");
  const role = c.get("role");

  let linhas: Array<typeof musicas.$inferSelect & { donoNome?: string | null }> = [];

  if (ehAdmin(role)) {
    linhas = await db
      .select({
        id: musicas.id, usuarioId: musicas.usuarioId, titulo: musicas.titulo,
        artista: musicas.artista, origemUrl: musicas.origemUrl, duracaoSeg: musicas.duracaoSeg,
        status: musicas.status, chaveAudio: musicas.chaveAudio, chaveCapa: musicas.chaveCapa,
        contentType: musicas.contentType, tamanho: musicas.tamanho, erroMsg: musicas.erroMsg,
        criadoEm: musicas.criadoEm, atualizadoEm: musicas.atualizadoEm,
        donoNome: usuarios.nome,
      })
      .from(musicas)
      .innerJoin(usuarios, eq(musicas.usuarioId, usuarios.id))
      .orderBy(desc(musicas.criadoEm));
  } else if (role === "curador") {
    linhas = await db
      .select()
      .from(musicas)
      .where(eq(musicas.usuarioId, usuarioId))
      .orderBy(desc(musicas.criadoEm));
  } else {
    const ids = await idsCompartilhadosCom(usuarioId);
    const filtro = ids.length
      ? or(eq(musicas.usuarioId, usuarioId), inArray(musicas.id, ids))
      : eq(musicas.usuarioId, usuarioId);
    linhas = await db.select().from(musicas).where(filtro).orderBy(desc(musicas.criadoEm));
  }

  return c.json({ musicas: linhas.map((l) => resumo(l)), total: linhas.length });
});

/** GET /api/musicas/:id — detalhe + compartilhamentos (se dono/admin). */
recursos.get("/:id", authMiddleware, exigePermissao("ler:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);

  if (!(await podeLer(musica, c.get("usuarioId"), c.get("role")))) {
    return recusaAcesso(c, "Esta música não está na sua biblioteca.");
  }

  const [dono] = await db
    .select({ nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.id, musica.usuarioId))
    .limit(1);

  const detalhe = resumo(musica, dono?.nome);

  if (ehAdmin(c.get("role")) || musica.usuarioId === c.get("usuarioId")) {
    const shares = await db
      .select({
        id: compartilhamentos.id,
        usuarioId: compartilhamentos.usuarioId,
        nome: usuarios.nome,
        email: usuarios.email,
        criadoEm: compartilhamentos.criadoEm,
      })
      .from(compartilhamentos)
      .innerJoin(usuarios, eq(compartilhamentos.usuarioId, usuarios.id))
      .where(eq(compartilhamentos.musicaId, id));
    return c.json({ ...detalhe, compartilhamentos: shares });
  }

  return c.json(detalhe);
});

/** POST /api/musicas — adiciona pela URL do YouTube. */
recursos.post("/", authMiddleware, exigePermissao("criar:musica"), async (c) => {
  const usuarioId = c.get("usuarioId");
  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  // Limite do plano gratuito, para quem não é Pro.
  if (!c.get("premium")) {
    const [linha] = await db.select({ total: count() }).from(musicas).where(eq(musicas.usuarioId, usuarioId));
    if (Number(linha?.total ?? 0) >= LIMITE_MUSICAS_GRATIS) {
      return c.json(
        { error: `O plano gratuito permite até ${LIMITE_MUSICAS_GRATIS} músicas. Assine o Pro para adicionar sem limite.`, limite: LIMITE_MUSICAS_GRATIS },
        402
      );
    }
  }

  const validada = validarUrlYouTube(corpo.url);
  if (!validada) {
    return c.json({ error: "URL inválida. Cole um link do YouTube (youtube.com/watch, youtu.be ou Shorts)." }, 400);
  }

  const resultado = await db.insert(musicas).values({
    usuarioId,
    titulo: "Extraindo…",
    status: "processando",
    origemUrl: validada.url,
  });
  const musicaId = Number((resultado as unknown as [{ insertId: number }])[0].insertId);

  await registrar({
    acao: "musica_adicionada",
    usuario_id: usuarioId,
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${musicaId}`,
    detalhe: validada.url,
    ip: ipDe(c),
  });

  // Extração assíncrona: responde já, o status acompanha pelo GET /:id.
  processarExtracao(musicaId, validada.url, usuarioId, c).catch((erro) =>
    console.error("[musicas] worker de extração falhou:", erro)
  );

  return c.json({ id: musicaId, status: "processando", titulo: "Extraindo…" }, 201);
});

/** POST /api/musicas/:id/reprocessar — tenta de novo uma faixa que falhou. */
recursos.post("/:id/reprocessar", authMiddleware, exigePermissao("editar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!podeEditarOuApagar(musica, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode reprocessar esta música.");
  }
  if (!musica.origemUrl) {
    return c.json({ error: "Esta faixa não tem URL de origem para reprocessar." }, 400);
  }

  await db.update(musicas).set({ status: "processando", erroMsg: null }).where(eq(musicas.id, id));
  processarExtracao(id, musica.origemUrl, musica.usuarioId, c).catch((erro) =>
    console.error("[musicas] worker de reprocesso falhou:", erro)
  );

  return c.json({ id, status: "processando" });
});

/** PATCH /api/musicas/:id — edita título/artista. */
recursos.patch("/:id", authMiddleware, exigePermissao("editar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!podeEditarOuApagar(musica, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode editar esta música.");
  }

  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = corpo.titulo !== undefined ? String(corpo.titulo).trim().slice(0, 200) : undefined;
  const artista = corpo.artista !== undefined ? String(corpo.artista).trim().slice(0, 200) : undefined;

  if (titulo === "") return c.json({ error: "O título não pode ficar vazio." }, 400);

  await db
    .update(musicas)
    .set({
      ...(titulo !== undefined ? { titulo } : {}),
      ...(artista !== undefined ? { artista: artista || null } : {}),
    })
    .where(eq(musicas.id, id));

  await registrar({
    acao: "musica_editada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${id}`,
    detalhe: `${titulo ?? musica.titulo}`,
    ip: ipDe(c),
  });

  const atualizada = await carregarMusica(id);
  return c.json(resumo(atualizada!));
});

/** DELETE /api/musicas/:id — apaga a faixa, a capa, as relações e os compartilhamentos. */
recursos.delete("/:id", authMiddleware, exigePermissao("apagar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!podeEditarOuApagar(musica, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode apagar esta música.");
  }

  await removerObjeto(musica.chaveAudio);
  await removerObjeto(musica.chaveCapa);
  await db.delete(musicas).where(eq(musicas.id, id));

  await registrar({
    acao: "musica_removida",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${id}`,
    detalhe: musica.titulo,
    ip: ipDe(c),
  });

  return c.json({ message: "Música removida", id });
});

/** GET /api/musicas/:id/stream — tocar no navegador. */
recursos.get("/:id/stream", streamAuth, async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!(await podeLer(musica, c.get("usuarioId"), c.get("role")))) {
    return recusaAcesso(c, "Esta música não está na sua biblioteca.");
  }
  if (!musica.chaveAudio) {
    return c.json({ error: "O áudio ainda está sendo extraído. Tente em instantes.", status: musica.status }, 409);
  }

  const objeto = await obterObjeto(musica.chaveAudio);
  if (!objeto) return c.json({ error: "Arquivo de áudio não encontrado no armazenamento." }, 404);

  await registrar({
    acao: "musica_reproduzida",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${id}`,
    detalhe: musica.titulo,
    ip: ipDe(c),
  });

  return new Response(new Uint8Array(objeto.bytes), {
    headers: {
      "Content-Type": musica.contentType ?? objeto.contentType,
      "Content-Length": String(objeto.bytes.length),
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "none",
    },
  });
});

/** GET /api/musicas/:id/capa — capa do álbum (precisa de leitura). */
recursos.get("/:id/capa", streamAuth, async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!(await podeLer(musica, c.get("usuarioId"), c.get("role")))) {
    return recusaAcesso(c, "Esta música não está na sua biblioteca.");
  }
  if (!musica.chaveCapa) return c.json({ error: "Esta faixa não tem capa." }, 404);

  const objeto = await obterObjeto(musica.chaveCapa);
  if (!objeto) return c.json({ error: "Capa não encontrada no armazenamento." }, 404);

  return new Response(new Uint8Array(objeto.bytes), {
    headers: {
      "Content-Type": objeto.contentType,
      "Content-Length": String(objeto.bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
});

/** POST /api/musicas/:id/compartilhar — libera para um ouvinte. */
recursos.post("/:id/compartilhar", authMiddleware, exigePermissao("compartilhar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!podeEditarOuApagar(musica, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode compartilhar esta música.");
  }

  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const alvoId = Number(corpo.usuarioId);
  if (!Number.isInteger(alvoId)) return c.json({ error: "usuarioId inválido." }, 400);

  const [alvo] = await db.select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios).where(eq(usuarios.id, alvoId)).limit(1);
  if (!alvo) return c.json({ error: "Usuário não encontrado." }, 404);
  if (alvoId === c.get("usuarioId")) return c.json({ error: "Você já é o dono desta música." }, 400);

  try {
    await db.insert(compartilhamentos).values({
      usuarioId: alvoId,
      musicaId: id,
      concedidoPor: c.get("usuarioId"),
    });
  } catch {
    // duplicado: idempotente
    return c.json({ message: "Esta música já estava compartilhada com este usuário." });
  }

  await registrar({
    acao: "musica_compartilhada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${id}`,
    detalhe: `para ${alvo.nome}`,
    ip: ipDe(c),
  });

  return c.json({ message: `Compartilhada com ${alvo.nome}.` });
});

/** DELETE /api/musicas/:id/compartilhar/:usuarioId — revoga o acesso. */
recursos.delete("/:id/compartilhar/:usuarioId", authMiddleware, exigePermissao("compartilhar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const alvoId = Number(c.req.param("usuarioId"));
  const musica = await carregarMusica(id);
  if (!musica) return c.json({ error: "Música não encontrada" }, 404);
  if (!podeEditarOuApagar(musica, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode revogar o acesso desta música.");
  }

  await db
    .delete(compartilhamentos)
    .where(and(eq(compartilhamentos.usuarioId, alvoId), eq(compartilhamentos.musicaId, id)));

  await registrar({
    acao: "musica_descompartilhada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `musica:${id}`,
    detalhe: `removida de usuario:${alvoId}`,
    ip: ipDe(c),
  });

  return c.json({ message: "Compartilhamento removido." });
});

export default recursos;
