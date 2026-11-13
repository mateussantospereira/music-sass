/**
 * Cliente HTTP do auth-service.
 *
 * O Riff não tem bcrypt, JWT_SECRET nem tabela de usuários. Quem sabe
 * "quem é você" e "o que você pode" é o auth-service. Toda chamada abaixo é
 * tráfego interno da rede Docker; o navegador nunca alcança o auth-service.
 */

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL ?? "http://auth-service:3000").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.AUTH_SERVICE_TIMEOUT_MS ?? 5000);

export const MENSAGEM_INDISPONIVEL =
  "Serviço de autenticação indisponível. Tente novamente em instantes.";

export type Papel = "admin" | "curador" | "ouvinte";

export type Sessao = {
  usuarioId: number;
  nome: string;
  email: string;
  role: Papel;
  premium: boolean;
  permissoes: import("../types").Permissao[];
};

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string };

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<Resultado<T>> {
  let resposta: Response;

  try {
    resposta = await fetch(`${AUTH_SERVICE_URL}${caminho}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auth-service] ${caminho} falhou (${AUTH_SERVICE_URL}): ${motivo}`);
    return { ok: false, status: 503, erro: MENSAGEM_INDISPONIVEL };
  }

  const corpo = (await resposta.json().catch(() => null)) as { error?: string } | T | null;

  if (!resposta.ok) {
    return {
      ok: false,
      status: resposta.status,
      erro: (corpo as { error?: string })?.error ?? "Falha na autenticação",
    };
  }

  return { ok: true, dados: corpo as T };
}

function post<T>(
  caminho: string,
  corpo: unknown,
  token?: string,
  extras?: Record<string, string>
): Promise<Resultado<T>> {
  return chamar<T>(caminho, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extras ?? {}) },
  });
}

export const registrar = (dados: { nome: string; email: string; senha: string }) =>
  post<{ message: string }>("/register", dados);

export const login = (email: string, senha: string, ip?: string | null) =>
  post<{ token: string; nome: string; role: Papel }>(
    "/login",
    { email, senha },
    undefined,
    ip ? { "x-forwarded-for": ip } : undefined
  );

export const encerrarSessao = (token: string, ip?: string | null) =>
  post<{ message: string }>("/logout", {}, token, ip ? { "x-forwarded-for": ip } : undefined);

export const sessao = (token: string): Promise<Resultado<Sessao>> =>
  chamar<Sessao>("/me", { headers: { Authorization: `Bearer ${token}` } });

export const esquecerSenha = (email: string) =>
  post<{ message: string }>("/forgot-password", { email });

export const trocarSenha = (token: string, novaSenha: string) =>
  post<{ message: string }>("/reset-password", { token, novaSenha });

export type UsuarioLista = {
  id: number;
  nome: string;
  email: string;
  role: Papel;
  premium: boolean;
  criadoEm: string | null;
};

export const listarUsuarios = (token: string) =>
  chamar<{ usuarios: UsuarioLista[]; total: number }>("/usuarios", {
    headers: { Authorization: `Bearer ${token}` },
  });

export const alterarPapel = (token: string, usuarioId: number, role: Papel) =>
  chamar<{ message: string }>(`/usuarios/${usuarioId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    headers: { Authorization: `Bearer ${token}` },
  });

/** GET /usuarios/:id/perfil-publico — identidade mínima, sem e-mail/senha. */
export const perfilPublico = (token: string, usuarioId: number) =>
  chamar<{ id: number; nome: string; role: Papel; premium: boolean }>(
    `/usuarios/${usuarioId}/perfil-publico`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

/**
 * Chamada interna: depois do webhook do Stripe, o app pede ao dono da
 * identidade para marcar `usuarios.premium`. A rota é autenticada pelo
 * segredo compartilhado, não por JWT.
 */
export const definirPremium = (
  usuarioId: number,
  premium: boolean
): Promise<Resultado<{ message: string; usuario: { id: number; premium: boolean } }>> => {
  const tokenInterno = process.env.INTERNAL_SYNC_TOKEN?.trim() ?? "";

  if (!tokenInterno) {
    return Promise.resolve({
      ok: false,
      status: 503,
      erro: "Sincronização interna não configurada (INTERNAL_SYNC_TOKEN ausente).",
    });
  }

  return chamar(`/interno/usuarios/${usuarioId}/premium`, {
    method: "POST",
    body: JSON.stringify({ premium }),
    headers: { "x-internal-token": tokenInterno },
  });
};
