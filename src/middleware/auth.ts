import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { sessao } from "../services/auth-service";

/**
 * Autenticação delegada ao auth-service.
 *
 * O Riff não tem JWT_SECRET e não decodifica token. Ele manda o Bearer
 * para o auth-service (`GET /me`) e recebe id, nome, papel e permissões. Se o
 * auth-service estiver fora do ar, a resposta é 503 — o resto do sistema
 * continua no ar.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Token ausente" }, 401);
  }

  const resultado = await sessao(header.slice(7));

  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as 401 | 503);
  }

  c.set("usuarioId", resultado.dados.usuarioId);
  c.set("role", resultado.dados.role);
  c.set("nome", resultado.dados.nome);
  c.set("email", resultado.dados.email);
  c.set("premium", Boolean(resultado.dados.premium));
  c.set("permissoes", resultado.dados.permissoes ?? []);

  await next();
});
