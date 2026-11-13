/**
 * Cache de áudio no navegador — como o YouTube.
 *
 * Depois de reproduzida, a faixa fica guardada no Cache Storage do navegador
 * (`riff-audio-v1`). Nas próximas vezes o player toca direto do cache, sem
 * ir ao servidor. O cache é limpo sozinho, com dois limites:
 *
 *   - validade de 7 dias desde a reprodução;
 *   - tamanho máximo de 80 MB (as mais antigas saem primeiro — LRU).
 *
 * O navegador do cliente é quem armazena; nada é baixado para o disco como
 * arquivo pela interface. O servidor continua autenticando e autorizando o
 * stream — o cache só evita refazer essa leitura em reexecuções locais.
 */

const CACHE_NAME = "riff-audio-v1";
const MAX_BYTES = 80 * 1024 * 1024;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const chave = (id: number) => `/__riff/audio/${id}`;

export async function audioCacheDisponivel(): Promise<boolean> {
  try {
    return typeof caches !== "undefined" && (await caches.keys()) !== undefined;
  } catch {
    return false;
  }
}

/** URL local da faixa (object URL) ou `null` quando não há cache válido. */
export async function getCachedAudioUrl(id: number): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(chave(id));
    if (!res) return null;
    const cachedAt = Number(res.headers.get("x-cached-at") ?? 0);
    if (!cachedAt || Date.now() - cachedAt > MAX_AGE_MS) {
      await cache.delete(chave(id));
      return null;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Guarda os bytes no cache e já aplica a política de limpeza. */
export async function cacheAudio(id: number, bytes: Blob, contentType: string | null): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const headers = new Headers({
      "x-cached-at": String(Date.now()),
      "x-track-id": String(id),
      "Content-Type": contentType ?? "application/octet-stream",
    });
    await cache.put(chave(id), new Response(bytes, { headers }));
    await pruneAudioCache();
  } catch {
    // Sem espaço ou sem suporte — o player segue sem cache.
  }
}

/** Remove expirados e os mais antigos até o cache voltar para o limite. */
export async function pruneAudioCache(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const reqs = await cache.keys();
    const itens: { req: Request; at: number; size: number }[] = [];

    for (const req of reqs) {
      const res = await cache.match(req);
      if (!res) continue;
      const at = Number(res.headers.get("x-cached-at") ?? 0);
      if (!at || Date.now() - at > MAX_AGE_MS) {
        await cache.delete(req);
        continue;
      }
      let size = Number(res.headers.get("content-length") ?? 0);
      if (!size) size = (await res.clone().blob()).size;
      itens.push({ req, at, size });
    }

    let total = itens.reduce((soma, i) => soma + i.size, 0);
    itens.sort((a, b) => a.at - b.at);
    while (total > MAX_BYTES && itens.length > 0) {
      const antigo = itens.shift()!;
      await cache.delete(antigo.req);
      total -= antigo.size;
    }
  } catch {
    // Nunca pode quebrar o player.
  }
}

/** Limpeza manual (botão na barra superior). */
export async function clearAudioCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // ignorado
  }
}
