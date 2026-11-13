import { Link } from "react-router-dom";
import {
  ArrowRight, Sparkles, ListMusic, MousePointerClick, ShieldCheck, Headphones,
  Music2, Library, Users, Check, ChevronRight,
} from "lucide-react";
import { Logo, LogoMark } from "../components/LogoMark";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const RECURSOS = [
  { icone: MousePointerClick, titulo: "Cole o link, a gente extrai", texto: "URL do YouTube no formulário e o Riff processa o áudio no servidor. Em minutos a faixa está pronta na sua biblioteca." },
  { icone: Library, titulo: "Sua biblioteca, seu controle", texto: "Cada curador enxerga a própria biblioteca. O que é compartilhado aparece só para quem foi liberado — o resto é 403." },
  { icone: ListMusic, titulo: "Playlists que fazem sentido", texto: "Monte listas, ordene as faixas e aperte play. O player continua na tela enquanto você navega." },
  { icone: Headphones, titulo: "Feito para ouvir", texto: "Stream direto no navegador, sem arquivos soltos pela máquina: a faixa toca onde você estiver." },
  { icone: Users, titulo: "Curador e ouvinte", texto: "Papéis reais no backend: curador publica, ouvinte consome o que foi liberado, admin administra. Sem botão fingindo ser segurança." },
  { icone: ShieldCheck, titulo: "Auditoria de verdade", texto: "Toda ação vira evento no log: quem adicionou, quem compartilhou, quem baixou — com data, hora e IP." },
];

const PASSOS = [
  { n: "01", titulo: "Cole o link", texto: "Qualquer vídeo do YouTube — watch, Shorts ou youtu.be." },
  { n: "02", titulo: "A gente processa", texto: "A extração roda no servidor; o áudio fica vinculado ao seu registro e a faixa aparece como “pronta”." },
  { n: "03", titulo: "Ouça", texto: "Toque no player em qualquer tela. Compartilhe a playlist com quem você quiser." },
];

const FAQ = [
  { p: "Precisa de cartão para começar?", r: "Não. O plano gratuito inclui até 10 músicas, playlists e compartilhamento. O Pro remove o limite." },
  { p: "Funciona com qualquer link do YouTube?", r: "Sim: watch, Shorts e youtu.be. A extração fica no servidor; você recebe o áudio pronto." },
  { p: "Meu ouvinte vê as músicas de todo mundo?", r: "Não. Ouvinte só enxerga o que foi compartilhado com ele — e o ID de outra pessoa responde 403 na API." },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------ Nav ------------------------------ */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Riff — início"><Logo /></Link>
          <nav className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" className="hidden sm:inline-flex">Entrar</Button></Link>
            <Link to="/cadastro"><Button>Criar conta grátis <ArrowRight size={16} /></Button></Link>
          </nav>
        </div>
      </header>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="dot-grid border-b">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="outline" className="mb-5">SaaS de música · ISW055</Badge>
            <h1 className="font-display text-balance text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Cole o link.<br />
              A sua música<br />
              <span className="relative inline-block">fica com você.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 220 14" fill="none" aria-hidden><path d="M3 10c60-6 150-8 214-2" stroke="#111110" strokeWidth="5" strokeLinecap="round" /></svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              O Riff transforma links do YouTube em uma biblioteca de áudio sua — organizada em playlists,
              com stream no navegador e compartilhamento controlado por papel.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/cadastro"><Button size="lg">Criar conta grátis <ArrowRight size={18} /></Button></Link>
              <a href="#como-funciona"><Button size="lg" variant="outline">Como funciona</Button></a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Sem cartão · 10 músicas grátis · Cancele quando quiser</p>
          </div>

          {/* Mock do produto — card de player */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden>
            <div className="absolute -left-6 top-10 -rotate-6 rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">extração</p>
              <p className="font-mono text-xs font-medium">youtube → m4a ✓</p>
            </div>
            <div className="absolute -right-4 bottom-24 rotate-3 rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">acesso</p>
              <p className="font-mono text-xs font-medium">ouvinte@riff.app ✓</p>
            </div>

            <div className="relative rounded-2xl border bg-card p-5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.35)]">
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Music2 size={40} />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">tocando agora</p>
                  <p className="font-display text-lg font-semibold leading-tight">Estudo para Piano <span className="text-muted-foreground">(demo)</span></p>
                  <p className="text-sm text-muted-foreground">Camila Curadoria</p>
                </div>
              </div>

              <div className="mt-5 flex h-10 items-end gap-1">
                {[0.5, 0.9, 0.65, 1, 0.42, 0.78, 0.58, 0.95, 0.7, 0.38, 0.84, 0.6, 0.75, 0.5, 0.88, 0.44, 0.66, 1].map((h, i) => (
                  <span
                    key={i}
                    className="eq-bar w-full origin-bottom rounded-sm bg-primary/85"
                    style={{ height: `${h * 100}%`, animationDelay: `${i * 0.09}s`, animationDuration: `${0.9 + (i % 5) * 0.13}s` }}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>1:12</span>
                <span>— shared “Estudo e Concentração”</span>
                <span>3:48</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted"><div className="h-full w-[32%] rounded-full bg-primary" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Como funciona ------------------------- */}
      <section id="como-funciona" className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Em três passos</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Do link ao fone de ouvido</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.n} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
                <span className="font-display text-4xl font-bold text-muted-foreground/60">{p.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Recursos ---------------------------- */}
      <section className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">O que ele faz</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Tudo o que uma biblioteca precisa</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo} className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-[var(--shadow-card)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-rotate-3">
                  <Icone size={20} />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Planos ----------------------------- */}
      <section className="border-b py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Quanto custa</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Comece grátis. Pro por R$ 29/mês.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
            {[
              { nome: "Gratuito", preco: "R$ 0", itens: ["10 músicas", "Playlists ilimitadas", "Compartilhamento com ouvintes", "Stream no navegador"], cta: "Começar grátis", destaque: false },
              { nome: "Pro", preco: "R$ 29/mês", itens: ["Músicas ilimitadas", "Tudo do plano Gratuito", "Suporte prioritário", "Para times e curadores sérios"], cta: "Assinar Pro", destaque: true },
            ].map((plano) => (
              <div key={plano.nome} className={`rounded-2xl border p-6 shadow-[var(--shadow-card)] ${plano.destaque ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
                <p className={`font-mono text-xs uppercase tracking-widest ${plano.destaque ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{plano.nome}</p>
                <p className="mt-2 font-display text-4xl font-bold">{plano.preco}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plano.itens.map((i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check size={16} className={plano.destaque ? "text-primary-foreground" : "text-primary"} /> {i}
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro" className="mt-6 block">
                  <Button variant={plano.destaque ? "outline" : "default"} className={`w-full ${plano.destaque ? "border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" : ""}`}>
                    {plano.cta} <ChevronRight size={16} />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------ */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Perguntas diretas</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">FAQ</h2>
          <div className="mt-6 divide-y rounded-2xl border bg-card">
            {FAQ.map((f) => (
              <div key={f.p} className="p-5">
                <p className="font-semibold">{f.p}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- CTA ------------------------------- */}
      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
          <Sparkles size={28} />
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Sua próxima faixa está a um link de distância.</h2>
          <Link to="/cadastro"><Button size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">Criar conta grátis <ArrowRight size={18} /></Button></Link>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><LogoMark size={20} /> <span className="font-semibold text-foreground">Riff</span> · sua biblioteca de música</div>
          <p>Projeto da disciplina ISW055 · <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/siriani" target="_blank" rel="noreferrer">github.com/siriani</a></p>
        </div>
      </footer>
    </div>
  );
}
