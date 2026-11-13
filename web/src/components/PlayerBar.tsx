import { Link } from "react-router-dom";
import { Music, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { usePlayer } from "../lib/player";
import { formatarTempo } from "../lib/format";
import { Button } from "./ui/button";

export function PlayerBar() {
  const { atual, tocando, progresso, duracao, alternar, proxima, anterior, buscar, parar } = usePlayer();
  if (!atual) return null;

  const pct = duracao > 0 ? (progresso / duracao) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-lg">
      {/* Barra de progresso clicável */}
      <button
        className="group relative block h-1.5 w-full bg-muted"
        aria-label="Buscar na faixa"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          const frac = (e.clientX - rect.left) / rect.width;
          if (duracao > 0) buscar(Math.max(0, Math.min(duracao, frac * duracao)));
        }}
      >
        <span className="block h-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </button>

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:gap-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Music size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/painel/musicas/${atual.id}`} className="block truncate text-sm font-semibold hover:underline">
            {atual.titulo}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {atual.artista ?? "Artista desconhecido"} · {formatarTempo(progresso)} / {formatarTempo(duracao)}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={anterior} aria-label="Anterior">
            <SkipBack size={18} />
          </Button>
          <Button size="icon" onClick={alternar} aria-label={tocando ? "Pausar" : "Tocar"} className="h-11 w-11 rounded-full">
            {tocando ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={proxima} aria-label="Próxima">
            <SkipForward size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={parar} aria-label="Fechar player">
            <X size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
