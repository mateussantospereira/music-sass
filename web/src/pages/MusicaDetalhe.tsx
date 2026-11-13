import * as React from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Music2, Pause, Pencil, Play, RotateCw, Share2, Trash2 } from "lucide-react";
import { api, urlComToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePlayer } from "../lib/player";
import { useToast } from "../components/ui/toast";
import { CompartilharDialog } from "../components/CompartilharDialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { formatarBytes, formatarData, formatarDuracao, rotuloStatus, statusBadgeVariant } from "../lib/format";
import type { Musica, Share } from "../lib/tipos";

type Detalhe = Musica & { compartilhamentos?: Share[] };

export function MusicaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const musicaId = Number(id);
  const { usuario } = useAuth();
  const { atual, tocando, tocar, alternar } = usePlayer();
  const toast = useToast();
  const navigate = useNavigate();

  const [dados, setDados] = React.useState<Detalhe | null>(null);
  const [naoEncontrada, setNaoEncontrada] = React.useState(false);
  const [semAcesso, setSemAcesso] = React.useState(false);
  const [editando, setEditando] = React.useState(false);
  const [titulo, setTitulo] = React.useState("");
  const [artista, setArtista] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [apagando, setApagando] = React.useState(false);
  const [compartilhando, setCompartilhando] = React.useState(false);
  const [reprocessando, setReprocessando] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const { ok, status, data } = await api<Detalhe>(`/api/musicas/${musicaId}`);
    if (status === 404) return setNaoEncontrada(true);
    if (status === 403) return setSemAcesso(true);
    if (ok && data) setDados(data);
  }, [musicaId]);

  React.useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 3000); // acompanha a extração
    return () => window.clearInterval(t);
  }, [carregar]);

  const podeEditar = Boolean(dados && (usuario?.role === "admin" || dados.usuarioId === usuario?.usuarioId));
  const isAtual = dados && atual?.id === dados.id;
  const tocavel = dados?.status === "pronta" && dados?.temAudio;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { ok, data } = await api(`/api/musicas/${musicaId}`, { method: "PATCH", body: { titulo, artista } });
    setSalvando(false);
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível salvar.");
    toast("ok", "Música atualizada.");
    setEditando(false);
    carregar();
  }

  async function apagar() {
    const { ok, data } = await api(`/api/musicas/${musicaId}`, { method: "DELETE" });
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível remover.");
    toast("ok", "Música removida.");
    navigate("/painel/biblioteca", { replace: true });
  }

  async function reprocessar() {
    setReprocessando(true);
    const { ok, data } = await api(`/api/musicas/${musicaId}/reprocessar`, { method: "POST" });
    setReprocessando(false);
    if (!ok) return toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível reprocessar.");
    toast("info", "Extração reiniciada.");
    carregar();
  }

  if (semAcesso || naoEncontrada) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-bold">{semAcesso ? "Você não tem acesso a esta faixa" : "Música não encontrada"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{semAcesso ? "Esta música não está na sua biblioteca. O servidor recusou a leitura (403) — a tela não muda isso." : "Ela pode ter sido removida — ou nunca foi sua."}</p>
        <Link to="/painel/biblioteca" className="mt-6 inline-block"><Button variant="outline"><ArrowLeft size={16} /> Voltar para a biblioteca</Button></Link>
      </div>
    );
  }

  if (!dados) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-56 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/painel/biblioteca" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Biblioteca</Link>

      <div className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr]">
        {/* Capa */}
        <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border bg-muted sm:h-52 sm:w-52">
          {dados.temCapa ? (
            <img src={urlComToken(`/api/musicas/${dados.id}/capa`)} alt={`Capa de ${dados.titulo}`} className="h-full w-full object-cover" />
          ) : (
            <Music2 size={56} className="text-muted-foreground" />
          )}
        </div>

        {/* Cabeçalho */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(dados.status)}>{rotuloStatus(dados.status)}</Badge>
            {dados.donoNome && <span className="text-xs text-muted-foreground">curada por {dados.donoNome}</span>}
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{dados.titulo}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{dados.artista ?? "Artista desconhecido"}</p>

          {dados.status === "erro" && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-[#fdf0ee] px-3 py-2 text-sm text-destructive">
              <strong>Extração falhou:</strong> {dados.erroMsg ?? "motivo desconhecido"}{" "}
              {podeEditar && <button className="inline-flex items-center gap-1 font-semibold underline underline-offset-2" onClick={reprocessar} disabled={reprocessando}><RotateCw size={13} className={reprocessando ? "animate-spin" : ""} /> Tentar de novo</button>}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Button size="lg" onClick={() => { if (isAtual) alternar(); else tocar(dados); }} disabled={!tocavel} className="min-w-40">
              {isAtual && tocando ? <><Pause size={18} fill="currentColor" /> Pausar</> : <><Play size={18} fill="currentColor" className="ml-0.5" /> Tocar</>}
            </Button>
            {podeEditar && (
              <>
                <Button variant="ghost" size="icon" title="Editar metadados" onClick={() => { setTitulo(dados.titulo); setArtista(dados.artista ?? ""); setEditando(true); }}><Pencil size={18} /></Button>
                <Button variant="ghost" size="icon" title="Compartilhar" onClick={() => setCompartilhando(true)}><Share2 size={18} /></Button>
                <Button variant="ghost" size="icon" title="Remover" className="text-destructive hover:text-destructive" onClick={() => setApagando(true)}><Trash2 size={18} /></Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ficha técnica */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Duração", formatarDuracao(dados.duracaoSeg)],
          ["Tamanho", formatarBytes(dados.tamanho)],
          ["Adicionada em", formatarData(dados.criadoEm)],
          ["Formato", dados.contentType ?? "—"],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="rounded-xl border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{rotulo}</p>
            <p className="mt-1 font-semibold">{valor}</p>
          </div>
        ))}
      </div>

      {dados.origemUrl && (
        <a href={dados.origemUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          <ExternalLink size={14} /> Origem do conteúdo
        </a>
      )}

      {/* Compartilhamentos (dono) */}
      {podeEditar && dados.compartilhamentos && dados.compartilhamentos.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">liberada para</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {dados.compartilhamentos.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-xs font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold uppercase text-primary-foreground">{s.nome.slice(0, 2)}</span>
                {s.nome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={editando} onClose={() => setEditando(false)} title="Editar música">
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="t">Título</Label><Input id="t" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-1.5"><Label htmlFor="a">Artista</Label><Input id="a" value={artista} onChange={(e) => setArtista(e.target.value)} maxLength={200} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button></div>
        </form>
      </Dialog>

      <Dialog open={apagando} onClose={() => setApagando(false)} title="Remover música" description="Áudio e capa são apagados do MinIO; a faixa some das playlists. Essa ação não desfaz.">
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setApagando(false)}>Voltar</Button><Button variant="destructive" onClick={apagar}>Remover de vez</Button></div>
      </Dialog>

      <CompartilharDialog
        aberto={compartilhando}
        aoFechar={() => setCompartilhando(false)}
        tipo="musica"
        alvoId={dados.id}
        shares={dados.compartilhamentos ?? []}
        aoMudar={carregar}
      />
    </div>
  );
}
