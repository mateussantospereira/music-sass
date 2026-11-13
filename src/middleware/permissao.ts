import { createMiddleware } from "hono/factory";
import type { Env, Permissao } from "../types";

/**
 * Autorização no servidor.
 *
 * O botão escondido na tela não é segurança: qualquer pessoa pode chamar a
 * API direto. Este middleware é a barreira real. Ele é montado DEPOIS do
 * `authMiddleware`, então:
 *
 *   401 = não sei quem você é
 *   403 = sei quem você é, e você não pode
 */
export const exigePermissao = (permissao: Permissao) =>
  createMiddleware<Env>(async (c, next) => {
    const permissoes = c.get("permissoes") ?? [];
    const role = c.get("role");

    if (!permissoes.includes(permissao)) {
      return c.json(
        {
          error: `Ação negada: o seu papel (${role ?? "desconhecido"}) não tem a permissão "${permissao}".`,
          permissao_exigida: permissao,
          papel: role ?? null,
        },
        403
      );
    }

    await next();
  });
