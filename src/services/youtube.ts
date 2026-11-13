/**
 * Extração de áudio a partir de uma URL (YouTube) via yt-dlp.
 *
 * O Riff não "baixa por dentro do navegador": a extração roda no servidor
 * (container `app`), o áudio é enviado ao MinIO e a chave fica ligada ao
 * registro `musicas`. Quem chama as funções passa a URL validada e recebe o
 * caminho do arquivo temporário ou a promessa de um resultado.
 *
 * yt-dlp + ffmpeg são instalados na imagem do app (veja Dockerfile). Se não
 * estiverem disponíveis, a extração falha com mensagem clara e a música fica
 * com `status = 'erro'`.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export type UrlSuportada = { url: string; plataforma: "youtube" };

const HOSTS_YOUTUBE = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

/** Aceita apenas URLs do YouTube (watch, youtu.be, shorts). */
export function validarUrlYouTube(bruta: unknown): UrlSuportada | null {
  if (typeof bruta !== "string") return null;
  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (HOSTS_YOUTUBE.has(host)) return { url: url.toString(), plataforma: "youtube" };
  if (host === "youtu.be") return { url: url.toString(), plataforma: "youtube" };
  return null;
}

export type InfoVideo = {
  titulo: string;
  artista: string | null;
  duracaoSeg: number | null;
  thumbnail: string | null;
};

function executar(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  const timeoutMs = opts.timeoutMs ?? 120_000;

  return new Promise((resolver, rejeitar) => {
    const filho = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      filho.kill("SIGKILL");
      rejeitar(new Error(`${cmd} excedeu o tempo limite de ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    filho.stdout.on("data", (d) => (stdout += d));
    filho.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 64_000) stderr = stderr.slice(-64_000);
    });
    filho.on("error", (erro) => {
      clearTimeout(timer);
      rejeitar(erro);
    });
    filho.on("close", (code) => {
      clearTimeout(timer);
      resolver({ stdout, stderr, code: code ?? -1 });
    });
  });
}

/** Só metadados (rápido): título, canal, duração e capa. */
export async function extrairMetadados(url: string): Promise<InfoVideo> {
  const { stdout, stderr, code } = await executar(
    "yt-dlp",
    ["--no-playlist", "--skip-download", "--dump-single-json", "--no-warnings", url],
    { timeoutMs: 60_000 }
  );
  if (code !== 0) {
    throw new Error(limparErroYtdlp(stderr) || `yt-dlp terminou com código ${code}`);
  }

  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    throw new Error("yt-dlp devolveu metadados inválidos.");
  }

  const titulo = String(dados.title ?? "Sem título").slice(0, 200);
  const artista = dados.artist ?? dados.uploader ?? dados.channel ?? null;
  const duracaoSeg = Number.isFinite(Number(dados.duration)) ? Math.round(Number(dados.duration)) : null;
  const thumbnail = typeof dados.thumbnail === "string" ? dados.thumbnail : null;

  return { titulo, artista: artista ? String(artista).slice(0, 200) : null, duracaoSeg, thumbnail };
}

/** Baixa o áudio como .m4a (AAC) e devolve bytes + caminho temporário. */
export async function baixarAudio(url: string): Promise<{ bytes: Buffer; ext: "m4a"; fileName: string }> {
  const dir = await mkdtemp(join(tmpdir(), "riff-"));
  const destino = join(dir, "audio.%(ext)s");

  try {
    const { stderr, code } = await executar(
      "yt-dlp",
      [
        "--no-playlist",
        "-x",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "-o", destino,
        url,
      ],
      { timeoutMs: 240_000 }
    );
    if (code !== 0) {
      throw new Error(limparErroYtdlp(stderr) || `yt-dlp terminou com código ${code}`);
    }

    const arquivo = join(dir, "audio.m4a");
    const bytes = await readFile(arquivo).catch(() => readFile(join(dir, "audio.mp4")));
    if (!bytes || bytes.length === 0) {
      throw new Error("Extração concluída, mas o arquivo de áudio não foi encontrado.");
    }

    return { bytes, ext: "m4a", fileName: "audio.m4a" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Baixa a capa (thumbnail) como bytes, se houver. */
export async function baixarCapa(url: string): Promise<{ bytes: Buffer; contentType: string; ext: string } | null> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!resposta.ok) return null;
    const contentType = resposta.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length === 0) return null;
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    return { bytes, contentType, ext };
  } catch {
    return null;
  }
}

/** Reduz o ruído do yt-dlp a uma linha útil para o usuário. */
function limparErroYtdlp(stderr: string): string {
  const linha = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.includes("ERROR:"));
  if (!linha) return stderr.split("\n").filter(Boolean).pop()?.slice(0, 300) ?? "";
  return linha.replace(/^ERROR:\s*/i, "").slice(0, 300);
}
