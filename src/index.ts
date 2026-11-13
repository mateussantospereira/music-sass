import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readFileSync } from "node:fs";
import authRoutes from "./routes/auth";
import musicasRoutes from "./routes/musicas";
import playlistsRoutes from "./routes/playlists";
import usuariosRoutes from "./routes/usuarios";
import logsRoutes from "./routes/logs";
import planoRoutes from "./routes/plano";
import { auditoria403Middleware } from "./middleware/auditoria";
import { garantirBucket, MINIO_BUCKET } from "./services/minio";

/**
 * Riff — o único container com porta publicada.
 *
 * O app é a borda do sistema: serve a SPA (React) e a API pública.
 * Autenticação é delegada ao auth-service; auditoria, ao log-service.
 * Nenhuma senha, JWT_SECRET ou regra de papel mora aqui.
 */
const app = new Hono();

// Auditoria central: toda resposta 403 vira um evento `acao_negada` no stream.
app.use("*", auditoria403Middleware);

app.route("/api", authRoutes);
app.route("/api/musicas", musicasRoutes);
app.route("/api/playlists", playlistsRoutes);
// Exclusivo de admin: listar usuários e trocar papel.
app.route("/api/usuarios", usuariosRoutes);
// Exclusivo de admin: consultar o stream de auditoria no Redis.
app.route("/api/logs", logsRoutes);
// Plano Pro: checkout no Stripe + webhook + status.
app.route("/api/plano", planoRoutes);

/** Healthcheck do container. Não toca em serviços externos de propósito. */
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    servico: "app",
    produto: "Riff",
    auth_service: process.env.AUTH_SERVICE_URL ?? "http://auth-service:3000",
    log_service: process.env.LOG_SERVICE_URL ?? "http://log-service:3000",
  })
);

app.get("/api/*", (c) => c.json({ error: "Rota não encontrada" }, 404));

/* -------------------------------------------------------------------------- */
/* SPA estática (web/dist) — a mesma origem da API                             */
/* -------------------------------------------------------------------------- */

try {
  app.use("/*", serveStatic({ root: "./web/dist" }));
} catch {
  console.error("[app] ./web/dist não está disponível; rode `bun run build` em web/.");
}

// Fallback para o roteador do cliente: qualquer rota de página devolve a SPA.
let indexHtml = "";
try {
  indexHtml = readFileSync("./web/dist/index.html", "utf8");
} catch {
  indexHtml =
    "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Riff</title></head>" +
    "<body><h1>Riff</h1><p>Frontend não compilado. Veja web/README.</p></body></html>";
}
app.get("*", (c) => c.html(indexHtml));

const port = Number(process.env.PORT) || 8222;

console.log(
  `[app] Riff ouvindo na porta ${port} — autenticação em ` +
    `${process.env.AUTH_SERVICE_URL ?? "http://auth-service:3000"}`
);

// Garante o bucket de mídia na subida. Com retry e sem travar o boot: se o
// MinIO estiver fora, o app sobe e os uploads respondem 503 até ele voltar.
(async function prepararMinIO() {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      await garantirBucket();
      console.log(`[app] bucket "${MINIO_BUCKET}" pronto no object storage`);
      return;
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.error(`[app] object storage indisponível (tentativa ${tentativa}/5): ${motivo}`);
      await new Promise((resolver) => setTimeout(resolver, 3000));
    }
  }
})();

export default {
  port,
  fetch: app.fetch,
};
