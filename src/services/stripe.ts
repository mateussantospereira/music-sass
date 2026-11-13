import Stripe from "stripe";

/**
 * Integração Stripe — plano Pro.
 *
 * Nenhum dado de cartão passa pelo backend: o usuário é redirecionado para a
 * página hospedada pelo Stripe e a confirmação chega por webhook assinado.
 * Sem chaves configuradas, o app sobe normalmente e só o checkout responde
 * 503.
 */

const chaveSecreta = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const precoPro = process.env.STRIPE_PRICE_ID?.trim() ?? "";
const segredoWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

export const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL ?? "http://localhost:8222").replace(/\/+$/, "");

export const stripeConfigurado = Boolean(chaveSecreta && precoPro);
export const webhookConfigurado = Boolean(chaveSecreta && segredoWebhook);

export const STRIPE_PRICE_ID = precoPro;
export const STRIPE_WEBHOOK_SECRET = segredoWebhook;

let instancia: Stripe | null = null;

export function stripe(): Stripe {
  if (!chaveSecreta) throw new Error("STRIPE_SECRET_KEY não configurada");
  instancia ??= new Stripe(chaveSecreta);
  return instancia;
}
