import {
  mysqlTable,
  int,
  varchar,
  timestamp,
  boolean,
  unique,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Schema do auth-service — a fronteira de dados da identidade.
 *
 * São as duas únicas tabelas que este serviço possui:
 *   usuarios     -> quem é a pessoa, senha (hash), papel e direito `premium`
 *   reset_tokens -> os links de recuperação de senha
 *
 * O app do Riff tem o próprio schema (musicas, playlists,
 * playlist_musicas, compartilhamentos, assinaturas) e nunca importa daqui.
 * O diálogo entre os dois é HTTP, pelo `GET /me`.
 */

/** Papéis do negócio. Todo cadastro nasce como `curador`. */
export const PAPEIS = ["admin", "curador", "ouvinte"] as const;
export type Papel = (typeof PAPEIS)[number];

export const usuarios = mysqlTable("usuarios", {
  id: int("id").primaryKey().autoincrement(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).unique().notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  /** Quem pode fazer o quê. Nasce como `curador`; virar admin é decisão administrativa. */
  role: varchar("role", { length: 20 }).notNull().default("curador"),
  /**
   * Direito ao plano Pro. É o DIREITO, não o pagamento: os IDs do Stripe ficam
   * na tabela `assinaturas` do app. O webhook do Stripe manda o app chamar a
   * rota interna que vira este booleano.
   */
  premium: boolean("premium").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow(),
});

/**
 * Registro dos links de redefinição de senha.
 * - token     : 64 caracteres hexadecimais (32 bytes aleatórios) — único
 * - usuario_id: quem pediu
 * - criado_em / expira_em : validade de 30 minutos
 * - usado     : true depois da troca (impede reuso do mesmo link)
 */
export const resetTokens = mysqlTable(
  "reset_tokens",
  {
    id: int("id").primaryKey().autoincrement(),
    token: varchar("token", { length: 64 }).notNull(),
    usuarioId: int("usuario_id")
      .references(() => usuarios.id)
      .notNull(),
    criadoEm: timestamp("criado_em").notNull(),
    expiraEm: timestamp("expira_em").notNull(),
    usado: boolean("usado").notNull().default(false),
  },
  (t) => [unique().on(t.token), index("reset_tokens_usuario_idx").on(t.usuarioId)]
);
