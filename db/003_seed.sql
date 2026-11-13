-- =============================================================================
-- Riff · 003 — dados de demonstração
-- =============================================================================
-- Idempotente: pode rodar quantas vezes for preciso. `ON DUPLICATE KEY` cuida
-- das contas de demonstração (inclusive restaurando a senha documentada) e os
-- INSERTs condicionais (`WHERE NOT EXISTS`) não duplicam registros.
--
-- Contas:
--   admin@riff.app    / Admin@123    (admin)
--   curador@riff.app  / Curador@123  (curador)
--   ouvinte@riff.app  / Ouvinte@123  (ouvinte)
--
-- As músicas de demonstração apontam para chaves de áudio no MinIO
-- (`demo/...`). Para ouvi-las/baixá-las de verdade, suba arquivos de áudio
-- correspondentes no bucket (veja README, seção "Mídia de demonstração") ou
-- adicione uma música nova colando a URL do YouTube.
-- =============================================================================

INSERT INTO `usuarios` (`nome`, `email`, `senha_hash`, `role`, `premium`) VALUES
  ('Administrador Riff', 'admin@riff.app',
   '$2a$10$HnoZRWUsCCJ4rRWF/Qs49uqzcuYtPTE6E0wKZAow./M9wynew4Diq', 'admin', TRUE),
  ('Camila Curadoria', 'curador@riff.app',
   '$2a$10$rGv0NDNnhwKF21pKPOzTR.NBUcUJsaIhsUWRvzSlbcqQRbMaw9JxK', 'curador', FALSE),
  ('Otávio Ouvinte', 'ouvinte@riff.app',
   '$2a$10$nytJAeXdb/MqVqaKw5yuce7ywqpGMlBTd6KNShokoMqCoRBHSfYh.', 'ouvinte', FALSE)
ON DUPLICATE KEY UPDATE
  `nome` = VALUES(`nome`),
  `senha_hash` = VALUES(`senha_hash`),
  `role` = VALUES(`role`),
  `premium` = VALUES(`premium`);

SET @admin_id = (SELECT `id` FROM `usuarios` WHERE `email` = 'admin@riff.app' LIMIT 1);
SET @curador_id = (SELECT `id` FROM `usuarios` WHERE `email` = 'curador@riff.app' LIMIT 1);
SET @ouvinte_id = (SELECT `id` FROM `usuarios` WHERE `email` = 'ouvinte@riff.app' LIMIT 1);

-- Música 1: curador, extração concluída (demo).
INSERT INTO `musicas`
  (`usuario_id`, `titulo`, `artista`, `origem_url`, `duracao_seg`, `status`, `chave_audio`, `chave_capa`, `content_type`, `tamanho`)
SELECT @curador_id, 'Ondas Sonoras (demo)', 'Riff Demo', 'https://www.youtube.com/watch?v=demo-ondas',
       5, 'pronta', 'demo/ondas-sonoras.wav', NULL, 'audio/wav', 220544
WHERE NOT EXISTS (
  SELECT 1 FROM `musicas` WHERE `usuario_id` = @curador_id AND `titulo` = 'Ondas Sonoras (demo)'
);

-- Música 2: curador, extração concluída (demo).
INSERT INTO `musicas`
  (`usuario_id`, `titulo`, `artista`, `origem_url`, `duracao_seg`, `status`, `chave_audio`, `chave_capa`, `content_type`, `tamanho`)
SELECT @curador_id, 'Estudo para Piano (demo)', 'Riff Demo', 'https://www.youtube.com/watch?v=demo-piano',
       8, 'pronta', 'demo/estudo-piano.wav', NULL, 'audio/wav', 352844
WHERE NOT EXISTS (
  SELECT 1 FROM `musicas` WHERE `usuario_id` = @curador_id AND `titulo` = 'Estudo para Piano (demo)'
);

-- Música 3: do ADMIN. O curador NÃO pode abrir este registro, mesmo sabendo o
-- ID — é o caso usado no print de isolamento por usuário.
INSERT INTO `musicas`
  (`usuario_id`, `titulo`, `artista`, `origem_url`, `duracao_seg`, `status`, `chave_audio`, `chave_capa`, `content_type`, `tamanho`)
SELECT @admin_id, 'Arquivo do Administrador (demo)', 'Administração Riff', 'https://www.youtube.com/watch?v=demo-admin',
       5, 'pronta', 'demo/arquivo-admin.wav', NULL, 'audio/wav', 220544
WHERE NOT EXISTS (
  SELECT 1 FROM `musicas` WHERE `usuario_id` = @admin_id AND `titulo` = 'Arquivo do Administrador (demo)'
);

-- Playlist do curador com as duas músicas dele.
INSERT INTO `playlists` (`usuario_id`, `nome`, `descricao`)
SELECT @curador_id, 'Estudo e Concentração', 'Faixas para foco profundo durante o trabalho.'
WHERE NOT EXISTS (
  SELECT 1 FROM `playlists` WHERE `usuario_id` = @curador_id AND `nome` = 'Estudo e Concentração'
);

SET @playlist_curador = (
  SELECT `id` FROM `playlists`
   WHERE `usuario_id` = @curador_id AND `nome` = 'Estudo e Concentração' LIMIT 1
);
SET @musica_1 = (SELECT `id` FROM `musicas` WHERE `usuario_id` = @curador_id AND `titulo` = 'Ondas Sonoras (demo)' LIMIT 1);
SET @musica_2 = (SELECT `id` FROM `musicas` WHERE `usuario_id` = @curador_id AND `titulo` = 'Estudo para Piano (demo)' LIMIT 1);

INSERT IGNORE INTO `playlist_musicas` (`playlist_id`, `musica_id`, `ordem`) VALUES
  (@playlist_curador, @musica_1, 1),
  (@playlist_curador, @musica_2, 2);

-- O curador compartilha a playlist com o ouvinte (o ouvinte enxerga as faixas).
INSERT IGNORE INTO `compartilhamentos` (`usuario_id`, `playlist_id`, `concedido_por`)
VALUES (@ouvinte_id, @playlist_curador, @curador_id);

-- O curador também compartilha uma música avulsa com o ouvinte.
INSERT IGNORE INTO `compartilhamentos` (`usuario_id`, `musica_id`, `concedido_por`)
VALUES (@ouvinte_id, @musica_1, @curador_id);

-- Assinatura Pro de demonstração para o admin (Stripe desligado no seed).
INSERT INTO `assinaturas` (`usuario_id`, `status`, `plano`)
VALUES (@admin_id, 'ativa', 'pro')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `plano` = VALUES(`plano`);
