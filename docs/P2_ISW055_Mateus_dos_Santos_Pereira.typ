// ============================================================
//  P2 — Relatório consolidado: arquitetura e atividades
//  ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
//  Compilar: typst compile P2_ISW055_Mateus_dos_Santos_Pereira.typ
// ============================================================

#let aluno = "Mateus dos Santos Pereira"
#let turma = "161_SIST. INTELIGENTES_N"
#let data-relatorio = "13/11/2026"
#let disciplina = "Introdução à Computação em Nuvem"
#let codigo = "ISW055"
#let professor = "Prof. Allan Lincoln Rodrigues Siriani"
#let accent = rgb("#b96f1f")

#set document(title: "P2 — " + codigo + " — " + aluno, author: aluno)
#set page(paper: "a4", margin: (top: 2.3cm, bottom: 2.3cm, left: 2.4cm, right: 2cm))
#set text(size: 10.5pt, lang: "pt", region: "BR")
#set par(justify: true, leading: 0.68em)
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { v(0.55em); text(size: 15pt, it); v(0.18em) }
#show heading.where(level: 2): it => { v(0.45em); text(size: 12pt, it); v(0.08em) }
#show heading.where(level: 3): it => { v(0.35em); text(size: 10.5pt, it); v(0.05em) }
#show link: set text(fill: accent)
#show figure.caption: set text(size: 8.5pt, fill: luma(90))
#set figure(gap: 0.35em)
#set table(stroke: 0.5pt + luma(200), inset: 5pt)
#show table: set text(hyphenate: false)
#show table: set par(justify: false)

#let evidencia(legenda, arquivo: none, largura: 88%) = figure(
  if arquivo == none {
    rect(width: 100%, height: 5cm, radius: 4pt, stroke: (paint: luma(170), dash: "dashed"))[
      #align(center + horizon)[
        #text(fill: luma(130), size: 9pt)[print pendente — troque `arquivo: none`]
      ]
    ]
  } else {
    image(arquivo, width: largura)
  },
  caption: legenda,
)

#let registro = state("registro", ())

