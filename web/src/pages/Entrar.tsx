import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, ShieldCheck, ListMusic, Headphones } from "lucide-react";
import { LogoMark } from "../components/LogoMark";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const DEMO = [
  { papel: "admin", email: "admin@riff.app", senha: "Admin@123" },
  { papel: "curador", email: "curador@riff.app", senha: "Curador@123" },
  { papel: "ouvinte", email: "ouvinte@riff.app", senha: "Ouvinte@123" },
];

export function Entrar({ modoInicial = "login" }: { modoInicial?: "login" | "cadastro" }) {
  const [modo, setModo] = React.useState<"login" | "cadastro">(modoInicial);
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [verSenha, setVerSenha] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const { entrar, cadastrar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { de?: string } | null)?.de ?? "/painel/biblioteca";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const resultado =
      modo === "login" ? await entrar(email, senha) : await cadastrar(nome, email, senha);
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? "Algo deu errado.");
      return;
    }
    toast("ok", modo === "login" ? "Bem-vindo de volta." : "Conta criada. Bem-vindo ao Riff.");
    navigate(destino, { replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------------- Painel esquerdo (marca) ---------------------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full border border-primary-foreground/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full border border-primary-foreground/10" />
        <Link to="/" className="relative flex items-center gap-3 font-display text-2xl font-bold">
          <LogoMark size={38} /> Riff
        </Link>
        <div className="relative">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Sua música,<br />do link ao<br />fone de ouvido.
          </h1>
          <p className="mt-6 max-w-sm text-primary-foreground/70">
            Extraia o áudio de qualquer vídeo do YouTube, organize em playlists e compartilhe — tudo num só lugar.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-3"><Headphones size={18} /> Stream direto no navegador, onde você estiver</li>
            <li className="flex items-center gap-3"><ListMusic size={18} /> Playlists com ordenação e player contínuo</li>
            <li className="flex items-center gap-3"><ShieldCheck size={18} /> Isolamento por usuário, papéis e auditoria</li>
          </ul>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-widest text-primary-foreground/50">Riff · ISW055 · 2026</p>
      </aside>

      {/* ----------------------------- Formulário ---------------------------- */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden"><LogoMark size={30} /><span className="font-display text-xl font-bold">Riff</span></Link>

          <h2 className="font-display text-3xl font-bold tracking-tight">{modo === "login" ? "Entrar" : "Criar conta"}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {modo === "login" ? "Bom te ver de novo." : "Leva 30 segundos. O plano começa grátis."}
          </p>

          {/* Alternância Entrar/Criar */}
          <div className="mt-6 grid grid-cols-2 rounded-lg border bg-muted p-1 text-sm font-medium">
            {(["login", "cadastro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro(null); }}
                className={`rounded-md py-2 transition-colors ${modo === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="mt-6 space-y-4">
            {modo === "cadastro" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Camila Curadoria" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">Senha</Label>
                {modo === "login" && <Link to="/recuperar" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Esqueci a senha</Link>}
              </div>
              <div className="relative">
                <Input id="senha" type={verSenha ? "text" : "password"} autoComplete={modo === "login" ? "current-password" : "new-password"} value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} placeholder="Mínimo de 8 caracteres" className="pr-11" />
                <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-[#fdf0ee] px-3 py-2 text-sm text-destructive">{erro}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={enviando}>
              {enviando ? "Aguarde…" : modo === "login" ? "Entrar" : "Criar conta grátis"} <ArrowRight size={18} />
            </Button>
          </form>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Contas de demonstração</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => { setModo("login"); setEmail(d.email); setSenha(d.senha); setErro(null); }}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  title={`Entrar como ${d.papel}`}
                >
                  {d.papel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
