-- =============================================================================
-- Riff · 000 — limpeza do legado do projeto de filmes
-- =============================================================================
-- Remove as tabelas que não pertencem mais ao domínio atual. O histórico Git
-- preserva o código anterior; este script é separado para a limpeza ser uma
-- decisão explícita, e não um efeito colateral de uma migration.
--
-- O que NÃO é tocado: `usuarios` e `reset_tokens` (identidade), nem as tabelas
-- do domínio Riff (002).
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `participacoes`;
DROP TABLE IF EXISTS `agendamentos`;
DROP TABLE IF EXISTS `categorias`;
DROP TABLE IF EXISTS `favoritos`;
DROP TABLE IF EXISTS `comentarios`;
DROP TABLE IF EXISTS `perfis`;
DROP TABLE IF EXISTS `logs_auditoria`;

SET FOREIGN_KEY_CHECKS = 1;
