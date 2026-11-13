-- =============================================================================
-- Riff · auth-service · 002 — direito ao plano Pro
-- =============================================================================
-- O auth-service é o dono de `usuarios`, então é aqui que mora o DIREITO
-- `premium`. Ele NÃO guarda dado de pagamento: os identificadores do Stripe
-- ficam na tabela `assinaturas` do app.
--
-- Idempotente: nenhum usuário existente perde dado; todos ficam com
-- premium = false até assinarem o Pro.
-- =============================================================================

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `premium` BOOLEAN NOT NULL DEFAULT FALSE;
