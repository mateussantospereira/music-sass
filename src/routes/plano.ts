import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../db";
import { assinaturas, musicas } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { registrar, ipDe } from "../services/log-service";
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
 * Plano Pro — Stripe Checkout + webhook.
 *
 * O cartão nunca passa pelo backend: a pessoa digita na página hospedada pelo
 * Stripe. A confirmação chega por webhook assinado, que grava os IDs em
 * `assinaturas` e pede ao auth-service para marcar `usuarios.premium`.
 */
const plano = new Hono<Env>();

const EVENTO_PAGO = "checkout.session.completed";

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

  try {
    if (evento.type === EVENTO_PAGO) {
      const sessao = evento.data.object as Stripe.Checkout.Session;
      const usuarioId = Number(sessao.client_reference_id ?? sessao.metadata?.usuarioId ?? "");

      if (!Number.isInteger(usuarioId)) {
        console.error(`[plano] ${EVENTO_PAGO} sem usuario_id: sessão ${sessao.id}`);
        return c.json({ received: true, ignorado: "sem usuario_id" });
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
        usuario: null,
        papel: null,
        recurso: "plano:pro",
        detalhe: `Stripe ${sessao.id} · assinatura ${assinaturaId ?? "—"}${
          sincronizou.ok ? "" : " · FALHA ao sincronizar premium"
        }`,
        ip: ipDe(c),
      });

      if (!sincronizou.ok) {
        return c.json({ error: "Falha ao ativar o Pro; o Stripe deve reenviar." }, 500);
      }

      return c.json({ received: true, usuarioId, premium: true });
    }

    if (
      evento.type === "customer.subscription.updated" ||
      evento.type === "customer.subscription.deleted"
    ) {
      const sub = evento.data.object as Stripe.Subscription;
      const [linha] = await db
        .select()
        .from(assinaturas)
        .where(eq(assinaturas.stripeSubscriptionId, sub.id))
        .limit(1);

      if (!linha) return c.json({ received: true, ignorado: "assinatura desconhecida" });

      const status = evento.type === "customer.subscription.deleted" ? "cancelada" : sub.status;
      const ativo = status === "active" || status === "trialing";

      await db.update(assinaturas).set({ status }).where(eq(assinaturas.usuarioId, linha.usuarioId));
      const sincronizou = await definirPremium(linha.usuarioId, ativo);

      await registrar({
        acao: ativo ? "assinatura_pro_ativada" : "assinatura_pro_cancelada",
        usuario_id: linha.usuarioId,
        usuario: null,
        papel: null,
        recurso: "plano:pro",
        detalhe: `Stripe ${sub.id} · status ${status}`,
        ip: ipDe(c),
      });

      if (!sincronizou.ok) {
        return c.json({ error: "Falha ao sincronizar o Pro; o Stripe deve reenviar." }, 500);
      }

      return c.json({ received: true, usuarioId: linha.usuarioId, premium: ativo, status });
    }

    return c.json({ received: true, tipo: evento.type });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[plano] erro ao processar webhook ${evento.type}: ${motivo}`);
    return c.json({ error: "Erro ao processar o webhook." }, 500);
  }
});

/** Checkout autenticado — devolve a URL hospedada pelo Stripe. */
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
      success_url: `${APP_PUBLIC_URL}/painel?checkout=sucesso`,
      cancel_url: `${APP_PUBLIC_URL}/painel?checkout=cancelado`,
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

/** Status do plano + contagem de músicas. */
plano.get("/status", authMiddleware, async (c) => {
  const [linha] = await db
    .select({ total: count() })
    .from(musicas)
    .where(eq(musicas.usuarioId, c.get("usuarioId")));

  const total = Number(linha?.total ?? 0);
  const ehPro = c.get("premium");

  return c.json({
    premium: ehPro,
    plano: ehPro ? "pro" : "gratuito",
    limiteMusicas: ehPro ? null : LIMITE_MUSICAS_GRATIS,
    musicas: total,
    restantes: ehPro ? null : Math.max(0, LIMITE_MUSICAS_GRATIS - total),
    preco: PRECO_PRO_LABEL,
    stripeConfigurado,
  });
});

export default plano;
