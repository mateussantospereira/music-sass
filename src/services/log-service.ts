/**
 * Cliente HTTP do log-service.
 *
 * `registrar()` é sempre aguardado (para o evento aparecer logo na auditoria),
 * tem timeout curto e NUNCA lança exceção. Log é serviço de apoio: se ele
 * cair, a música não pode deixar de ser criada junto.
 */

const LOG_SERVICE_URL = (process.env.LOG_SERVICE_URL ?? "http://log-service:3000").replace(/\/+$/, "");
const TIMEOUT_GRAVACAO_MS = Number(process.env.LOG_SERVICE_TIMEOUT_MS ?? 1000);
const TIMEOUT_LEITURA_MS = Number(process.env.LOG_SERVICE_LEITURA_TIMEOUT_MS ?? 5000);

export type EventoAuditoria = {
  acao: string;
  usuario_id?: number | null;
  usuario?: string | null;
  papel?: string | null;
  recurso?: string | null;
  detalhe?: string | null;
  ip?: string | null;
};

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string };

export function ipDe(c: { req: { header: (nome: string) => string | undefined } }): string | null {
  const direto = c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip");
  if (direto) return direto.trim();
  const lista = c.req.header("x-forwarded-for");
  if (lista) return lista.split(",")[0].trim();
  return null;
}

export async function registrar(evento: EventoAuditoria): Promise<void> {
  try {
    const resposta = await fetch(`${LOG_SERVICE_URL}/eventos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LOG_INGEST_TOKEN ? { "x-log-token": process.env.LOG_INGEST_TOKEN } : {}),
      },
      body: JSON.stringify({ ...evento, origem: "app" }),
      signal: AbortSignal.timeout(TIMEOUT_GRAVACAO_MS),
    });

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
      console.error(
        `[auditoria] log-service recusou "${evento.acao}": ${resposta.status} ${corpo?.error ?? ""}`.trim()
      );
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[auditoria] não consegui gravar "${evento.acao}": ${motivo}`);
  }
}

export async function consultarLogs(
  token: string,
  limite: number,
  ip?: string | null
): Promise<Resultado<unknown>> {
  let resposta: Response;

  try {
    resposta = await fetch(`${LOG_SERVICE_URL}/logs?limite=${encodeURIComponent(limite)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_LEITURA_MS),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`[log-service] /logs falhou (${LOG_SERVICE_URL}): ${motivo}`);
    return { ok: false, status: 503, erro: "Serviço de logs indisponível." };
  }

  const corpo = (await resposta.json().catch(() => null)) as { error?: string } | unknown;

  if (!resposta.ok) {
    return {
      ok: false,
      status: resposta.status,
      erro: (corpo as { error?: string })?.error ?? "Falha ao consultar os logs",
    };
  }

  return { ok: true, dados: corpo };
}
