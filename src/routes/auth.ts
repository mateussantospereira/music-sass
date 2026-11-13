import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "../middleware/auth";
import { ipDe } from "../services/log-service";
import {
  encerrarSessao,
  esquecerSenha,
  login,
  registrar,
  sessao,
  trocarSenha,
  type Resultado,
} from "../services/auth-service";

/**
 * Gateway de autenticação.
 *
 * O app é o único container com porta publicada, então é por ele que o
 * navegador entra. As rotas abaixo só transportam a chamada para o
 * auth-service por dentro da rede Docker; nenhuma regra de senha/JWT mora aqui.
 */
const auth = new Hono();

function repassar(c: Context, resultado: Resultado<unknown>, sucesso: ContentfulStatusCode = 200) {
  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as ContentfulStatusCode);
  }
  return c.json(resultado.dados, sucesso);
}

auth.post("/register", async (c) => {
  const { nome, email, senha } = await c.req.json().catch(() => ({}));
  return repassar(c, await registrar({ nome, email, senha }), 201);
});

auth.post("/login", async (c) => {
  const { email, senha } = await c.req.json().catch(() => ({}));
  return repassar(c, await login(email, senha, ipDe(c)));
});

auth.post("/logout", authMiddleware, async (c) => {
  const header = c.req.header("Authorization")!;
  return repassar(c, await encerrarSessao(header.slice(7), ipDe(c)));
});

auth.get("/me", authMiddleware, async (c) => {
  const header = c.req.header("Authorization")!;
  return repassar(c, await sessao(header.slice(7)));
});

auth.post("/forgot-password", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  return repassar(c, await esquecerSenha(email));
});

auth.post("/reset-password", async (c) => {
  const { token, novaSenha } = await c.req.json().catch(() => ({}));
  return repassar(c, await trocarSenha(token, novaSenha));
});

export default auth;
