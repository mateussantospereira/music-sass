import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";

/**
 * Schema do DOMÍNIO Riff.
 *
 * Dono das tabelas de negócio:
 *   musicas            -> faixas curadas/baixadas (o recurso principal)
 *   playlists          -> coleções de músicas por usuário
 *   playlist_musicas   -> N:N entre playlist e música, com ordem
 *   compartilhamentos  -> quem pode ouvir o quê
 *   assinaturas        -> identificadores do Stripe (plano Pro)
 *
 * `usuarios` e `reset_tokens` pertencem ao auth-service. A declaração de
 * `usuarios` aqui serve só para as chaves estrangeiras; nenhuma rota deste
 * serviço lê senha ou decide papel. O papel e as permissões chegam pelo
 * `GET /me` do auth-service.
 */
export const usuarios = mysqlTable("usuarios", {
  id: int("id").primaryKey().autoincrement(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("curador"),
  premium: boolean("premium").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow(),
});

/** Status de extração de uma faixa. */
export type StatusMusica = "processando" | "pronta" | "erro";

/**
 * Recurso principal do negócio: a faixa de música.
 *
 * `usuario_id` é o dono (quem curou). Toda consulta de quem não é admin
 * filtra por ele OU pelos compartilhamentos recebidos. Não há exceção
 * implícita: ou você é dono, ou alguém liberou para você, ou é 403.
 */
export const musicas = mysqlTable(
  "musicas",
  {
    id: int("id").primaryKey().autoincrement(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    artista: varchar("artista", { length: 200 }),
    origemUrl: varchar("origem_url", { length: 500 }),
    duracaoSeg: int("duracao_seg"),
    status: varchar("status", { length: 20 }).notNull().default("processando"),
    chaveAudio: varchar("chave_audio", { length: 255 }),
    chaveCapa: varchar("chave_capa", { length: 255 }),
    contentType: varchar("content_type", { length: 80 }),
    tamanho: int("tamanho"),
    erroMsg: text("erro_msg"),
    criadoEm: timestamp("criado_em").defaultNow(),
    atualizadoEm: timestamp("atualizado_em").defaultNow().onUpdateNow(),
  },
  (t) => [
    index("musicas_usuario_idx").on(t.usuarioId),
    index("musicas_status_idx").on(t.status),
  ]
);

/** Playlist pessoal (o dono é o único que edita/apaga). */
export const playlists = mysqlTable(
  "playlists",
  {
    id: int("id").primaryKey().autoincrement(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id, { onDelete: "cascade" })
      .notNull(),
    nome: varchar("nome", { length: 120 }).notNull(),
    descricao: varchar("descricao", { length: 500 }),
    criadoEm: timestamp("criado_em").defaultNow(),
    atualizadoEm: timestamp("atualizado_em").defaultNow().onUpdateNow(),
  },
  (t) => [index("playlists_usuario_idx").on(t.usuarioId)]
);

/** N:N entre playlists e musicas, com posição na fila. */
export const playlistMusicas = mysqlTable(
  "playlist_musicas",
  {
    playlistId: int("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    musicaId: int("musica_id")
      .references(() => musicas.id, { onDelete: "cascade" })
      .notNull(),
    ordem: int("ordem").notNull().default(0),
    adicionadaEm: timestamp("adicionada_em").defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.playlistId, t.musicaId] }),
    index("playlist_musicas_musica_idx").on(t.musicaId),
  ]
);

/**
 * Liberação explícita de uma música OU de uma playlist para outro usuário.
 * Exatamente um dos dois alvos é preenchido (sem XOR implícito no Drizzle;
 * a regra é garantida pela rota e pelo CHECK no banco).
 */
export const compartilhamentos = mysqlTable(
  "compartilhamentos",
  {
    id: int("id").primaryKey().autoincrement(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id, { onDelete: "cascade" })
      .notNull(),
    musicaId: int("musica_id").references(() => musicas.id, { onDelete: "cascade" }),
    playlistId: int("playlist_id").references(() => playlists.id, { onDelete: "cascade" }),
    concedidoPor: int("concedido_por")
      .references(() => usuarios.id)
      .notNull(),
    criadoEm: timestamp("criado_em").defaultNow(),
  },
  (t) => [
    unique("compartilhamentos_musica_unique").on(t.usuarioId, t.musicaId),
    unique("compartilhamentos_playlist_unique").on(t.usuarioId, t.playlistId),
    index("compartilhamentos_musica_idx").on(t.musicaId),
    index("compartilhamentos_playlist_idx").on(t.playlistId),
  ]
);

/** Idempotência de webhooks: um evento do Stripe processado uma única vez. */
export const stripeEventos = mysqlTable(
  "stripe_eventos",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    tipo: varchar("tipo", { length: 80 }).notNull(),
    processadoEm: timestamp("processado_em").defaultNow(),
  }
);

/**
 * Assinatura do plano Pro. O direito (`usuarios.premium`) mora no
 * auth-service; aqui ficam só os IDs devolvidos pelo Stripe.
 */
export const assinaturas = mysqlTable(
  "assinaturas",
  {
    usuarioId: int("usuario_id")
      .primaryKey()
      .references(() => usuarios.id),
    stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("pendente"),
    plano: varchar("plano", { length: 40 }).notNull().default("pro"),
    atualizadoEm: timestamp("atualizado_em").defaultNow().onUpdateNow(),
  },
  (t) => [unique("assinaturas_stripe_subscription_unique").on(t.stripeSubscriptionId)]
);

export type Usuario = typeof usuarios.$inferSelect;
export type Musica = typeof musicas.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type PlaylistMusica = typeof playlistMusicas.$inferSelect;
export type Compartilhamento = typeof compartilhamentos.$inferSelect;
