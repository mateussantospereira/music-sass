/**
 * O MAPA DE PERMISSÕES — a única fonte de verdade sobre "quem pode o quê".
 *
 * O auth-service é o dono da identidade e, por consequência, da política de
 * acesso. O app do Riff (container `app`) NÃO tem este mapa: ele recebe a
 * lista pronta no `GET /me` e apenas consulta. Trocar o que um papel pode fazer
 * é uma mudança neste arquivo — não em cada rota.
 *
 * Papéis do negócio:
 *
 *   curador -> adiciona músicas por URL do YouTube, organiza a
 *              própria biblioteca, cria playlists e compartilha com ouvintes
 *   ouvinte -> só enxerga o que foi compartilhado com ele; ouve e baixa,
 *              e pode montar playlists a partir do que tem acesso
 *   admin   -> administra o SaaS inteiro (usuários, papéis, logs e músicas)
 *
 * Um papel desconhecido no banco NUNCA vira admin: cai para o menor privilégio
 * (`ouvinte`), porque conceder por acidente é pior do que negar por engano.
 */

/** Papel de um usuário. */
export type Papel = "admin" | "curador" | "ouvinte";

/**
 * Uma permissão é "uma ação sobre um recurso", escrita como `acao:recurso`.
 * Estes nomes são o contrato entre o auth-service e o app.
 */
export type Permissao =
  /** Ler músicas que a regra de visibilidade permite. */
  | "ler:musica"
  /** Adicionar uma música pela URL (extração no servidor). */
  | "criar:musica"
  /** Editar metadados de uma música sua (admin: qualquer música). */
  | "editar:musica"
  /** Apagar uma música sua (admin: qualquer música). */
  | "apagar:musica"
  /** Criar, editar e apagar playlists próprias. */
  | "gerenciar:playlist"
  /** Compartilhar músicas/playlists com ouvintes. */
  | "compartilhar:musica"
  /** Listar todos os usuários do sistema. Exclusivo de admin. */
  | "listar:usuarios"
  /** Promover/rebaixar o papel de outro usuário. Exclusivo de admin. */
  | "alterar:papel"
  /** Consultar o stream de auditoria. Exclusivo de admin. */
  | "consultar:logs";

/**
 * O que cada papel pode fazer.
 *
 * `admin` CONTÉM as permissões operacionais: promover alguém não faz a pessoa
 * deixar de conseguir trabalhar. O que é exclusivo do admin são as permissões
 * administrativas (`listar:usuarios`, `alterar:papel`, `consultar:logs`).
 */
const POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  curador: [
    "ler:musica",
    "criar:musica",
    "editar:musica",
    "apagar:musica",
    "gerenciar:playlist",
    "compartilhar:musica",
  ],
  ouvinte: ["ler:musica", "gerenciar:playlist"],
  admin: [
    "ler:musica",
    "criar:musica",
    "editar:musica",
    "apagar:musica",
    "gerenciar:playlist",
    "compartilhar:musica",
    "listar:usuarios",
    "alterar:papel",
    "consultar:logs",
  ],
} as const;

/** Papel de fallback: menor privilégio. Nunca concede por omissão. */
const PAPEL_PADRAO: Papel = "ouvinte";

/** Normaliza um papel vindo do banco (ou de um corpo HTTP). */
export function papelValido(role: unknown): Papel | null {
  const papel = String(role ?? "") as Papel;
  return papel in POR_PAPEL ? papel : null;
}

/**
 * Converte um papel guardado no banco na lista de permissões dele.
 *
 * FALHA PARA O MENOR PRIVILÉGIO: papel desconhecido ou corrompido vira
 * `ouvinte` (leitura do que lhe é compartilhado), nunca `admin`.
 */
export function permissoesDe(role: unknown): Permissao[] {
  const papel = papelValido(role) ?? PAPEL_PADRAO;
  return [...POR_PAPEL[papel]];
}

/** Pergunta rápida: esse papel tem essa permissão? */
export function temPermissao(role: unknown, permissao: Permissao): boolean {
  const papel = papelValido(role) ?? PAPEL_PADRAO;
  return POR_PAPEL[papel].includes(permissao);
}
