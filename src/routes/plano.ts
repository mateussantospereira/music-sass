import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import { assinaturas, musicas, stripeEventos, usuarios } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { consultarLogs, registrar, ipDe } from "../services/log-service";
import { definirPremium } from "../services/auth-service";
import {
  stripe,
  stripeConfigurado,
  webhookConfigurado,
  STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  APP_PUBLIC_URL,
} from "../services/stripe";
import { LIMITE_MUSICAS_GRATIS, PRECO_PRO_LABEL } from "../services/plano";
import type { Env } from "../types";

/**
 * Plano Pro — assinatura recorrente no Stripe.
 *
 * O cartão nunca passa pelo backend: o usuário é redirecionado para a página
 * hospedada pelo Stripe e a confirmação chega por webhook assinado, que grava
 * os IDs em `assinaturas` e pede ao auth-service para definir
 * `usuarios.premium`.
 *
 * Quem muda o plano no banco é SEMPRE o webhook — nunca o redirect do
 * checkout. Os quatro eventos relevantes:
 *
 *   checkout.session.completed   → marca a assinatura como ativa e o Pro
 *   customer.subscription.updated → reflete troca de plano, renovação e status
 *   customer.subscription.deleted → assinatura terminada; volta para o Free
 *   invoice.payment_failed       → renovação recusada; marca inadimplente e
 *                                   tira o Pro (não continua de graça)
 *
 * Idempotência: o Stripe reenvia eventos. Antes de processar, o `id` do
 * evento é gravado em `stripe_eventos`; um evento repetido recebe 200 e sai
 * sem efeito duplicado. Se o processamento falhar, o registro é apagado para
 * que a nova tentativa seja aceita.
 */
const plano = new Hono<Env>();

const EVENTO_PAGO = "checkout.session.completed";
const EVENTO_ATUALIZADA = "customer.subscription.updated";
const EVENTO_CANCELADA = "customer.subscription.deleted";
const EVENTO_FALHOU = "invoice.payment_failed";

/** Registra o evento como processado; devolve `true` quando é repetido. */
async function jaProcessado(eventoId: string, tipo: string): Promise<boolean> {
  try {
    await db.insert(stripeEventos).values({ id: eventoId, tipo });
    return false;
  } catch {
    return true;
  }
}

async function desfazerRegistro(eventoId: string): Promise<void> {
  try {
    await db.delete(stripeEventos).where(eq(stripeEventos.id, eventoId));
  } catch {
    // se nem isto funcionar, o Stripe seguirá reenviando — melhor que processar duas vezes
  }
}

/** Webhook público — autenticado pela assinatura HMAC do Stripe. */
plano.post("/webhook", async (c) => {
  if (!webhookConfigurado) {
    return c.json(
      { error: "Webhook do Stripe não configurado. Defina STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET." },
      503
    );
  }

  const assinaturaRecebida = c.req.header("stripe-signature");
  if (!assinaturaRecebida) {
    return c.json({ error: "Cabeçalho stripe-signature ausente." }, 400);
  }

  const corpo = await c.req.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe().webhooks.constructEventAsync(corpo, assinaturaRecebida, STRIPE_WEBHOOK_SECRET);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[plano] webhook recusado (assinatura inválida): ${motivo}`);
    return c.json({ error: "Assinatura do webhook inválida." }, 400);
  }

  // Idempotência: o mesmo evento não roda duas vezes.
  if (await jaProcessado(evento.id, evento.type)) {
    return c.json({ received: true, duplicado: true, id: evento.id });
  }

  try {
    const resultado = await processarEvento(evento, c);
    return resultado;
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[plano] erro ao processar webhook ${evento.type}: ${motivo}`);
    // Apaga o registro para que o Stripe possa reenviar de verdade.
    await desfazerRegistro(evento.id);
    return c.json({ error: "Erro ao processar o webhook." }, 500);
  }
});

