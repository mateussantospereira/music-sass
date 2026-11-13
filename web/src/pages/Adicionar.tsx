import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Music2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function Adicionar() {
  const [url, setUrl] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { ok, status, data } = await api<{ id?: number; error?: string; limite?: number }>("/api/musicas", { body: { url } });
    setEnviando(false);

    if (status === 402) {
      setErro(data?.error ?? "Limite do plano gratuito atingido.");
      toast("warn", data?.error ?? "Limite do plano gratuito atingido.");
      return;
    }
    if (!ok || !data?.id) {
      setErro(data?.error ?? "Não foi possível adicionar esta música.");
      return;
    }
    toast("ok", "Extração iniciada. A faixa fica pronta em instantes.");
    navigate(`/painel/musicas/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">nova música</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Cole o link do YouTube</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A extração roda no servidor: metadata, áudio (m4a) e capa vão para o seu registro. Pode ser vídeo, Shorts ou youtu.be.
      </p>

      <form onSubmit={enviar} className="mt-6 rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <Label htmlFor="url" className="flex items-center gap-2"><Link2 size={15} /> URL do vídeo</Label>
        <Input
          id="url"
          type="url"
          required
          autoFocus
          className="mt-1.5 font-mono text-sm"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {erro && <p role="alert" className="mt-3 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-800">{erro}</p>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles size={14} /> yt-dlp + ffmpeg no servidor, nada passa pelo seu navegador.</p>
          <Button type="submit" size="lg" disabled={enviando}>{enviando ? "Enviando…" : "Extrair áudio"}</Button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground"><Music2 size={16} /> Por que m4a?</p>
        <p className="mt-1.5">Escolhemos o container AAC pela qualidade por megabyte: streaming rápido, download pequeno e compatibilidade em qualquer navegador.</p>
      </div>
    </div>
  );
}
