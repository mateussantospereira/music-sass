import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { registrar, ipDe } from "../services/log-service";

/**
 * Auditoria central de ações negadas (HTTP 403).
 *
 * Executa depois da rota. Se a resposta foi 403, registra o evento
 * `acao_negada` com a permissão exigida e quem tentou. Falha de auditoria
 * nunca derruba a requisição.
 */
export const auditoria403Middleware = createMiddleware<Env>(async (c, next) => {
  await next();

  if (c.res.status === 403) {
    try {
      const corpo = (await c.res.clone().json().catch(() => null)) as Record<string, unknown> | null;
      const permissaoExigida = typeof corpo?.permissao_exigida === "string" ? corpo.permissao_exigida : null;
      const detalheErro = typeof corpo?.error === "string" ? corpo.error : "Acesso negado";

      await registrar({
        acao: "acao_negada",
        usuario_id: c.get("usuarioId") ?? null,
        usuario: c.get("nome") ?? null,
        papel: c.get("role") ?? null,
        recurso: permissaoExigida
          ? `${c.req.method} ${c.req.path} (${permissaoExigida})`
          : `${c.req.method} ${c.req.path}`,
        detalhe: detalheErro,
        ip: ipDe(c),
      });
    } catch {
      // Observabilidade nunca derruba o produto.
    }
  }
});
