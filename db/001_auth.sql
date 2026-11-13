-- =============================================================================
-- Riff · 001 — identidade (auth-service)
-- =============================================================================
-- Cria/completa a tabela `usuarios` e a tabela `reset_tokens`.
-- Idempotente: pode rodar em um banco novo ou em bancos trazidos da base
-- anterior. Os papéis antigos são mapeados para os papéis do negócio.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'curador',
  `premium` BOOLEAN NOT NULL DEFAULT FALSE,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `usuarios_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `role` VARCHAR(20) NOT NULL DEFAULT 'curador';

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `premium` BOOLEAN NOT NULL DEFAULT FALSE;

-- Papéis históricos do projeto (atividade 9 / domínio anterior) viram os
-- papéis do negócio: quem produzia conteúdo vira `curador`; quem só aprovava
-- vira `ouvinte`.
UPDATE `usuarios` SET `role` = 'curador' WHERE `role` = 'usuario' OR `role` = 'social_media' OR `role` IS NULL OR `role` = '';
UPDATE `usuarios` SET `role` = 'ouvinte' WHERE `role` = 'cliente';

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
