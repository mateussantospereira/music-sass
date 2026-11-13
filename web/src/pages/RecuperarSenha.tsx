import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { LogoMark } from "../components/LogoMark";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function RecuperarSenha() {
  const [email, setEmail] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  const toast = useToast();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { ok, data } = await api<{ error?: string }>("/api/forgot-password", { body: { email } });
    setEnviando(false);
    if (!ok) {
      toast("error", data?.error ?? "Não foi possível enviar o e-mail.");
      return;
    }
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <Link to="/" className="mb-6 flex items-center gap-2"><LogoMark size={36} /><span className="font-display text-2xl font-bold">Riff</span></Link>
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-[var(--shadow-card)]">
        <KeyRound size={28} className="text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Recuperar senha</h1>
        {enviado ? (
          <div className="mt-4 rounded-xl border bg-muted/50 p-4 text-sm leading-relaxed">
            <p className="flex items-center gap-2 font-semibold"><Mail size={16} /> Verifique seu e-mail</p>
            <p className="mt-1.5 text-muted-foreground">
              Se existe uma conta para <strong>{email}</strong>, enviamos um link válido por 30 minutos.
              O link volta para o endereço público deste app.
            </p>
            <Link to="/login" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"><ArrowLeft size={14} /> Voltar para o login</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">Digite o e-mail da conta e enviaremos um link para redefinir a senha.</p>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <Button type="submit" className="w-full" disabled={enviando}>{enviando ? "Enviando…" : "Enviar link de recuperação"}</Button>
            <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Voltar para o login</Link>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [novaSenha, setNovaSenha] = React.useState("");
  const [confirmar, setConfirmar] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const toast = useToast();
  const navigate = useNavigate();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 8) return setErro("A senha deve ter ao menos 8 caracteres.");
    if (novaSenha !== confirmar) return setErro("As senhas não coincidem.");
    setEnviando(true);
    const { ok, data } = await api<{ error?: string }>("/api/reset-password", { body: { token, novaSenha } });
    setEnviando(false);
    if (!ok) return setErro(data?.error ?? "Link inválido ou expirado.");
    toast("ok", "Senha redefinida. Entre com a nova senha.");
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <Link to="/" className="mb-6 flex items-center gap-2"><LogoMark size={36} /><span className="font-display text-2xl font-bold">Riff</span></Link>
      <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-[var(--shadow-card)]">
        <KeyRound size={28} className="text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Definir nova senha</h1>
        {!token ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-[#fdf0ee] px-3 py-2 text-sm text-destructive">
            Link sem token. Peça uma nova recuperação em <Link className="underline" to="/recuperar">/recuperar</Link>.
          </p>
        ) : (
          <form onSubmit={enviar} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nova">Nova senha</Label>
              <Input id="nova" type="password" required minLength={8} autoFocus value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirma">Confirmar nova senha</Label>
              <Input id="confirma" type="password" required minLength={8} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </div>
            {erro && <p role="alert" className="rounded-md border border-destructive/40 bg-[#fdf0ee] px-3 py-2 text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={enviando}>{enviando ? "Salvando…" : "Redefinir senha"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
