-- =============================================================================
-- Riff · auth-service · 001 — identidade
-- =============================================================================
-- Cria/completa a tabela `usuarios` e cria `reset_tokens`.
-- Idempotente: pode rodar num banco novo ou no banco herdado da atividade 9.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'social_media',
  `premium` BOOLEAN NOT NULL DEFAULT FALSE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `usuarios_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `role` VARCHAR(20) NOT NULL DEFAULT 'social_media';

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `premium` BOOLEAN NOT NULL DEFAULT FALSE;

-- Papéis antigos do projeto de filmes viram o papel de criação de conteúdo.
UPDATE `usuarios`
   SET `role` = 'social_media'
 WHERE `role` IN ('usuario', 'user', '') OR `role` IS NULL;

CREATE TABLE IF NOT EXISTS `reset_tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(64) NOT NULL,
  `usuario_id` INT NOT NULL,
  `criado_em` TIMESTAMP NOT NULL,
  `expira_em` TIMESTAMP NOT NULL,
  `usado` BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY `reset_tokens_token_unique` (`token`),
  KEY `reset_tokens_usuario_idx` (`usuario_id`),
  CONSTRAINT `reset_tokens_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
