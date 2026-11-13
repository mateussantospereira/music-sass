import { Hono } from "hono";
import type { Context } from "hono";
import { and, asc, count, eq, desc, inArray, isNotNull, max } from "drizzle-orm";
import { db } from "../db";
import { compartilhamentos, playlistMusicas, playlists, musicas, usuarios } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { registrar, ipDe } from "../services/log-service";
import type { Env } from "../types";
import type { Papel } from "../services/auth-service";

const recursos = new Hono<Env>();
recursos.use("/*", authMiddleware);

function ehAdmin(role: Papel): boolean {
  return role === "admin";
}

/** Playlists que alguém liberou para `usuarioId` (qualquer tipo de dono). */
async function idsPlaylistsCompartilhadasCom(usuarioId: number): Promise<number[]> {
  const linhas = await db
    .select({ id: compartilhamentos.playlistId })
    .from(compartilhamentos)
    .where(and(eq(compartilhamentos.usuarioId, usuarioId), isNotNull(compartilhamentos.playlistId)));
  return linhas.map((l) => Number(l.id)).filter(Number.isInteger);
}

async function carregarPlaylist(id: number) {
  if (!Number.isInteger(id)) return null;
  const [linha] = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
  return linha ?? null;
}

async function podeLerPlaylist(
  playlist: typeof playlists.$inferSelect,
  usuarioId: number,
  role: Papel
): Promise<boolean> {
  if (ehAdmin(role) || playlist.usuarioId === usuarioId) return true;
  const ids = await idsPlaylistsCompartilhadasCom(usuarioId);
  return ids.includes(playlist.id);
}

function ehDono(
  playlist: typeof playlists.$inferSelect,
  usuarioId: number,
  role: Papel
): boolean {
  return ehAdmin(role) || playlist.usuarioId === usuarioId;
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

async function resumoPlaylist(p: typeof playlists.$inferSelect, donoNome?: string | null) {
  const [linha] = await db
    .select({ total: count() })
    .from(playlistMusicas)
    .where(eq(playlistMusicas.playlistId, p.id));
  return {
    id: p.id,
    usuarioId: p.usuarioId,
    donoNome: donoNome ?? undefined,
    nome: p.nome,
    descricao: p.descricao,
    totalMusicas: Number(linha?.total ?? 0),
    criadoEm: p.criadoEm,
    atualizadoEm: p.atualizadoEm,
  };
}

/** GET /api/playlists — minhas (admin: todas) + as compartilhadas comigo. */
recursos.get("/", async (c) => {
  const usuarioId = c.get("usuarioId");
  const role = c.get("role");

  const proprias = ehAdmin(role)
    ? await db.select().from(playlists).orderBy(desc(playlists.criadoEm))
    : await db
        .select()
        .from(playlists)
        .where(eq(playlists.usuarioId, usuarioId))
        .orderBy(desc(playlists.criadoEm));

  const idsCompartilhadas = ehAdmin(role) ? [] : await idsPlaylistsCompartilhadasCom(usuarioId);
  const compartilhadas = idsCompartilhadas.length
    ? await db.select().from(playlists).where(inArray(playlists.id, idsCompartilhadas))
    : [];

  const donos = new Map<number, string>();
  const idsDonos = [...new Set([...proprias, ...compartilhadas].map((p) => p.usuarioId))];
  if (idsDonos.length) {
    const linhasDonos = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(inArray(usuarios.id, idsDonos));
    for (const dono of linhasDonos) donos.set(dono.id, dono.nome);
  }

  const todas = [
    ...proprias.map((p) => ({ ...p, compartilhadaComigo: false })),
    ...compartilhadas
      .filter((p) => !proprias.some((x) => x.id === p.id))
      .map((p) => ({ ...p, compartilhadaComigo: true })),
  ];

  const resposta = await Promise.all(
    todas.map(async (p) => ({
      ...(await resumoPlaylist(p, donos.get(p.usuarioId))),
      compartilhadaComigo: p.compartilhadaComigo,
    }))
  );

  return c.json({ playlists: resposta, total: resposta.length });
});

/** GET /api/playlists/:id — detalhe + faixas. */
recursos.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);

  if (!(await podeLerPlaylist(playlist, c.get("usuarioId"), c.get("role")))) {
    return recusaAcesso(c, "Esta playlist não está disponível para você.");
  }

  const donos = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(inArray(usuarios.id, [playlist.usuarioId]));

  const faixas = await db
    .select({
      id: musicas.id,
      usuarioId: musicas.usuarioId,
      titulo: musicas.titulo,
      artista: musicas.artista,
      duracaoSeg: musicas.duracaoSeg,
      status: musicas.status,
      temAudio: musicas.chaveAudio,
      ordem: playlistMusicas.ordem,
    })
    .from(playlistMusicas)
    .innerJoin(musicas, eq(musicas.id, playlistMusicas.musicaId))
    .where(eq(playlistMusicas.playlistId, id))
    .orderBy(asc(playlistMusicas.ordem), asc(playlistMusicas.adicionadaEm));

  const [dono] = donos;
  const detalhe = await resumoPlaylist(playlist, dono?.nome);

  const shares = ehDono(playlist, c.get("usuarioId"), c.get("role"))
    ? await db
        .select({
          id: compartilhamentos.id,
          usuarioId: compartilhamentos.usuarioId,
          nome: usuarios.nome,
          email: usuarios.email,
          criadoEm: compartilhamentos.criadoEm,
        })
        .from(compartilhamentos)
        .innerJoin(usuarios, eq(usuarios.id, compartilhamentos.usuarioId))
        .where(eq(compartilhamentos.playlistId, id))
    : [];

  return c.json({
    ...detalhe,
    musicas: faixas.map((f) => ({
      ...f,
      temAudio: Boolean(f.temAudio),
    })),
    compartilhamentos: shares,
  });
});

