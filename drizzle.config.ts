import { defineConfig } from "drizzle-kit";

/**
 * A aplicação Riff é dona das tabelas do domínio:
 * musicas, playlists, playlist_musicas, compartilhamentos e assinaturas.
 *
 * `usuarios` e `reset_tokens` pertencem ao auth-service. Elas aparecem no
 * schema apenas para as chaves estrangeiras, mas o `tablesFilter` impede que
 * um `db:push` daqui tente criar/alterar/dropar as tabelas do outro serviço.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  tablesFilter: ["musicas", "playlists", "playlist_musicas", "compartilhamentos", "assinaturas"],
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  },
});