/** Efetivamente aplica o efeito de um evento validado. Faz o trabalho e devolve a resposta. */
async function processarEvento(
  evento: Stripe.Event,
  c: { req: { header: (n: string) => string | undefined } }
): Promise<Response> {
  if (evento.type === EVENTO_PAGO) {
    const sessao = evento.data.object as Stripe.Checkout.Session;
    const usuarioId = Number(sessao.client_reference_id ?? sessao.metadata?.usuarioId ?? "");

    if (!Number.isInteger(usuarioId)) {
      console.error(`[plano] ${EVENTO_PAGO} sem usuario_id: sessão ${sessao.id}`);
      return new Response(JSON.stringify({ received: true, ignorado: "sem usuario_id" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const clienteId = typeof sessao.customer === "string" ? sessao.customer : sessao.customer?.id ?? null;
    const assinaturaId =
      typeof sessao.subscription === "string" ? sessao.subscription : sessao.subscription?.id ?? null;

    await db
      .insert(assinaturas)
      .values({
        usuarioId,
        stripeCustomerId: clienteId,
        stripeSubscriptionId: assinaturaId,
        status: "ativa",
        plano: "pro",
      })
      .onDuplicateKeyUpdate({
        set: {
          stripeCustomerId: clienteId,
          stripeSubscriptionId: assinaturaId,
          status: "ativa",
          plano: "pro",
        },
      });

    const sincronizou = await definirPremium(usuarioId, true);

    await registrar({
      acao: "assinatura_pro_ativada",
      usuario_id: usuarioId,
      recurso: "plano:pro",
      detalhe: `Stripe ${sessao.id} · assinatura ${assinaturaId ?? "—"}${
        sincronizou.ok ? "" : " · FALHA ao sincronizar premium"
      }`,
      ip: ipDe(c),
    });

    if (!sincronizou.ok) {
      throw new Error("Falha ao ativar o Pro no auth-service; o Stripe deve reenviar.");
    }

    return json({ received: true, usuarioId, premium: true });
  }

  if (evento.type === EVENTO_ATUALIZADA || evento.type === EVENTO_CANCELADA) {
    const sub = evento.data.object as Stripe.Subscription;
    const [linha] = await db
      .select()
      .from(assinaturas)
      .where(eq(assinaturas.stripeSubscriptionId, sub.id))
      .limit(1);

    if (!linha) {
      return json({ received: true, ignorado: "assinatura desconhecida" });
    }

    const status = evento.type === EVENTO_CANCELADA ? "cancelada" : sub.status;
    const ativo = status === "active" || status === "trialing";

    await db.update(assinaturas).set({ status }).where(eq(assinaturas.usuarioId, linha.usuarioId));
    const sincronizou = await definirPremium(linha.usuarioId, ativo);

    await registrar({
      acao: ativo ? "assinatura_pro_ativada" : "assinatura_pro_cancelada",
      usuario_id: linha.usuarioId,
      recurso: "plano:pro",
      detalhe: `Stripe ${sub.id} · status ${status}`,
      ip: ipDe(c),
    });

    if (!sincronizou.ok) {
      throw new Error("Falha ao sincronizar o Pro no auth-service; o Stripe deve reenviar.");
    }

    return json({ received: true, usuarioId: linha.usuarioId, premium: ativo, status });
  }

  if (evento.type === EVENTO_FALHOU) {
    const fatura = evento.data.object as Stripe.Invoice;
    const assinaturaId =
      typeof (fatura as { subscription?: string | { id: string } | null }).subscription === "string"
        ? ((fatura as { subscription?: string | { id: string } | null }).subscription as string)
        : ((fatura as { subscription?: { id: string } | null }).subscription as { id: string } | null)?.id ?? null;

    const filtro = assinaturaId ? eq(assinaturas.stripeSubscriptionId, assinaturaId) : null;
    const [linha] = filtro
      ? await db.select().from(assinaturas).where(filtro).limit(1)
      : [];

    const usuarioId = linha?.usuarioId ?? null;

    if (linha) {
      await db.update(assinaturas).set({ status: "inadimplente" }).where(eq(assinaturas.usuarioId, linha.usuarioId));
      await definirPremium(linha.usuarioId, false);
    }

    await registrar({
      acao: "assinatura_pro_inadimplente",
      usuario_id: usuarioId,
      recurso: "plano:pro",
      detalhe: `Stripe ${fatura.id} · cobrança recusada${assinaturaId ? ` · assinatura ${assinaturaId}` : ""}${
        linha ? "" : " · assinatura não encontrada no banco"
      }`,
      ip: ipDe(c),
    });

    // Avisar o usuário: e-mail de cobrança recusada (Stripe já pode enviar; aqui fica o evento na auditoria).
    // O Pro não continua de graça: o premium já foi desmarcado acima.

    return json({ received: true, usuarioId, status: "inadimplente" });
  }

  return json({ received: true, tipo: evento.type });
}

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Checkout de assinatura autenticado — devolve a URL hospedada pelo Stripe. */
plano.post("/checkout", authMiddleware, async (c) => {
  if (!stripeConfigurado) {
    return c.json(
      { error: "Pagamentos não configurados neste ambiente. Defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID." },
      503
    );
  }

  const usuarioId = c.get("usuarioId");
  if (c.get("premium")) {
    return c.json({ error: "Sua conta já é Pro — músicas ilimitadas." }, 409);
  }

  try {
    const [existente] = await db
      .select()
      .from(assinaturas)
      .where(eq(assinaturas.usuarioId, usuarioId))
      .limit(1);

    let clienteId = existente?.stripeCustomerId ?? null;

    if (!clienteId) {
      const cliente = await stripe().customers.create({
        email: c.get("email"),
        name: c.get("nome"),
        metadata: { usuarioId: String(usuarioId) },
      });
      clienteId = cliente.id;

      await db
        .insert(assinaturas)
        .values({ usuarioId, stripeCustomerId: clienteId, status: "pendente" })
        .onDuplicateKeyUpdate({ set: { stripeCustomerId: clienteId, status: "pendente" } });
    }

    const sessao = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: clienteId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: String(usuarioId),
      metadata: { usuarioId: String(usuarioId) },
      subscription_data: { metadata: { usuarioId: String(usuarioId) } },
      branding_settings: { display_name: "Riff" },
      success_url: `${APP_PUBLIC_URL}/painel/plano?checkout=sucesso`,
      cancel_url: `${APP_PUBLIC_URL}/painel/plano?checkout=cancelado`,
    });

    await registrar({
      acao: "checkout_pro_iniciado",
      usuario_id: usuarioId,
      usuario: c.get("nome"),
      papel: c.get("role"),
      recurso: "plano:pro",
      detalhe: `Stripe ${sessao.id}`,
      ip: ipDe(c),
    });

    return c.json({ url: sessao.url, id: sessao.id, plano: PRECO_PRO_LABEL });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[plano] falha ao criar checkout de ${usuarioId}: ${motivo}`);
    return c.json({ error: "Não foi possível abrir o checkout do Stripe agora. Tente novamente." }, 502);
  }
});

/** Portal do cliente — o usuário troca de plano e cancela no painel do Stripe. */
plano.post("/portal", authMiddleware, async (c) => {
  if (!stripeConfigurado) {
    return c.json({ error: "Pagamentos não configurados neste ambiente." }, 503);
  }

  const usuarioId = c.get("usuarioId");
  const [linha] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.usuarioId, usuarioId))
    .limit(1);

  if (!linha?.stripeCustomerId) {
    return c.json({ error: "Este usuário ainda não possui assinatura do Stripe. Assine o Pro primeiro." }, 400);
  }

  try {
    const sessao = await stripe().billingPortal.sessions.create({
      customer: linha.stripeCustomerId,
      return_url: `${APP_PUBLIC_URL}/painel/plano?checkout=portal`,
    });

    await registrar({
      acao: "portal_assinatura_aberto",
      usuario_id: usuarioId,
      usuario: c.get("nome"),
      papel: c.get("role"),
      recurso: "plano:pro",
      detalhe: `Stripe portal ${sessao.id}`,
      ip: ipDe(c),
    });

    return c.json({ url: sessao.url });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[plano] falha ao abrir o portal de ${usuarioId}: ${motivo}`);
    return c.json({ error: "Não foi possível abrir o portal do Stripe agora. Tente novamente." }, 502);
  }
});

/** Status do plano + contagem de músicas. */
plano.get("/status", authMiddleware, async (c) => {
  const [linha] = await db
    .select({ total: count() })
    .from(musicas)
    .where(eq(musicas.usuarioId, c.get("usuarioId")));

  const total = Number(linha?.total ?? 0);
  const ehPro = c.get("premium");

  const [assinatura] = await db
    .select({ status: assinaturas.status, plano: assinaturas.plano, atualizadoEm: assinaturas.atualizadoEm })
    .from(assinaturas)
    .where(eq(assinaturas.usuarioId, c.get("usuarioId")))
    .limit(1);

  return c.json({
    premium: ehPro,
    plano: ehPro ? "pro" : "gratuito",
    limiteMusicas: ehPro ? null : LIMITE_MUSICAS_GRATIS,
    musicas: total,
    restantes: ehPro ? null : Math.max(0, LIMITE_MUSICAS_GRATIS - total),
    preco: PRECO_PRO_LABEL,
    stripeConfigurado,
    assinatura: assinatura ?? null,
  });
});

/** Resumo de faturamento — exclusivo de admin (permissão ver:faturamento). */
plano.get("/resumo", authMiddleware, exigePermissao("ver:faturamento"), async (c) => {
  // Usuários por plano: o app e o auth-service dividem o mesmo banco;
  // `usuarios.premium` é a flag do direito de acesso.
  const totais = await db
    .select({ premium: usuarios.premium, n: count() })
    .from(usuarios)
    .groupBy(usuarios.premium);

  let gratuito = 0;
  let pro = 0;
  for (const linha of totais) {
    if (linha.premium) pro = Number(linha.n);
    else gratuito = Number(linha.n);
  }

  const statusLinhas = await db
    .select({ status: assinaturas.status, n: count() })
    .from(assinaturas)
    .groupBy(assinaturas.status);

  const porStatus: Record<string, number> = {};
  for (const linha of statusLinhas) porStatus[linha.status] = Number(linha.n);

  const ativas = porStatus["ativa"] ?? 0;

  // Valor mensal: prefere o Price configurado no Stripe (modo de teste);
  // sem Stripe configurado, tenta extrair de PRECO_PRO_LABEL.
  let valorMensal = 0;
  try {
    if (stripeConfigurado) {
      const preco = await stripe().prices.retrieve(STRIPE_PRICE_ID);
      valorMensal = (preco.unit_amount ?? 0) / 100;
    } else {
      const match = PRECO_PRO_LABEL.match(/([\d.,]+)/);
      valorMensal = match ? Number(match[1].replace(/\./g, "").replace(",", ".")) : 0;
    }
  } catch {
    valorMensal = 0;
  }

  const mrr = Number((ativas * valorMensal).toFixed(2));

  // Últimos eventos do log de auditoria.
  const token = c.req.header("Authorization")?.slice(7) ?? "";
  const logs = await consultarLogs(token, 5, ipDe(c));

  return c.json({
    usuarios: { total: gratuito + pro, gratuito, pro },
    assinaturas: {
      ativas,
      inadimplentes: porStatus["inadimplente"] ?? 0,
      canceladas: porStatus["cancelada"] ?? 0,
      pendentes: porStatus["pendente"] ?? 0,
      porStatus,
    },
    mrr,
    valorMensal,
    preco: PRECO_PRO_LABEL,
    stripeConfigurado,
    eventos: logs.ok ? (logs.dados as { eventos?: unknown[]; [key: string]: unknown }).eventos ?? logs.dados : [],
  });
});

export default plano;