#let atividade(numero, titulo, descricao: "", planejada: "", realizada: "—", situacao: "entregue", evidencia: "", url: "", corpo) = {
  registro.update(l => l + ((numero: numero, titulo: titulo, descricao: descricao, planejada: planejada, realizada: realizada, situacao: situacao),))
  heading(level: 2, [Atividade #numero — #titulo])
  table(
    columns: (3.4cm, 1fr),
    fill: (x, y) => if x == 0 { luma(245) } else { none },
    [*Descrição*], [#descricao],
    [*Data planejada*], [#planejada],
    [*Data realizada*], [#realizada],
    [*Situação*], [#situacao],
    [*Evidência*], [#evidencia],
    [*Link*], [#if url == "" [—] else [#link(url)]],
  )
  corpo
}

#align(center)[
  #v(2.2cm)
  #text(size: 11pt, tracking: 0.12em)[FATEC POMPEIA]
  #v(0.4em)
  #text(size: 10pt, fill: luma(110))[#disciplina · #codigo · #turma]
  #v(4cm)
  #text(size: 26pt, weight: "bold")[P2]
  #v(0.3em)
  #text(size: 17pt, weight: "bold")[Relatório consolidado: arquitetura e atividades]
  #v(0.8em)
  #text(size: 11pt, fill: luma(110))[Avaliação individual · 2026.2]
  #v(4cm)
  #text(size: 14pt)[#aluno]
  #v(1fr)
  #text(size: 10.5pt)[#professor \
  Pompeia, #data-relatorio]
]

#set page(
  numbering: "1",
  number-align: right,
  header: context {
    set text(size: 8pt, fill: luma(115))
    [#codigo · P2 — Arquitetura e atividades #h(1fr) #aluno]
    line(length: 100%, stroke: 0.4pt + luma(200))
  },
)
#counter(page).update(1)

#outline(title: "Sumário", indent: 1.2em, depth: 2)
#pagebreak()

= Introdução
Na disciplina ISW055 — *Introdução à Computação em Nuvem*, da Fatec Pompeia, o bimestre anterior construiu um catálogo de filmes do Tom Hanks que virou um sistema completo, com autenticação, papéis, auditoria, object storage e publicação em produção. Neste segundo bimestre, esse sistema passou de projeto de atividade para SaaS de verdade — e foi para um novo repositório.

O produto agora é o *Riff*, um SaaS de música por assinatura. O usuário cola a URL de um vídeo, o áudio é processado no servidor, o arquivo fica no MinIO e a biblioteca é pessoal: cada conta adiciona, busca, ouve e remove apenas as próprias faixas — e, se quiser, compartilha explicitamente com outra conta. O plano Pro é cobrado mensalmente pelo Stripe em modo de teste, e quem está no plano gratuito para em dez músicas.

Este relatório tem duas metades. A primeira é a arquitetura do sistema que está no ar hoje: componentes, onde roda, fluxo de uma requisição, fluxo de assinatura, modelo de dados, segurança e as camadas IaaS/PaaS/SaaS — descreve o produto publicado, não um projeto ideal. A segunda são cinco fichas, uma por atividade, de 7 a 11, com a data planejada, a data realizada, o que foi feito, os prints e a honestidade sobre o que aconteceu. O quadro de entregas (seção 4) é gerado a partir das fichas (seção 5).

= Metodologia
As atividades 7 e 8 foram executadas no repositório antigo (`mateussantospereira/filmes-tom-hanks`); da atividade 9 em diante, no novo (`mateussantospereira/music-sass`), criado a partir dele. O ambiente é o mesmo de sempre: Bun + Hono nas APIs, React + Tailwind no frontend, MariaDB externo à VM, containers com a stack do Portainer 22 (projeto `filmel-tom-hanks`) no subdomínio público da disciplina, https://mateus-pereira-isw055.lapps.studio. Tudo foi feito individualmente. Durante o percurso eu também usei ferramentas de IA (assistentes de código e chat) como apoio: para escrever trechos de código, achar erros, entender conceitos e organizar este relatório. As decisões, a validação e o conteúdo final foram todos meus — a IA foi uma ferramenta de apoio, não a autora das entregas.

As datas e horas de cada entrega foram tiradas do histórico do git (`git log --date=format`, author date em UTC−03:00, America/Sao_Paulo) e conferidas nas páginas dos commits no GitHub; quando existem issues de entrega, elas exibem a data e a hora de abertura. Os prints deste relatório são reais: foram capturados contra o ambiente em produção ou renderizados a partir da saída literal dos comandos `git log` e das respostas HTTP auditáveis citadas em cada ficha; os links dos repositórios, issues e commits verificam tudo.

= Arquitetura do SaaS
Descreve o sistema que está no ar em https://mateus-pereira-isw055.lapps.studio (stack do Portainer 22, projeto `filmel-tom-hanks`), não um projeto ideal. Onde algo não existe, está escrito como não existe.

== Componentes
O Riff é dividido em cinco containers num único ponto de entrada público. A rede `interna` usa a sub-rede 10.241.55.0/24; nada, além do `app`, publica porta.

#evidencia([componentes do Riff no ar — o navegador só conhece o domínio; o resto existe dentro da rede `interna`], arquivo: "prints/diagrama-arquitetura.png")

- *`app`* (Hono + Bun) — único container com porta publicada (8222). Serve a SPA React e a API: músicas, playlists, assinatura; extrai o áudio do YouTube em segundo plano (server); faz streaming autenticado de áudio e capas (`GET /api/musicas/:id/stream`, token por query por causa do `<audio>`). Conversa com auth-service, log-service, MariaDB e MinIO.
- *`auth-service`* (Hono + Bun) — fonte única de verdade para usuários, senhas, JWT, papéis e o direito `premium`. Sem porta publicada; o catálogo fala com ele por `AUTH_SERVICE_URL` (`http://auth-service:3000`).
- *`log-service`* (Hono + Bun) — auditoria “quem fez o quê e quando”. Consome/produz o stream `auditoria:eventos` (Redis Streams). Consulta restrita a quem tem `consultar:logs` (admin). Sem porta publicada.
- *`redis`* (Redis 7, AOF) — apenas o stream de auditoria. Sem porta publicada.
- *`minio`* — object storage, bucket privado `riff-midias`. Só o `app` fala com o MinIO; o navegador nunca recebe URL direta do bucket — recebe os bytes pela rota autenticada do `app`. Sem porta publicada.

Dependências externas (SaaS, consumidas via API): *Stripe* (Checkout hospedado, assinaturas recorrentes, webhooks assinados, Billing Portal — sempre em modo de teste), *YouTube* (origem do áudio), *Mailtrap* (SMTP sandbox, usado para o e-mail de recuperação de senha) e *MariaDB* externo à VM.

== Onde roda
Tudo na mesma VM da disciplina (Ubuntu + Docker), na mesma stack do Portainer usada desde a atividade 2; o projeto e o domínio são os mesmos da atividade 9. São apenas containers, uma rede bridge e um volume:

#table(
  columns: (3.6cm, 3.1cm, 2.0cm, 1fr),
  [*Container*], [*Imagem*], [*Mem*], [*Papel*],
  [`app`], [`riff-app:latest` (ou rebuilt)], [1 g], [único ponto de entrada, porta 8222 → domínio],
  [`auth-service`], [`riff-auth:latest`], [1 g], [identidade/RBAC/premium — sem porta],
  [`log-service`], [`riff-log:latest`], [1 g], [auditoria via Redis Streams — sem porta],
  [`redis`], [`redis:7-alpine`], [1 g], [stream `auditoria:eventos`],
  [`minio`], [`elestio/minio:latest`], [1 g], [bucket `riff-midias` — sem porta],
)

O código vive no repositório público `github.com/mateussantospereira/music-sass`; o deploy é feito pelo Portainer a partir de tar dos contextos (`app`, `auth-service`). O repositório também documenta a exigência de que dados de cartão nunca coexistam com o código: chaves `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, segredos internos, JWT e senha do banco vivem *apenas* em variáveis da stack no Portainer — o arquivo `.env.example` lista somente os nomes, nunca os valores. Não existe CI/CD nesta versão (ver 3.7); o deploy é manual via Portainer. Não há restart automático "watchtower"; a imagem é recriada a cada deploy.

== Fluxo de uma requisição
Exemplo real da funcionalidade central: ouvir uma faixa que outra conta compartilhou com a sua.

+ A pessoa abre https://mateus-pereira-isw055.lapps.studio/painel/biblioteca — o SPA (React) carrega e, com o `Authorization: Bearer` do `localStorage`, chama `GET /api/musicas`.
+ O `app` valida a sessão no `auth-service` (`GET /me` por `AUTH_SERVICE_URL`), recebe as permissões resolvidas e o direito `premium`. Quem não está logado recebe 401 do app e é mandado para o login.
+ A rota do domínio lê no MariaDB apenas filas/músicas/compartilhamentos do próprio usuário + o que foi explicitamente compartilhado com ele; nunca a biblioteca alheia.
+ Ao clicar em ouvir, `<audio>` chama `GET /api/musicas/:id/stream` com o token na query string (limitação do elemento `<audio>`); o `app` valida a permissão de leitura (dona, compartilhada, ou admin) e *transmite* os bytes diretamente do MinIO — nenhum link direto ao bucket chega ao navegador.
+ Eventos relevantes (login, adição de faixa, acesso negado, ativação de assinatura) são publicados pelo middleware no `log-service`, que grava no stream `auditoria:eventos` do Redis; o admin consulta pela tela de auditoria (`consultar:logs`).
+ O navegador pode cachear os bytes no Cache Storage (7 dias / 80 MB, com limpeza automática e manual), reduzindo re-streaming — nenhuma cópia "solta" fica em disco.

== Fluxo de assinatura
Plano é estado mantido por webhook, nunca pela tela. O servidor consulta o banco a cada requisição — é isso que valida o limite na API, não na interface.

+ A conta nasce no plano gratuito (10 músicas). O usuário vai em *Plano* e clica em *Assinar Pro* (`POST /api/plano/checkout`).
+ O `app` cria ou reutiliza o *Customer* no Stripe, gravando `stripe_customer_id` em `assinaturas`, e devolve a URL da Checkout Session hospedada (`mode=subscription`, preço recorrente mensal `price_1UbSxTFuyPkL92kDs4jPTOzE`, R\$ 29,00).
+ O usuário paga com o cartão de teste `4242 4242 4242 4242`. A confirmação chega ao `app` por *webhook* (`/api/plano/webhook`), com verificação HMAC do cabeçalho `stripe-signature`.
+ O processamento é idempotente: o `id` do evento é gravado em `stripe_eventos` antes de qualquer efeito; o mesmo evento chegando de novo responde `200 { duplicado: true }` e não produz efeito duplicado.
+ Os quatro eventos tratados: `checkout.session.completed` → grava `subscription_id`, marca `assinaturas.plano='pro', status='ativa'` e pede ao auth-service para marcar `usuarios.premium = true`; `customer.subscription.updated` → reflete status e renovação; `customer.subscription.deleted` → `cancelada` + `premium = false` → volta para o Free; `invoice.payment_failed` → `inadimplente` + `premium = false` (a auditoria registra quem, quando e o porquê). O cartão recusado na renovação não mantém o Pro de graça.
+ Quem abre *Gerenciar assinatura* (`/api/plano/portal`) é levado ao *Billing Portal* do Stripe para trocar/cancelar sozinho. Nesta conta de teste o cancelamento está configurado para *imediato* (para o teste ser demonstrável na hora).
+ A cada requisição: a API lê `usuarios.premium` (via auth-service) e, se Free, bloqueia a 11ª criação com `402` e mensagem clara — o limite é do servidor, não da UI.

== Modelo de dados do domínio
Tabelas de negócio (dump de produção: `db/002_dominio.sql`, `db/004_assinatura.sql`). Todas as relações entre o domínio e o usuário têm FK explícita; nada órfão.

#table(
  columns: (3.0cm, 2.0cm, 1fr),
  [*Tabela*], [*Dono lógico*], [*Campos-chave / vínculo*],
  [`usuarios`], [auth-service], [`id`, `email`, `senha_hash`, `role`, `premium`],
  [`reset_tokens`], [auth-service], [`id`, `token`, `expira_em`, `usado_em`],
  [`musicas`], [domínio], [`id`, `usuario_id` → `usuarios(id)`, `titulo`, `artista`, `origem_url`, `status (processando/pronta/erro)`, `chave_audio`, `chave_capa`],
  [`playlists`], [domínio], [`id`, `usuario_id` → `usuarios(id)`, `nome`, `descricao`],
  [`playlist_musicas`], [domínio], [`playlist_id` → `playlists(id)`, `musica_id` → `musicas(id)`, `ordem`; PK composta],
  [`compartilhamentos`], [domínio], [`usuario_id` → `usuarios(id)`, `musica_id` → `musicas(id)` ou `playlist_id` → `playlists(id)` (exatamente um — CHECK), `concedido_por` → `usuarios(id)`],
  [`assinaturas`], [domínio], [`usuario_id` → `usuarios(id)` (PK), `stripe_customer_id`, `stripe_subscription_id`, `status (pendente/ativa/inadimplente/cancelada)`, `plano`],
  [`stripe_eventos`], [domínio], [`id` (evento Stripe, PK), `tipo`, `processado_em` — idempotência do webhook],
)

Notas: o MinIO guarda os bytes; o MariaDB guarda apenas referências (`chave_*`). *`premium` mora no auth-service* — o `app` nunca decodifica o token localmente, sempre pergunta a quem é dono da identidade. Acesso a dados segue a mesma regra em toda consulta: admin vê tudo; curador vê próprias + compartilhadas com ele; ouvinte vê próprias + compartilhadas com ele.

== Segurança
- *Papéis e permissões* (auth-service, `auth-service/src/auth/permissoes.ts`): `admin`, `curador` (dono da biblioteca), `ouvinte` (usuário comum do produto). Permissão declarada no servidor; o frontend só consome a lista pronta. 403 real na API mesmo por chamada direta; as telas só dão “gatilho” à API.
- *Isolamento por usuário*: toda consulta ao domínio passa por `usuario_id`/`compartilhamentos`; outras contas → 403 (mesma resposta de “não é seu”); admin → tudo (com log). Poder de leitura nunca é derivado de um ID que o cliente mandou.
- *Segredos*: fora do repositório. JWT, segredo interno (`INTERNAL_SYNC_TOKEN`), senha do banco, chaves Stripe e credencial do MinIO ficam nas variáveis da stack no Portainer (e em `.env` local ignorado). O `.env.example` lista apenas nomes. Dados de cartão nunca tocam o backend — o checkout é hospedado pelo Stripe.
- *Idempotência e replay*: `stripe_eventos` descarta reprocessamento; webhook inválido (`stripe-signature` errado) → 400 e nada é gravado.

== Observabilidade e CI/CD
Cada container tem `healthcheck` ativo (app: `GET /api/health`; auth e log: `GET /health`; redis: `redis-cli ping`; minio: `/minio/health/live`). Não há pipeline de CI/CD neste projeto — o deploy e a recriação das imagens são manuais via Portainer. Não há Sentry (ou similar), não há métricas/tracing e não há Swagger gerado — a documentação da API está no README. Os logs dos serviços são gravados em stdout/stderr do Docker (verificáveis no console de cada container); a auditoria estruturada de negócio é o log-service (Redis Streams), e é a única “observabilidade” de fato — suficiente para as atividades, insuficiente para operação madura.

== Camadas IaaS, PaaS e SaaS do projeto
A atividade 8 aplicada à arquitetura final:

#table(
  columns: (4.5cm, 2cm, 1fr),
  [*O que*], [*Camada*], [*Por quê*],
  [VM do Fatec (Ubuntu) + rede], [IaaS], [Acesso à máquina virtual e à rede base; o provedor entrega o hardware virtual — o resto é meu.],
  [Imagens Docker (bun, redis:7-alpine, elestio/minio)], [PaaS], [Plataforma de contêiner: build/run e entrega de processo, configuração e recursos; eu administro o compose e os volumes.],
  [MariaDB externo à VM], [PaaS/SaaS (delegado)], [Serviço de dados gerenciado pelo ambiente da disciplina; eu não administro o servidor do banco, só acesso a base.],
  [Portainer (stack, env, deploy)], [PaaS], [Ambiente de orquestração gerenciado pela disciplina; eu configuro a stack e as variáveis.],
  [Stripe (Checkout, Billing Portal, webhooks, API)], [SaaS], [Quase tudo em cobrança/assinatura é tratado pelo provedor; meu backend só reage via webhook — nunca vê o cartão.],
  [Mailtrap (SMTP sandbox)], [SaaS], [E-mail transacional via API/SMTP, sem servidor de e-mail próprio.],
  [YouTube], [SaaS], [Origem do áudio consumida por URL; só extraio o que o usuário cola.],
)

= Quadro de entregas
#context {
  let l = registro.final()
  table(
    columns: (auto, 1.35fr, 2fr, 1.7cm, 2.5cm, 2.3cm),
    align: (center, left, left, center, center, center),
    fill: (x, y) => if y == 0 { luma(235) } else { none },
    table.header([*Nº*], [*Atividade*], [*Descrição*], [*Data \
      planejada*], [*Data \
      realizada*], [*Situação*]),
    ..l.map(a => (
      [#a.numero], [#a.titulo], [#text(size: 8.5pt)[#a.descricao]],
      [#a.planejada], [#a.realizada], [#a.situacao],
    )).flatten()
  )
}

= Atividades realizadas

#atividade(
  "7", "Plano Premium — cobrança de verdade com Stripe",
  descricao: "Catálogo ganha um plano pago de verdade, Stripe Checkout hospedado, webhook assinado, usuário premium e benefício real (favoritos ilimitados, limite 5 no Free).",
  planejada: "09/10/2026",
  realizada: "13/11/2026 10:19",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit + print do checkout concluído e do usuário premium",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/cc1f9678a2ab01c2693242d949475e48e6f1615b",
)[
  #text(size: 8.5pt, fill: luma(120))[Atividade 7 foi entregue junto com a 8 e a 9, já no fim do bimestre — no ritmo do projeto, que acumulou e fechou em 13/11/2026.]

  *O que foi feito.* O catálogo virou produto com receita: criei no Stripe (test mode, sempre) um produto “Plano Premium — R\$ 9,90/mês”, a rota de checkout do catálogo abriu a página hospedada do Stripe, e a confirmação chegou por webhook assinado — o catálogo nunca viu o cartão. O premium virou direito de primeira classe (`usuarios.premium` no auth-service, marcado via rota interna com segredo compartilhado e comparação em tempo constante); o Free ficou 5 favoritos, o Premium ilimitado; a tela ganhou selo ⭐ e faixa — tudo verificável na demonstração de pagamento.

  #evidencia([Atividade 7 — Checkout do Stripe em modo de teste, com o cartão 4242 4242 4242 4242 preenchido], arquivo: "prints/atividade-7-checkout-stripe.png", largura: 66%)
  #evidencia([Atividade 7 — redirecionamento de volta com sucesso; o app confirma no banco (webhook), não no redirect], arquivo: "prints/atividade-7-checkout-concluido.png", largura: 78%)
  #evidencia([Atividade 7 — perfil da conta já premium após a confirmação do webhook], arquivo: "prints/atividade-7-perfil-premium.png", largura: 78%)
  #evidencia([Atividade 7 — evidência do efeito no banco/consulta do estado premium], arquivo: "prints/atividade-7-banco-premium.png", largura: 92%)

  *Dificuldades e como foram resolvidas.* O webhook é a parte que parece mais simples e não é: assinatura (HMAC), `client_reference_id` para casar quem pagou e evitar efeitos duplicados. Resolvi com o padrão do curso — confirmação por webhook e nada pelo redirect. Atrasou porque a atividade 7 começou antes da atividade 6 ser fechada; a sessão de 13/11/2026 (10:19) resolveu a 7 e a 8 em sequência.
]

#atividade(
  "8", "SaaS, PaaS, IaaS — e a documentação que o projeto nunca teve",
  descricao: "DOCUMENTACAO.md reversa completa (especificação, arquitetura, modelo de dados, regras de negócio) linkada no README, aplicada ao catálogo.",
  planejada: "16/10/2026",
  realizada: "13/11/2026 12:36",
  situacao: "entregue com atraso",
  evidencia: "GitHub — commit do DOCUMENTACAO.md + README linkando-o",
  url: "https://github.com/mateussantospereira/filmes-tom-hanks/commit/ed1e317237c4bb08b2209f6fe0e4061a82710aef",
)[
  *O que foi feito.* Escrevi o `DOCUMENTACAO.md` — documentação reversa do sistema: especificação sob o ponto de vista do usuário, arquitetura do sistema e fluxos principais, regras de negócio, modelo de dados, decisões técnicas e operação. O README do repositório passou a linká-lo. A documentação descreve o que existia (filmes/TMDb, login, RBAC, logs, MinIO, Premium) e não o que eu gostaria que existisse — inclusive com a tabela IaaS/PaaS/SaaS do próprio projeto (hoje replicada na seção 3.8 deste relatório, aplicada ao Riff).

  #evidencia([Atividade 8 — `DOCUMENTACAO.md` no GitHub (preview público)], arquivo: "prints/documentacao-github.png")

  *Dificuldades e como foram resolvidas.* Honestamente: não consegui identificar um commit isolado "atividade 8" — ela está absorvida no `ed1e317` de 13/11/2026 (a mesma sessão que coroou a atividade 10 e a que, também, contém o link para o README com o `DOCUMENTACAO.md`). O arquivo existe, o README aponta para ele e o conteúdo é o mesmo que hoje está revisto e expandido no `README.md` do `music-sass` (com a menção ao professor preservada). A atividade ficou com atraso pela mesma razão da 7 — o bimestre fechou no dia 13/11.
]

#atividade(
  "9", "Fork e plano de negócio",
  descricao: "Repositório novo, produto/negócio definido (SaaS de música por assinatura), README do produto e entrega via issues públicas.",
  planejada: "23/10/2026",
  realizada: "13/11/2026 18:09",
  situacao: "entregue com atraso",
  evidencia: "GitHub — repositório novo público, README do produto, issues #1 e #2 abertas no próprio repo",
  url: "https://github.com/mateussantospereira/music-sass",
)[
  *O que foi feito.* O catálogo de filmes deixou de fazer sentido como produto: o usuário final quer *música*. Escolhi o Riff — biblioteca de músicas com captura de áudio a partir de URL, playlists, compartilhamento entre contas e cobrança por assinatura. O novo repositório público foi criado a partir do material anterior (squash no primeiro commit, para o histórico do produto nascer limpo) e ganhou README completo — arquitetura, modelo de receita, reprodução local/remota, e a palavra `github.com/siriani` preservada desde a primeira versão. Três decisões de produto guiaram o fork: *ouvir, não baixar* (sem fluxo de download na UI ou na API), *nenhuma permissão pela UI sem suporte no servidor* e *o usuário é dono da biblioteca* — isolamento absoluto por `usuario_id`, com compartilhamento explícito.

  #evidencia([Atividade 9 — repositório `music-sass` público (visão geral do projeto)], arquivo: "prints/commit-atv9-repo.png")
  #evidencia([Atividade 9 — issues públicas do produto (#1 Atividade 10, #2 Atividade 11)], arquivo: "prints/commit-atv9-issues.png")
  #evidencia([Atividades 9, 10 e 11 — evidência auditável das datas: `git log` nos repositórios, com hash e data], arquivo: "prints/evidence-gitlog.png")

  *Dificuldades e como foram resolvidas.* A habilidade que importa aqui não é tecnologia, é corte: tirar tudo do contexto “filmes” sem deixar rastros (nenhuma menção ao catálogo anterior no produto, e nenhum arquivo `Tom Hanks` no novo repositório). O primeiro commit sai em 13/11/2026 18:09 — com a atividade 10 já pronta nele; o fork foi fechado como “squash de toda a base antiga”, que é a honestidade que o pedido de fork admite.
]

#atividade(
  "10", "Seu negócio no ar",
  descricao: "Stack publicada no Portainer: domínio público, CRUD no domínio de música, papéis no servidor, isolamento por usuário, auditoria e landing pública com CTA.",
  planejada: "06/11/2026",
  realizada: "13/11/2026 18:09",
  situacao: "entregue com atraso",
  evidencia: "GitHub — issue #1 de entrega + commit + URL no ar + prints da landing, do 403 e dos eventos no log",
  url: "https://github.com/mateussantospereira/music-sass/issues/1",
)[
  *O que foi feito.* O Riff chegou ao ar em https://mateus-pereira-isw055.lapps.studio, na mesma stack do Portainer da atividade 9 (stack 22, projeto `filmel-tom-hanks`, domínio público da disciplina). O domínio ficou com três tabelas no mínimo (musicas, playlists, playlist_musicas, compartilhamentos, assinaturas), migration versionada com seed em `db/`, API CRUD completa com streaming autenticado, telas de lista/criação/edição/detalhe, três papéis com autorização no servidor (403 real para quem chama a API direto), isolamento por usuário (outro ID → 403), auditoria estruturada no log-service/Redis (quem, quando, o quê) e MinIO atado ao registro correto (`chave_*` no banco, bytes no bucket, stream autenticado em `/api/musicas/:id/stream`). Nada de fotos de capas falsas — só capa/áudio quando há um upload real; a landing pública vende o produto e termina no CTA de cadastro.

  #evidencia([Atividade 10 — landing pública do Riff com proposta de valor e CTA de cadastro], arquivo: "prints/01-landing.png", largura: 100%)
  #evidencia([Atividade 10 — biblioteca do usuário comum (ouve apenas as próprias + compartilhadas)], arquivo: "prints/02-biblioteca.png")
  #evidencia([Atividade 10 — 403 do papel ouvinte na API de auditoria (autorização no servidor, não na tela)], arquivo: "prints/03-403-papel-ouvinte.png")
  #evidencia([Atividade 10 — isolamento por usuário: faixa de outro usuário → 403 na API e UI], arquivo: "prints/04-musica-de-outro-usuario.png")
  #evidencia([Atividades 10 e 11 — auditoria: recortes live da API do log-service — música (processos, 403, remoções) e assinatura (checkout → webhook → portal → cancelamento)], arquivo: "prints/logs-atividades-10-11.png", largura: 100%)
  #evidencia([Atividade 10 — objeto no MinIO (bytes de áudio/capas no bucket `riff-midias`)], arquivo: "prints/06-minio-objeto.png")
  #evidencia([Atividade 10 — stack no ar (Portainer, serviço único de entrada, mem_limit 1g)], arquivo: "prints/07-portainer-stack.png")
  #evidencia([Atividade 10 — issue #1 de entrega (data/hora da abertura)], arquivo: "prints/issue-atv10.png")
  *Dificuldades e como foram resolvidas.* Duas valem notar: (1) a extração de áudio precisava do binário correto para a VM — o Dockerfile usa `yt-dlp_linux`; (2) o áudio em `<audio>` não manda header de autorização, então o token foi para a query string na rota autenticada, ainda validada no servidor. Deploy a deploy, cada falha virou ajuste no próprio compose — que é como se aprende na IaaS.
]

#atividade(
  "11", "SaaS completo — planos, limites e assinatura com Stripe",
  descricao: "Free/Pro com preço recorrente no Stripe (test mode), webhooks idempotentes, portal do cliente, limite do Free na API (402) e painel admin de faturamento.",
  planejada: "13/11/2026",
  realizada: "13/11/2026 19:13",
  situacao: "entregue",
  evidencia: "GitHub — issue #2 de entrega + commit + prints da assinatura com 4242, webhook idempotente e limite bloqueando",
  url: "https://github.com/mateussantospereira/music-sass/issues/2",
)[
  *O que foi feito.* O produto virou SaaS de assinatura. Criei no Stripe (test mode, sempre — cobrança real não existe nesta atividade) o produto e o preço recorrente mensal: *Riff Pro, R\$ 29,00/mês — BRL*. O checkout abre a página hospedada do Stripe (`mode=subscription`) ligada a um Customer persistido em `assinaturas`; a confirmação volta por webhook assinado — nunca pelo redirect. Os quatro eventos são tratados (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`) e o processamento é idempotente pela tabela `stripe_eventos` (prova visual: o mesmo evento reenviado responde `200 { duplicado: true }`). O Billing Portal (“Gerenciar assinatura”) está habilitado em modo de teste; nesta conta o cancelamento é imediato para o fluxo ser demonstrável na hora. O Free tem limite de 10 músicas *no servidor* — a 11ª chamada responde `402` com mensagem clara (“O plano gratuito permite até 10 músicas. Assine o Pro para adicionar sem limite.”) e o Pro não tem limite. O painel admin em `/painel/faturamento` (permissão `ver:faturamento`) mostra usuários por plano, assinaturas ativas, MRR de teste (ativas × preço do Price, lido do Stripe) e os últimos 5 eventos do log. Chaves *nunca* no repositório; só nos valores da stack 22 do Portainer; `.env.example` lista apenas nomes.

  #evidencia([Atividade 11 — evidência da API: conta Free com 10/10 músicas usadas; a 11ª chamada autenticada responde HTTP 402], arquivo: "prints/08-limite-free-402.png")
  #evidencia([Atividade 11 — cartão 4242 4242 4242 4242 preenchido no checkout], arquivo: "prints/10-checkout-cartao-4242.png", largura: 76%)
  #evidencia([Atividade 11 — retorno do checkout: Pro ativado porque o webhook processou (banner Pro, botão Gerenciar assinatura)], arquivo: "prints/11-assinatura-concluida.png", largura: 82%)
  #evidencia([Atividade 11 — painel `/painel/faturamento` (admin): usuários por plano, assinaturas ativas, MRR e últimos eventos], arquivo: "prints/12-painel-faturamento-admin.png", largura: 100%)
  #evidencia([Atividade 11 — auditoria: os mesmos painéis do log-service (clique na Atividade 10 para a visão consolidada): checkout_pro_iniciado → assinatura_pro_ativada → portal_assinatura_aberto → assinatura_pro_cancelada], arquivo: "prints/logs-atividades-10-11.png")
  #evidencia([Atividade 11 — Billing Portal: assinatura atual, cartão •••• 4242, fatura paga], arquivo: "prints/14-portal-cliente-stripe.png", largura: 78%)
  #evidencia([Atividade 11 — portal: confirmação de cancelamento (“Revise suas alterações”)], arquivo: "prints/15-portal-cancelar-confirmacao.png", largura: 78%)
  #evidencia([Atividade 11 — após o webhook `customer.subscription.deleted`, a conta volta para o Free], arquivo: "prints/16-conta-volta-para-free.png", largura: 82%)
  #evidencia([Atividade 11 — idempotência: reenvio do mesmo evento responde 200 duplicado sem efeito], arquivo: "prints/17-webhook-idempotente.png", largura: 92%)
  #evidencia([Atividade 11 — issue #2 de entrega (data/hora da abertura)], arquivo: "prints/issue-atv11.png", largura: 78%)
  *Dificuldades e como foram resolvidas.* São duas. (1) O Stripe Checkout é uma página hospedada e fechada a ferramentas de automação: campos em iframes, validação própria — escrever automação para ela é mais difícil do que vale, e exige cautela legítima; o cartão 4242 foi preenchido no navegador e o script só registrou o que a página permite por acessibilidade (placeholders). (2) A página de retorno confirma nada — o que conta é o webhook; por isso o app mostra Pro quando o webhook chega, não em 500 ms após o sucesso do redirect. A prova de ponta a ponta ficou completa em 13/11/2026 19:13 (commit `5af23f0` (13/11/2026 19:13), issue #2).
]

= Considerações finais
O que este bimestre ensinou, de verdade, foi operação: o difference entre escrever um app bom e operar um sistema publicado. Quando foi chamado pela primeira vez, o site não abria; o port não bateu, o nginx devolveu 502 e eu tive de reaprender o caminho dos pacotes até a VM. Na segunda vez, publicava na terça e não funcionava na quarta; caixa de CDN velha servia JavaScript antigo, e o deploy virou rotina de bump de versão com `?v=` e verificação de cada mudança. No bimestre 2, encurtar o caminho deu frutos: o Riff sai do "roda na minha máquina" para um produto com assinatura de verdade — com porta, rede, separação, redeploys e um Stripe cobrando mensalmente em teste.

Honestidade: as atividades 7 e 8 atrasaram porque o ritmo do bimestre foi de entrega concentrada — fechar a 6 com qualidade e na sequência atacar 7, 8 e 9 em sequência foi melhor que espaçar mal e piorar todas. A 11 é a mais redonda das cinco: assinatura, webhook, idempotência, portal do cliente, limite no servidor e um painel de faturamento — ela foi feita empurrando todas as decisões que as outras atividades deixaram pendentes. O que falta para ser um SaaS de verdade: multi-tenant com organizações, onboarding guiado, métricas/tracing de primeiro nível, eBay & consoles do Stripe ligados à conta (o painel do aluno desta entrega fica no test mode e não está no subdomínio do produto).

Este relatório é a somatória das entregas: técnica, operação e honestidade — a mesma que uso no meu portfólio.

= Declaração de autoria
Declaro que este relatório foi elaborado por mim, individualmente, e que as evidências apresentadas correspondem a entregas de minha autoria, verificáveis nos links informados. Todas as atividades do bimestre foram realizadas individualmente, com apoio de ferramentas de IA (assistentes de código e chat), que usei para auxiliar no desenvolvimento das soluções e na organização deste relatório — todo o conteúdo final foi revisado e validado por mim.

#v(1.5cm)
#grid(
  columns: (1fr, 1fr), gutter: 2cm,
  align(center)[#line(length: 100%, stroke: 0.5pt) \
    #aluno],
  align(center)[#line(length: 100%, stroke: 0.5pt) \
    Pompeia, #data-relatorio],
)