/** POST /api/playlists — cria (qualquer papel com gerenciar:playlist). */
recursos.post("/", exigePermissao("gerenciar:playlist"), async (c) => {
  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(corpo.nome ?? "").trim().slice(0, 120);
  const descricao = String(corpo.descricao ?? "").trim().slice(0, 500) || null;

  if (!nome) return c.json({ error: "Dê um nome para a playlist." }, 400);

  const resultado = await db.insert(playlists).values({
    usuarioId: c.get("usuarioId"),
    nome,
    descricao,
  });
  const id = Number((resultado as unknown as [{ insertId: number }])[0].insertId);

  await registrar({
    acao: "playlist_criada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: nome,
    ip: ipDe(c),
  });

  const criada = await carregarPlaylist(id);
  return c.json(await resumoPlaylist(criada!), 201);
});

/** PATCH /api/playlists/:id — renomeia/edita descrição (dono/admin). */
recursos.patch("/:id", exigePermissao("gerenciar:playlist"), async (c) => {
  const id = Number(c.req.param("id"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode editar esta playlist.");
  }

  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = corpo.nome !== undefined ? String(corpo.nome).trim().slice(0, 120) : undefined;
  const descricao =
    corpo.descricao !== undefined ? String(corpo.descricao).trim().slice(0, 500) : undefined;

  if (nome === "") return c.json({ error: "O nome não pode ficar vazio." }, 400);

  await db
    .update(playlists)
    .set({
      ...(nome !== undefined ? { nome } : {}),
      ...(descricao !== undefined ? { descricao: descricao || null } : {}),
    })
    .where(eq(playlists.id, id));

  await registrar({
    acao: "playlist_editada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: nome ?? playlist.nome,
    ip: ipDe(c),
  });

  const atualizada = await carregarPlaylist(id);
  return c.json(await resumoPlaylist(atualizada!));
});

/** DELETE /api/playlists/:id — apaga a playlist (dono/admin). */
recursos.delete("/:id", exigePermissao("gerenciar:playlist"), async (c) => {
  const id = Number(c.req.param("id"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode apagar esta playlist.");
  }

  await db.delete(playlists).where(eq(playlists.id, id));

  await registrar({
    acao: "playlist_removida",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: playlist.nome,
    ip: ipDe(c),
  });

  return c.json({ message: "Playlist removida.", id });
});

/** POST /api/playlists/:id/musicas — adiciona uma faixa (dono/admin). */
recursos.post("/:id/musicas", exigePermissao("gerenciar:playlist"), async (c) => {
  const id = Number(c.req.param("id"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode alterar esta playlist.");
  }

  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const musicaId = Number(corpo.musicaId);
  if (!Number.isInteger(musicaId)) return c.json({ error: "musicaId inválido." }, 400);

  const [musica] = await db.select().from(musicas).where(eq(musicas.id, musicaId)).limit(1);
  if (!musica) return c.json({ error: "Música não encontrada." }, 404);

  // O dono só adiciona o que ele pode ouvir (dele ou compartilhada com ele).
  if (!ehAdmin(c.get("role")) && musica.usuarioId !== c.get("usuarioId")) {
    const usuarioId = c.get("usuarioId");
    const direto = await db
      .select({ id: compartilhamentos.musicaId })
      .from(compartilhamentos)
      .where(and(eq(compartilhamentos.usuarioId, usuarioId), eq(compartilhamentos.musicaId, musicaId)));
    const viaPlaylist = await db
      .select({ id: playlistMusicas.musicaId })
      .from(compartilhamentos)
      .innerJoin(
        playlistMusicas,
        eq(playlistMusicas.playlistId, compartilhamentos.playlistId)
      )
      .where(and(eq(compartilhamentos.usuarioId, usuarioId), eq(playlistMusicas.musicaId, musicaId)));
    if (!direto.length && !viaPlaylist.length) {
      return recusaAcesso(c, "Você só adiciona músicas que pode ouvir.");
    }
  }

  const [linha] = await db
    .select({ maior: max(playlistMusicas.ordem) })
    .from(playlistMusicas)
    .where(eq(playlistMusicas.playlistId, id));
  const ordem = Number(linha?.maior ?? 0) + 1;

  try {
    await db.insert(playlistMusicas).values({ playlistId: id, musicaId, ordem });
  } catch {
    return c.json({ message: "Esta música já está na playlist." });
  }

  await registrar({
    acao: "playlist_musica_adicionada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: `musica:${musicaId}`,
    ip: ipDe(c),
  });

  const atualizada = await carregarPlaylist(id);
  return c.json(await resumoPlaylist(atualizada!));
});

/** DELETE /api/playlists/:id/musicas/:musicaId — remove a faixa (dono/admin). */
recursos.delete("/:id/musicas/:musicaId", exigePermissao("gerenciar:playlist"), async (c) => {
  const id = Number(c.req.param("id"));
  const musicaId = Number(c.req.param("musicaId"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode alterar esta playlist.");
  }

  await db
    .delete(playlistMusicas)
    .where(and(eq(playlistMusicas.playlistId, id), eq(playlistMusicas.musicaId, musicaId)));

  await registrar({
    acao: "playlist_musica_removida",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: `musica:${musicaId}`,
    ip: ipDe(c),
  });

  return c.json({ message: "Removida da playlist." });
});

/** POST /api/playlists/:id/compartilhar — libera para um ouvinte. */
recursos.post("/:id/compartilhar", exigePermissao("compartilhar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode compartilhar esta playlist.");
  }

  const corpo = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const alvoId = Number(corpo.usuarioId);
  if (!Number.isInteger(alvoId)) return c.json({ error: "usuarioId inválido." }, 400);

  const [alvo] = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.id, alvoId))
    .limit(1);
  if (!alvo) return c.json({ error: "Usuário não encontrado." }, 404);

  try {
    await db.insert(compartilhamentos).values({
      usuarioId: alvoId,
      playlistId: id,
      concedidoPor: c.get("usuarioId"),
    });
  } catch {
    return c.json({ message: "Esta playlist já estava compartilhada com este usuário." });
  }

  await registrar({
    acao: "playlist_compartilhada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: `para ${alvo.nome}`,
    ip: ipDe(c),
  });

  return c.json({ message: `Playlist compartilhada com ${alvo.nome}.` });
});

/** DELETE /api/playlists/:id/compartilhar/:usuarioId — revoga o acesso. */
recursos.delete("/:id/compartilhar/:usuarioId", exigePermissao("compartilhar:musica"), async (c) => {
  const id = Number(c.req.param("id"));
  const alvoId = Number(c.req.param("usuarioId"));
  const playlist = await carregarPlaylist(id);
  if (!playlist) return c.json({ error: "Playlist não encontrada" }, 404);
  if (!ehDono(playlist, c.get("usuarioId"), c.get("role"))) {
    return recusaAcesso(c, "Só o dono pode revogar o acesso desta playlist.");
  }

  await db
    .delete(compartilhamentos)
    .where(and(eq(compartilhamentos.usuarioId, alvoId), eq(compartilhamentos.playlistId, id)));

  await registrar({
    acao: "playlist_descompartilhada",
    usuario_id: c.get("usuarioId"),
    usuario: c.get("nome"),
    papel: c.get("role"),
    recurso: `playlist:${id}`,
    detalhe: `removida de usuario:${alvoId}`,
    ip: ipDe(c),
  });

  return c.json({ message: "Compartilhamento removido." });
});

export default recursos;
