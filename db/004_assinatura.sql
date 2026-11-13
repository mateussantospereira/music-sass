-- =============================================================================
-- Riff · 004 — idempotência de webhooks do Stripe
-- =============================================================================
-- O Stripe reenvia o mesmo evento quando não recebe 2XX a tempo. Esta tabela
-- registra o `id` de cada evento processado: quem chega primeiro é processado;
-- quem chega de novo recebe 200 e sai sem efeito duplicado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `stripe_eventos` (
  `id` VARCHAR(128) PRIMARY KEY,
  `tipo` VARCHAR(80) NOT NULL,
  `processado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
