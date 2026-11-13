/**
 * Regras do plano comercial.
 *
 * O limite de músicas é uma decisão de negócio, não de pagamento. O Stripe
 * cobra; o app decide o que o plano gratuito pode fazer.
 */
export const LIMITE_MUSICAS_GRATIS = Number(process.env.LIMITE_MUSICAS_GRATIS ?? 10);

/** Texto exibido na interface. O valor real vem do Price criado no Stripe. */
export const PRECO_PRO_LABEL = process.env.STRIPE_PRICE_LABEL ?? "R$ 29,00/mês";
export const NOME_PLANO_GRATIS = "Gratuito";
export const NOME_PLANO_PRO = "Pro";
