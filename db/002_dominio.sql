-- =============================================================================
-- Riff · 002 — domínio do negócio (música)
-- =============================================================================
-- Tabelas do recurso principal e seus relacionamentos:
--
--   usuarios 1---N musicas            (quem curou a faixa)
--   usuarios 1---N playlists
--   playlists N---N musicas           (via playlist_musicas)
--   musicas 1---N compartilhamentos   (quem pode ouvir/baixar)
--   playlists 1---N compartilhamentos
--
-- `musicas.usuario_id` é o dono do registro. É por ele que TODA consulta de
-- quem não é admin filtra. A única exceção de leitura para terceiros é o
-- COMPARTILHAMENTO explícito (tabela `compartilhamentos`): o ouvinte enxerga
-- exatamente as músicas/playlists que o dono liberou para ele.
-- =============================================================================

-- O domínio anterior (rede social/conteúdo) sai do banco. O histórico Git
-- preserva as migrations antigas.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `compartilhamentos`;
DROP TABLE IF EXISTS `playlist_musicas`;
DROP TABLE IF EXISTS `playlists`;
DROP TABLE IF EXISTS `musicas`;
DROP TABLE IF EXISTS `midias`;
DROP TABLE IF EXISTS `aprovacoes`;
DROP TABLE IF EXISTS `posts`;
DROP TABLE IF EXISTS `contas_sociais`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- musicas — o RECURSO PRINCIPAL do negócio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `musicas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `titulo` VARCHAR(200) NOT NULL,
  `artista` VARCHAR(200),
  `origem_url` VARCHAR(500),
  `duracao_seg` INT,
  `status` VARCHAR(20) NOT NULL DEFAULT 'processando',
  `chave_audio` VARCHAR(255),
  `chave_capa` VARCHAR(255),
  `content_type` VARCHAR(80),
  `tamanho` INT,
  `erro_msg` TEXT,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `musicas_usuario_idx` (`usuario_id`),
  KEY `musicas_status_idx` (`status`),
  CONSTRAINT `musicas_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- playlists — coleções de músicas por usuário.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `playlists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `descricao` VARCHAR(500),
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `playlists_usuario_idx` (`usuario_id`),
  CONSTRAINT `playlists_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- playlist_musicas — N:N entre playlists e musicas, com ordem.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `playlist_musicas` (
  `playlist_id` INT NOT NULL,
  `musica_id` INT NOT NULL,
  `ordem` INT NOT NULL DEFAULT 0,
  `adicionada_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`playlist_id`, `musica_id`),
  KEY `playlist_musicas_musica_idx` (`musica_id`),
  CONSTRAINT `playlist_musicas_playlist_fk`
    FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `playlist_musicas_musica_fk`
    FOREIGN KEY (`musica_id`) REFERENCES `musicas` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- compartilhamentos — libera uma música OU uma playlist para outro usuário.
-- Exatamente um dos dois alvos é preenchido (regra CHECK + garantida na API).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `compartilhamentos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `musica_id` INT NULL,
  `playlist_id` INT NULL,
  `concedido_por` INT NOT NULL,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `compartilhamentos_musica_unique` (`usuario_id`, `musica_id`),
  UNIQUE KEY `compartilhamentos_playlist_unique` (`usuario_id`, `playlist_id`),
  KEY `compartilhamentos_musica_idx` (`musica_id`),
  KEY `compartilhamentos_playlist_idx` (`playlist_id`),
  CONSTRAINT `compartilhamentos_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `compartilhamentos_musica_fk`
    FOREIGN KEY (`musica_id`) REFERENCES `musicas` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `compartilhamentos_playlist_fk`
    FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `compartilhamentos_concedido_por_fk`
    FOREIGN KEY (`concedido_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `compartilhamentos_alvo_chk`
    CHECK ((`musica_id` IS NULL) <> (`playlist_id` IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- assinaturas — identificadores do Stripe (plano Pro). O direito
-- (`usuarios.premium`) mora no auth-service; aqui ficam só os IDs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `assinaturas` (
  `usuario_id` INT PRIMARY KEY,
  `stripe_customer_id` VARCHAR(64),
  `stripe_subscription_id` VARCHAR(64),
  `status` VARCHAR(20) NOT NULL DEFAULT 'pendente',
  `plano` VARCHAR(40) NOT NULL DEFAULT 'pro',
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `assinaturas_stripe_subscription_unique` (`stripe_subscription_id`),
  CONSTRAINT `assinaturas_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
