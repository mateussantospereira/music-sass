import * as React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ListMusic, Music2, Pause, Play, Plus, Share2, Trash2, X, Pencil,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePlayer } from "../lib/player";
import { useToast } from "../components/ui/toast";
import { CompartilharDialog } from "../components/CompartilharDialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { formatarDuracao, rotuloStatus, statusBadgeVariant } from "../lib/format";
import type { Musica, PlaylistDetalhe as TPlaylistDetalhe, Share } from "../lib/tipos";

export function PlaylistDetalhe() {
  const { id } = useParams<{ id: string }>();
  const playlistId = Number(id);
  const { usuario, temPermissao } = useAuth();
  const { playFaixas, atual, tocando, alternar } = usePlayer();
  const toast = useToast();
  const navigate = useNavigate();

  const [dados, setDados] = React.useState<TPlaylistDetalhe | null>(null);
  const [naoEncontrada, setNaoEncontrada] = React.useState(false);
  const [semAcesso, setSemAcesso] = React.useState(false);
  const [editando, setEditando] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [apagando, setApagando] = React.useState(false);
  const [adicionando, setAdicionando] = React.useState(false);
  const [biblioteca, setBiblioteca] = React.useState<Musica[]>([]);
  const [compartilhando, setCompartilhando] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const { ok, status, data } = await api<TPlaylistDetalhe>(`/api/playlists/${playlistId}`);
    if (status === 404) return setNaoEncontrada(true);
    if (status === 403) return setSemAcesso(true);
    if (ok && data) setDados(data);
  }, [playlistId]);

  React.useEffect(() => { carregar(); }, [carregar]);

  const podeEditar = Boolean(dados && (usuario?.role === "admin" || dados.usuarioId === usuario?.usuarioId));
  const podeCompartilhar = podeEditar && temPermissao("compartilhar:musica");
  const tocaveis = (dados?.musicas ?? []).filter((f) => f.status === "pronta" && f.temAudio);
  const isTocandoEsta = atual && (dados?.musicas ?? []).some((f) => f.id === atual.id);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { ok, data } = await api(`/api/playlists/${playlistId}`, { method: "PATCH", body: { nome, descricao } });
    setSalvando(false);
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível salvar.");
    toast("ok", "Playlist atualizada.");
    setEditando(false);
    carregar();
  }

  async function apagar() {
    const { ok, data } = await api(`/api/playlists/${playlistId}`, { method: "DELETE" });
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível remover.");
    toast("ok", "Playlist removida.");
    navigate("/painel/playlists", { replace: true });
  }

  async function removerFaixa(musicaId: number) {
    const { ok, data } = await api(`/api/playlists/${playlistId}/musicas/${musicaId}`, { method: "DELETE" });
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível remover.");
    carregar();
  }

  async function abrirAdicionar() {
    setAdicionando(true);
    const { ok, data } = await api<{ musicas: Musica[] }>("/api/musicas");
    if (ok && data) setBiblioteca(data.musicas);
  }

  async function adicionarFaixa(musicaId: number) {
    const { ok, data } = await api(`/api/playlists/${playlistId}/musicas`, { body: { musicaId } });
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível adicionar.");
    toast("ok", "Faixa adicionada.");
    carregar();
  }

  if (semAcesso || naoEncontrada) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-bold">{semAcesso ? "Você não tem acesso a esta playlist" : "Playlist não encontrada"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{semAcesso ? "O servidor recusou a leitura (403). Peça ao dono para compartilhar com você." : "Ela pode ter sido removida — ou não foi compartilhada com você."}</p>
        <Link to="/painel/playlists" className="mt-6 inline-block"><Button variant="outline"><ArrowLeft size={16} /> Voltar para playlists</Button></Link>
      </div>
    );
  }

  if (!dados) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;
  }

  const idsNaPlaylist = new Set(dados.musicas.map((f) => f.id));
  const disponiveis = biblioteca.filter((m) => !idsNaPlaylist.has(m.id) && m.status === "pronta");

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/painel/playlists" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Playlists</Link>

      {/* Cabeçalho */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ListMusic size={20} /></span>
            {dados.compartilhadaComigo
              ? <Badge variant="outline">compartilhada com você</Badge>
              : <Badge variant="muted">sua playlist</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{dados.nome}</h1>
          {dados.descricao && <p className="mt-1 max-w-lg text-sm text-muted-foreground">{dados.descricao}</p>}
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">{dados.totalMusicas} faixa{dados.totalMusicas === 1 ? "" : "s"}{dados.donoNome ? ` · por ${dados.donoNome}` : ""}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => (isTocandoEsta ? alternar() : playFaixas(dados.musicas, 0))} disabled={tocaveis.length === 0}>
            {isTocandoEsta && tocando ? <><Pause size={18} fill="currentColor" /> Pausar</> : <><Play size={18} fill="currentColor" className="ml-0.5" /> Tocar todas</>}
          </Button>
          {podeEditar && (
            <>
              <Button variant="outline" size="icon" title="Adicionar faixas" onClick={abrirAdicionar}><Plus size={18} /></Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => { setNome(dados.nome); setDescricao(dados.descricao ?? ""); setEditando(true); }}><Pencil size={17} /></Button>
              {podeCompartilhar && (
                <Button variant="ghost" size="icon" title="Compartilhar" onClick={() => setCompartilhando(true)}><Share2 size={17} /></Button>
              )}
              <Button variant="ghost" size="icon" title="Remover playlist" className="text-destructive hover:text-destructive" onClick={() => setApagando(true)}><Trash2 size={17} /></Button>
            </>
          )}
        </div>
      </div>

      {/* Faixas */}
      <div className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        {dados.musicas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Music2 size={32} className="text-muted-foreground" />
            <p className="font-semibold">Playlist vazia.</p>
            {podeEditar && <Button className="mt-1" size="sm" onClick={abrirAdicionar}><Plus size={15} /> Adicionar faixas da biblioteca</Button>}
          </div>
        ) : (
          <ul className="divide-y">
            {dados.musicas.map((f, i) => {
              const ehAtual = atual?.id === f.id;
              const tocavel = f.status === "pronta" && f.temAudio;
              return (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <span className="w-6 text-right font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <button
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent disabled:opacity-40"
                    disabled={!tocavel}
                    onClick={() => (ehAtual ? alternar() : playFaixas(dados.musicas, i))}
                    aria-label={ehAtual ? "Pausar/tocar" : "Tocar faixa"}
                  >
                    {ehAtual && tocando ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.artista ?? "Artista desconhecido"} · {formatarDuracao(f.duracaoSeg)}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(f.status)} className="hidden sm:inline-flex">{rotuloStatus(f.status)}</Badge>
                  {podeEditar && (
                    <button onClick={() => removerFaixa(f.id)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Remover da playlist"><X size={16} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={editando} onClose={() => setEditando(false)} title="Editar playlist">
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="n">Nome</Label><Input id="n" autoFocus required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="d">Descrição</Label><Textarea id="d" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button></div>
        </form>
      </Dialog>

      <Dialog open={apagando} onClose={() => setApagando(false)} title="Remover playlist" description="A playlist e seus acessos compartilhados são removidos. As músicas continuam na biblioteca.">
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setApagando(false)}>Voltar</Button><Button variant="destructive" onClick={apagar}>Remover playlist</Button></div>
      </Dialog>

      <Dialog open={adicionando} onClose={() => setAdicionando(false)} title="Adicionar da sua biblioteca" className="max-w-xl">
        {disponiveis.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nada disponível para adicionar — ou tudo já está na playlist, ou só faixas prontas entram.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border">
            {disponiveis.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <Music2 size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.titulo}</p><p className="truncate text-xs text-muted-foreground">{m.artista ?? "—"} · {formatarDuracao(m.duracaoSeg)}</p></div>
                <Button size="sm" variant="outline" onClick={() => adicionarFaixa(m.id)}><Plus size={14} /> Adicionar</Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <CompartilharDialog
        aberto={compartilhando}
        aoFechar={() => setCompartilhando(false)}
        tipo="playlist"
        alvoId={dados.id}
        shares={(dados.compartilhamentos ?? []) as Share[]}
        aoMudar={carregar}
      />
    </div>
  );
}
