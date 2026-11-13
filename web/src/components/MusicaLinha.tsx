import { CloudDownload, Music2, Pause, Pencil, Play, Share2, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { usePlayer } from "../lib/player";
import { baixarArquivo, urlComToken } from "../lib/api";
import { formatarBytes, formatarDuracao, rotuloStatus, statusBadgeVariant } from "../lib/format";
import type { Musica } from "../lib/tipos";

type Props = {
  musica: Musica;
  podeEditar: boolean;
  mostrarDono?: boolean;
  onEditar?: (m: Musica) => void;
  onApagar?: (m: Musica) => void;
  onCompartilhar?: (m: Musica) => void;
};

export function MusicaLinha({ musica, podeEditar, mostrarDono, onEditar, onApagar, onCompartilhar }: Props) {
  const { atual, tocando, tocar, alternar } = usePlayer();
  const tocavel = musica.status === "pronta" && musica.temAudio;
  const isAtual = atual?.id === musica.id;

  return (
    <div className="group flex items-center gap-3 border-b py-3 last:border-0 sm:gap-4">
      {/* Capa */}
      <button
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
        onClick={() => { if (tocavel) { if (isAtual) alternar(); else tocar(musica); } }}
        aria-label={tocavel ? (isAtual && tocando ? "Pausar" : "Tocar") : "Faixa ainda não disponível"}
      >
        {musica.temCapa ? (
          <img src={urlComToken(`/api/musicas/${musica.id}/capa`)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Music2 size={22} className="text-muted-foreground" />
        )}
        {tocavel && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {isAtual && tocando ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </span>
        )}
      </button>

      {/* Título/artista */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug">{musica.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">
          {musica.artista ?? "Artista desconhecido"}
          {mostrarDono && musica.donoNome ? ` · ${musica.donoNome}` : ""}
          {" · "}{formatarDuracao(musica.duracaoSeg)} · {formatarBytes(musica.tamanho)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={statusBadgeVariant(musica.status)}>{rotuloStatus(musica.status)}</Badge>
          {musica.compartilhadaComigo && <Badge variant="outline">compartilhada com você</Badge>}
        </div>
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          title="Baixar .m4a"
          aria-label="Baixar"
          disabled={musica.status !== "pronta"}
          onClick={() => baixarArquivo(`/api/musicas/${musica.id}/download`, `${musica.titulo}.m4a`)}
        >
          <CloudDownload size={18} />
        </Button>
        {podeEditar && (
          <>
            <Button variant="ghost" size="icon" title="Editar" aria-label="Editar" onClick={() => onEditar?.(musica)}><Pencil size={17} /></Button>
            <Button variant="ghost" size="icon" title="Compartilhar" aria-label="Compartilhar" onClick={() => onCompartilhar?.(musica)}><Share2 size={17} /></Button>
            <Button variant="ghost" size="icon" title="Remover" aria-label="Remover" className="text-destructive hover:text-destructive" onClick={() => onApagar?.(musica)}><Trash2 size={17} /></Button>
          </>
        )}
      </div>
    </div>
  );
}
