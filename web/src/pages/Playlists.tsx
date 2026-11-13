import * as React from "react";
import { Link } from "react-router-dom";
import { ListMusic, PlusCircle, Share2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import type { PlaylistResumo } from "../lib/tipos";

export function Playlists() {
  const [playlists, setPlaylists] = React.useState<PlaylistResumo[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [criando, setCriando] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const toast = useToast();

  const carregar = React.useCallback(async () => {
    const { ok, data } = await api<{ playlists: PlaylistResumo[] }>("/api/playlists");
    if (ok && data) setPlaylists(data.playlists);
    setCarregando(false);
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { ok, data } = await api("/api/playlists", { body: { nome, descricao } });
    setSalvando(false);
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível criar.");
    toast("ok", "Playlist criada.");
    setCriando(false);
    setNome(""); setDescricao("");
    carregar();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">playlists</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Listas e coleções</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suas playlists — e as que curadores compartilharam com você.</p>
        </div>
        <Button size="lg" onClick={() => setCriando(true)}><PlusCircle size={18} /> Nova playlist</Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {carregando && [1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
        {!carregando && playlists.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
            <ListMusic size={36} className="text-muted-foreground" />
            <p className="font-semibold">Nenhuma playlist ainda.</p>
            <p className="max-w-sm text-sm text-muted-foreground">Crie sua primeira lista e adicione faixas da biblioteca.</p>
          </div>
        )}
        {playlists.map((p) => (
          <Link
            key={p.id}
            to={`/painel/playlists/${p.id}`}
            className="group flex flex-col rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ListMusic size={20} />
              </span>
              {p.compartilhadaComigo
                ? <Badge variant="outline" className="gap-1"><Share2 size={11} /> compartilhada{p.donoNome ? ` por ${p.donoNome}` : ""}</Badge>
                : <Badge variant="muted">sua</Badge>}
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold leading-snug tracking-tight group-hover:underline">{p.nome}</h2>
            {p.descricao && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.descricao}</p>}
            <p className="mt-3 font-mono text-xs text-muted-foreground">{p.totalMusicas} faixa{p.totalMusicas === 1 ? "" : "s"}</p>
          </Link>
        ))}
      </div>

      <Dialog open={criando} onClose={() => setCriando(false)} title="Nova playlist">
        <form onSubmit={criar} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="n">Nome</Label><Input id="n" autoFocus required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Estudo e concentração" /></div>
          <div className="space-y-1.5"><Label htmlFor="d">Descrição (opcional)</Label><Textarea id="d" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} placeholder="Faixas para foco profundo" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCriando(false)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Criando…" : "Criar playlist"}</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
