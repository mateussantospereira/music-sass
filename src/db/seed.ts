/**
 * Seed da demonstração Riff.
 *
 * Executa `db/003_seed.sql` (contas, músicas de demo, playlist e
 * compartilhamentos) e, em seguida, envia os áudios de demonstração para o
 * bucket do MinIO (chaves `demo/*.wav` referenciadas pelo seed). É
 * idempotente: `ON DUPLICATE KEY`/`INSERT IGNORE` evitam duplicidade no
 * banco, e o `putObject` apenas sobrescreve o mesmo objeto no MinIO.
 *
 *   bun run db:seed
 *
 * Para o áudio chegar ao bucket, o seed precisa enxergar o MinIO (é o caso
 * quando roda de dentro da rede Docker). Se o MinIO não estiver acessível a
 * partir daqui, o SQL já foi aplicado e o upload pode ser feito depois, de
 * um host na rede interna (ex.: `docker exec` no app).
 *
 * Credenciais (documentadas no README):
 *   admin@riff.app    / Admin@123
 *   curador@riff.app  / Curador@123
 *   ouvinte@riff.app  / Ouvinte@123
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

const RAIZ = join(import.meta.dir, "..", "..");
const ARQUIVO = join(RAIZ, "db", "003_seed.sql");
const AUDIOS = join(RAIZ, "seed-audio");
const BUCKET = process.env.MINIO_BUCKET ?? "riff-midias";

function separarComandos(texto: string): string[] {
  return texto
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((comando) => comando.trim())
    .filter(Boolean);
}

const conexao = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

try {
  const comandos = separarComandos(await readFile(ARQUIVO, "utf8"));
  console.log(`[seed] ${comandos.length} comando(s) em db/003_seed.sql`);

  for (const comando of comandos) {
    await conexao.query(comando);
    console.log(`  [ok] ${comando.split("\n")[0].slice(0, 80)}`);
  }

  const [usuarios] = await conexao.query<mysql.RowDataPacket[]>(
    `SELECT nome, email, role, premium FROM usuarios
      WHERE email IN ('admin@riff.app','curador@riff.app','ouvinte@riff.app')
      ORDER BY id`
  );
  console.log("\n[seed] contas de demonstração:");
  for (const u of usuarios) {
    console.log(`  - ${u.email} (${u.role}${u.premium ? ", pro" : ", grátis"})`);
  }
} catch (erro) {
  console.error("[seed] falhou:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await conexao.end();
}

/* --------------------------- áudio no MinIO ------------------------------ */

async function enviarAudiosDeDemo(): Promise<void> {
  if (!existsSync(AUDIOS)) {
    console.log("\n[seed] diretório seed-audio/ ausente; áudio de demo não enviado.");
    return;
  }

  const { Client } = await import("minio");
  const bruto = (process.env.MINIO_ENDPOINT ?? "http://localhost:9000").replace(/\/+$/, "");
  const useSSL = bruto.startsWith("https://");
  const semProtocolo = bruto.replace(/^https?:\/\//, "");
  const [endPoint, portaTexto] = semProtocolo.split(":");

  const cliente = new Client({
    endPoint,
    port: portaTexto ? Number(portaTexto) : useSSL ? 443 : 80,
    useSSL,
    accessKey: process.env.MINIO_ROOT_USER ?? "",
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? "",
  });

  try {
    if (!(await cliente.bucketExists(BUCKET))) {
      await cliente.makeBucket(BUCKET, "us-east-1");
      console.log(`\n[seed] bucket "${BUCKET}" criado.`);
    }
    const arquivos = (await readdir(AUDIOS)).filter((n) => n.endsWith(".wav"));
    for (const arquivo of arquivos) {
      const bytes = await readFile(join(AUDIOS, arquivo));
      await cliente.putObject(BUCKET, `demo/${arquivo}`, bytes, bytes.length, {
        "Content-Type": "audio/wav",
      });
      console.log(`[seed] enviado demo/${arquivo} (${bytes.length} bytes)`);
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error(`\n[seed] MinIO indisponível (${motivo}).`);
    console.error("[seed] SQL aplicado; rode `bun run db:seed` de dentro da rede para enviar o áudio.");
  }
}

await enviarAudiosDeDemo();
console.log("\n[seed] pronto. Senhas: Admin@123, Curador@123, Ouvinte@123.");
