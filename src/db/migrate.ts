/**
 * Migrações do Riff.
 *
 * Roda os arquivos `db/*.sql` em ordem — a mesma fonte versionada que qualquer
 * pessoa usa para recriar o banco do zero. O alvo vem das variáveis DB_*.
 *
 *   bun run db:migrate
 *
 * O script NÃO é um `db:push`: ele só executa DDL idempotente (`CREATE TABLE
 * IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Rodar duas vezes não apaga
 * dado nenhum e não altera registros de negócio.
 *
 * O `000_limpar_legado.sql` roda primeiro e remove as tabelas do projeto
 * antigo. Se você quiser preservar o banco de filmes para inspeção, execute
 * os arquivos 001 e 002 manualmente, em vez de rodar o 000.
 */

import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import mysql from "mysql2/promise";

const DIRETORIO_SQL = join(import.meta.dir, "..", "..", "db");
const ARQUIVO_SEED = "003_seed.sql";

const JA_EXISTIA = new Set([
  "ER_DUP_FIELDNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_KEYNAME",
]);

function separarComandos(texto: string): string[] {
  return texto
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((comando) => comando.trim())
    .filter(Boolean);
}

function resumo(comando: string): string {
  const linha = comando.split("\n")[0].replace(/\s+/g, " ").trim();
  return linha.length > 72 ? `${linha.slice(0, 72)}...` : linha;
}

function mensagemReal(erro: unknown): string {
  const e = erro as {
    message?: string;
    sqlMessage?: string;
    code?: string;
    cause?: { message?: string; sqlMessage?: string; code?: string };
  };
  return e.cause?.sqlMessage ?? e.cause?.message ?? e.sqlMessage ?? e.message ?? String(erro);
}

function codigoReal(erro: unknown): string {
  const e = erro as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code ?? "";
}

async function main(): Promise<number> {
  const arquivos = (await readdir(DIRETORIO_SQL))
    .filter((nome) => nome.endsWith(".sql") && nome !== ARQUIVO_SEED)
    .sort();

  if (arquivos.length === 0) {
    console.error("[migrate] nenhum arquivo .sql encontrado em db/");
    return 1;
  }

  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  console.log(
    `[migrate] alvo: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  );
  console.log(`[migrate] arquivos: ${arquivos.join(", ")}\n`);

  try {
    for (const arquivo of arquivos) {
      const comandos = separarComandos(await readFile(join(DIRETORIO_SQL, arquivo), "utf8"));
      console.log(`[migrate] ${comandos.length} comando(s) em ${basename(arquivo)}`);

      for (const comando of comandos) {
        try {
          await conexao.query(comando);
          console.log(`  [aplicado]   ${resumo(comando)}`);
        } catch (erro) {
          const codigo = codigoReal(erro);
          if (JA_EXISTIA.has(codigo)) {
            console.log(`  [já existia] ${resumo(comando)}`);
            continue;
          }
          console.error(`\n  [FALHOU]     ${resumo(comando)}`);
          throw erro;
        }
      }
      console.log("");
    }

    const [linhas] = await conexao.query<mysql.RowDataPacket[]>(
      `SELECT table_name AS nome
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('musicas','playlists','playlist_musicas','compartilhamentos','assinaturas','usuarios','reset_tokens')
        ORDER BY table_name`
    );

    console.log(`[migrate] tabelas presentes: ${linhas.map((l) => l.nome).join(", ")}`);
    console.log("[migrate] pronto. Para popular a demonstração: bun run db:seed");
    return 0;
  } finally {
    await conexao.end();
  }
}

let codigoSaida = 1;
try {
  codigoSaida = await main();
} catch (erro) {
  console.error(`\n[migrate] ERRO (${codigoReal(erro) || "sem código"}): ${mensagemReal(erro)}`);
  console.error("[migrate] nenhuma alteração posterior foi executada.");
} finally {
  process.exit(codigoSaida);
}
