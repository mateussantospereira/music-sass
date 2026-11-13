import type { Papel } from "./services/auth-service";

/**
 * Permissões do negócio. A lista é o contrato entre o auth-service (que
 * decide) e a aplicação (que apenas consulta). Nenhuma rota compara `role`
 * com "admin": a pergunta é sempre "tem a permissão?".
 */
export type Permissao =
  | "ler:musica"
  | "criar:musica"
  | "editar:musica"
  | "apagar:musica"
  | "gerenciar:playlist"
  | "compartilhar:musica"
  | "listar:usuarios"
  | "alterar:papel"
  | "consultar:logs"
  | "ver:faturamento";

/**
 * Dados que o middleware de autenticação deixa no contexto. Tudo veio do
 * auth-service no `GET /me`; nada foi decodificado localmente.
 */
export type Env = {
  Variables: {
    usuarioId: number;
    role: Papel;
    nome: string;
    email: string;
    premium: boolean;
    permissoes: Permissao[];
  };
};
