/**
 * Object storage (MinIO) — arquivos do Riff (áudio e capas).
 *
 * O binário vai para o MinIO; o MariaDB guarda só as chaves em
 * `musicas.chave_audio` e `musicas.chave_capa`. O navegador nunca fala com o
 * MinIO: a aplicação serve os bytes pela rota autenticada do recurso, que
 * confere dono/compartilhamento antes de devolver qualquer coisa.
 *
 * Falha do MinIO nunca derruba o app: as rotas devolvem 503 e o restante do
 * sistema continua funcionando.
 */

import { Client } from "minio";

const URL_RAW = (process.env.MINIO_ENDPOINT ?? "http://127.0.0.1:9000").replace(/\/+$/, "");
const useSSL = URL_RAW.startsWith("https://");
const SEM_PROTOCOLO = URL_RAW.replace(/^https?:\/\//, "");
const [endPoint, portaTexto] = SEM_PROTOCOLO.split(":");

export const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "riff-midias";

const cliente = new Client({
  endPoint,
  port: portaTexto ? Number(portaTexto) : useSSL ? 443 : 80,
  useSSL,
  accessKey: process.env.MINIO_ROOT_USER ?? "",
  secretKey: process.env.MINIO_ROOT_PASSWORD ?? "",
});

export async function garantirBucket(): Promise<void> {
  try {
    if (!(await cliente.bucketExists(MINIO_BUCKET))) {
      await cliente.makeBucket(MINIO_BUCKET, "us-east-1");
      console.log(`[minio] bucket "${MINIO_BUCKET}" criado`);
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`bucket inacessível (${motivo})`);
  }
}

/** Remove qualquer coisa que possa virar caminho dentro da chave do objeto. */
function nomeSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

export type ExtensaoAudio = "m4a" | "mp3" | "opus" | "webm" | "ogg" | "wav";

const CONTENT_TYPE_AUDIO: Record<ExtensaoAudio, string> = {
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  opus: "audio/opus",
  webm: "audio/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export function contentTypeAudio(ext: ExtensaoAudio): string {
  return CONTENT_TYPE_AUDIO[ext];
}

export async function enviarAudio(
  usuarioId: number,
  musicaId: number,
  nomeArquivo: string,
  bytes: Buffer,
  ext: ExtensaoAudio
): Promise<string> {
  await garantirBucket();
  const chave = `musicas/${usuarioId}/${musicaId}/${Date.now()}-${nomeSeguro(nomeArquivo) || `audio.${ext}`}`;
  await cliente.putObject(MINIO_BUCKET, chave, bytes, bytes.length, {
    "Content-Type": CONTENT_TYPE_AUDIO[ext],
  });
  return chave;
}

export async function enviarCapa(
  usuarioId: number,
  musicaId: number,
  bytes: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  await garantirBucket();
  const chave = `capas/${usuarioId}/${musicaId}/${Date.now()}-capa.${nomeSeguro(ext) || "jpg"}`;
  await cliente.putObject(MINIO_BUCKET, chave, bytes, bytes.length, {
    "Content-Type": contentType,
  });
  return chave;
}

export async function removerObjeto(chave: string | null | undefined): Promise<void> {
  if (!chave) return;
  try {
    await cliente.removeObject(MINIO_BUCKET, chave);
  } catch {
    // A chave já pode não existir. Não impedir a exclusão do registro por isso.
  }
}

export type ObjetoLido = { bytes: Buffer; contentType: string };

export async function obterObjeto(chave: string): Promise<ObjetoLido | null> {
  try {
    const stat = await cliente.statObject(MINIO_BUCKET, chave);
    const stream = await cliente.getObject(MINIO_BUCKET, chave);
    const partes: Buffer[] = [];
    for await (const parte of stream as AsyncIterable<Buffer>) {
      partes.push(Buffer.from(parte));
    }
    return {
      bytes: Buffer.concat(partes),
      contentType: stat.metaData?.["content-type"] ?? "application/octet-stream",
    };
  } catch (erro: any) {
    if (erro?.code === "NoSuchKey" || erro?.message?.includes("NoSuchKey")) return null;
    throw erro;
  }
}
