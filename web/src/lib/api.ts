const TOKEN_KEY = "riff_token";

export function obterToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function salvarToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removerToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export type ApiResposta<T = unknown> = { ok: boolean; status: number; data: T | null };

/** fetch JSON contra a API do Riff, sempre com Authorization quando houver token. */
export async function api<T = unknown>(
  path: string,
  opcoes: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<ApiResposta<T>> {
  const token = obterToken();
  const headers: Record<string, string> = { ...(opcoes.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opcoes.body !== undefined) headers["Content-Type"] = "application/json";

  let resposta: Response;
  try {
    resposta = await fetch(path, {
      method: opcoes.method ?? (opcoes.body !== undefined ? "POST" : "GET"),
      headers,
      body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null };
  }

  const dados = (await resposta.json().catch(() => null)) as T | null;
  return { ok: resposta.ok, status: resposta.status, data: dados };
}

/** URL de stream com o token na query (a tag <audio> não envia header). */
export function urlComToken(path: string): string {
  const token = obterToken();
  const sep = path.includes("?") ? "&" : "?";
  return token ? `${path}${sep}token=${encodeURIComponent(token)}` : path;
}
