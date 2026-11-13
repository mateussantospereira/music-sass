import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Music2, PlusCircle, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/ui/toast";
import { MusicaLinha } from "../components/MusicaLinha";
import { CompartilharDialog } from "../components/CompartilharDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import type { Musica, Share } from "../lib/tipos";

export function Biblioteca() {
  const { usuario, temPermissao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [musicas, setMusicas] = React.useState<Musica[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [busca, setBusca] = React.useState("");

  const [editando, setEditando] = React.useState<Musica | null>(null);
  const [titulo, setTitulo] = React.useState("");
  const [artista, setArtista] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  const [apagando, setApagando] = React.useState<Musica | null>(null);
  const [shares, setShares] = React.useState<Share[]>([]);
  const [compartilhando, setCompartilhando] = React.useState<Musica | null>(null);

  const podeEditar = (m: Musica) => usuario?.role === "admin" || m.usuarioId === usuario?.usuarioId;
  const podeCriar = temPermissao("criar:musica");

  const carregar = React.useCallback(async () => {
    const { ok, data } = await api<{ musicas: Musica[] }>("/api/musicas");
    if (ok && data) setMusicas(data.musicas);
    setCarregando(false);
  }, []);

  React.useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 5000); // acompanha extrações em curso
    return () => window.clearInterval(t);
  }, [carregar]);

  const filtradas = musicas.filter((m) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return m.titulo.toLowerCase().includes(q) || (m.artista ?? "").toLowerCase().includes(q);
  });

  async function abrirCompartilhar(m: Musica) {
    setCompartilhando(m);
    const { ok, data } = await api<Musica & { compartilhamentos?: Share[] }>(`/api/musicas/${m.id}`);
    setShares(ok && data?.compartilhamentos ? data.compartilhamentos : []);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    const { ok, data } = await api(`/api/musicas/${editando.id}`, { method: "PATCH", body: { titulo, artista } });
    setSalvando(false);
    if (!ok) {
      toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível salvar.");
      return;
    }
    toast("ok", "Música atualizada.");
    setEditando(null);
    carregar();
  }

  async function confirmarApagar() {
    if (!apagando) return;
    const { ok, data } = await api(`/api/musicas/${apagando.id}`, { method: "DELETE" });
    if (!ok) {
      toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível remover.");
    } else {
      toast("ok", "Música removida.");
      setApagando(null);
      carregar();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">biblioteca</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Suas músicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {usuario?.role === "ouvinte"
              ? "Suas faixas e as que compartilharem com você."
              : usuario?.role === "admin"
                ? "Como admin, você vê a biblioteca de todo mundo."
                : "Só as faixas que você curou — mais o que compartilharem com você."}
          </p>
        </div>
        {podeCriar && (
          <Link to="/painel/adicionar"><Button size="lg"><PlusCircle size={18} /> Adicionar música</Button></Link>
        )}
      </div>

      {/* Busca */}
      <div className="relative mt-6 max-w-md">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou artista…" className="pl-10" aria-label="Buscar música" />
      </div>

      {/* Conteúdo */}
      <div className="mt-4 rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        {carregando ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Music2 size={36} className="text-muted-foreground" />
            <p className="font-semibold">{busca ? "Nada encontrado para essa busca." : "Sua biblioteca está vazia."}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {busca
                ? "Tente outro termo."
                : podeCriar
                  ? "Cole o link de um vídeo do YouTube e a gente cuida do resto."
                  : "Peça para um curador compartilhar uma playlist com você."}
            </p>
            {podeCriar && !busca && (
              <Button className="mt-2" onClick={() => navigate("/painel/adicionar")}><PlusCircle size={18} /> Adicionar a primeira música</Button>
            )}
          </div>
        ) : (
          <div className="p-2 sm:p-3">
            {filtradas.map((m) => (
              <MusicaLinha
                key={m.id}
                musica={m}
                podeEditar={podeEditar(m)}
                mostrarDono={usuario?.role === "admin"}
                onEditar={(x) => { setEditando(x); setTitulo(x.titulo); setArtista(x.artista ?? ""); }}
                onApagar={setApagando}
                onCompartilhar={abrirCompartilhar}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editar */}
      <Dialog open={Boolean(editando)} onClose={() => setEditando(null)} title="Editar música" description="Só metadados — o áudio continua o mesmo.">
        <form onSubmit={salvarEdicao} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="artista">Artista</Label>
            <Input id="artista" value={artista} onChange={(e) => setArtista(e.target.value)} maxLength={200} placeholder="Artista desconhecido" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Apagar */}
      <Dialog open={Boolean(apagando)} onClose={() => setApagando(null)} title="Remover música" description="O áudio e a capa serão apagados do armazenamento e as relações/compratilhamentos caem em cascata. Essa ação não desfaz.">
        <p className="text-sm">Remover <strong>{apagando?.titulo}</strong> da sua biblioteca?</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setApagando(null)}>Voltar</Button>
          <Button variant="destructive" onClick={confirmarApagar}>Remover de vez</Button>
        </div>
      </Dialog>

      {/* Compartilhar */}
      {compartilhando && (
        <CompartilharDialog
          aberto={Boolean(compartilhando)}
          aoFechar={() => setCompartilhando(null)}
          tipo="musica"
          alvoId={compartilhando.id}
          shares={shares}
          aoMudar={() => compartilhando && abrirCompartilhar(compartilhando)}
        />
      )}
    </div>
  );
}
