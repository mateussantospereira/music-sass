import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "../middleware/auth";
import { exigePermissao } from "../middleware/permissao";
import { alterarPapel, listarUsuarios, type Papel, type Resultado } from "../services/auth-service";
import type { Env } from "../types";

/** Porta de entrada da administração de usuários. O dono do dado é o auth-service. */
const usuarios = new Hono<Env>();
usuarios.use("/*", authMiddleware);

function repassar(c: Context, resultado: Resultado<unknown>, sucesso: ContentfulStatusCode = 200) {
  if (!resultado.ok) {
    return c.json({ error: resultado.erro }, resultado.status as ContentfulStatusCode);
  }
  return c.json(resultado.dados, sucesso);
}

/** GET /api/usuarios — exclusivo de admin (`listar:usuarios`). */
usuarios.get("/", exigePermissao("listar:usuarios"), async (c) => {
  const token = c.req.header("Authorization")!.slice(7);
  return repassar(c, await listarUsuarios(token));
});

/**
 * PATCH /api/usuarios/:id/role — troca o papel.
 * Permissão: `alterar:papel`. Papéis válidos: admin | curador | ouvinte.
 */
usuarios.patch("/:id/role", exigePermissao("alterar:papel"), async (c) => {
  const token = c.req.header("Authorization")!.slice(7);
  const id = Number(c.req.param("id"));
  const { role } = await c.req.json().catch(() => ({ role: undefined }));

  const papeis: Papel[] = ["admin", "curador", "ouvinte"];
  if (!papeis.includes(role as Papel)) {
    return c.json(
      { error: 'Papel inválido. Use "admin", "curador" ou "ouvinte".', papel_recebido: role ?? null },
      400
    );
  }

  return repassar(c, await alterarPapel(token, id, role as Papel));
});

export default usuarios;
