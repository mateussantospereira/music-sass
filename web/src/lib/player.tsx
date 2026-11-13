import * as React from "react";
import { urlComToken } from "./api";

export type Faixa = {
  id: number;
  titulo: string;
  artista: string | null;
  status?: string;
  temAudio?: boolean;
};

type PlayerContexto = {
  atual: Faixa | null;
  tocando: boolean;
  progresso: number;
  duracao: number;
  fila: Faixa[];
  posicao: number;
  playFaixas: (faixas: Faixa[], indice: number) => void;
  tocar: (faixa: Faixa) => void;
  alternar: () => void;
  proxima: () => void;
  anterior: () => void;
  buscar: (segundos: number) => void;
  parar: () => void;
};

const Contexto = React.createContext<PlayerContexto | null>(null);

export function usePlayer(): PlayerContexto {
  const ctx = React.useContext(Contexto);
  if (!ctx) throw new Error("usePlayer fora do PlayerProvider");
  return ctx;
}

const tocaveis = (f: Faixa) => f.status === "pronta" && f.temAudio !== false;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [fila, setFila] = React.useState<Faixa[]>([]);
  const [posicao, setPosicao] = React.useState(0);
  const [tocando, setTocando] = React.useState(false);
  const [progresso, setProgresso] = React.useState(0);
  const [duracao, setDuracao] = React.useState(0);

  const atual = fila[posicao] ?? null;

  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }

  const carregarETocar = React.useCallback((faixa: Faixa) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = urlComToken(`/api/musicas/${faixa.id}/stream`);
    setProgresso(0);
    setDuracao(0);
    audio.play().then(() => setTocando(true)).catch(() => setTocando(false));
  }, []);

  const playFaixas = React.useCallback((faixas: Faixa[], indice: number) => {
    const tocaveisLista = faixas.filter(tocaveis);
    if (!tocaveisLista.length) return;
    const alvo = tocaveisLista.findIndex((f) => f.id === faixas[indice]?.id);
    setFila(tocaveisLista);
    const pos = alvo >= 0 ? alvo : 0;
    setPosicao(pos);
    carregarETocar(tocaveisLista[pos]);
  }, [carregarETocar]);

  const tocar = React.useCallback((faixa: Faixa) => {
    if (!tocaveis(faixa)) return;
    setFila([faixa]);
    setPosicao(0);
    carregarETocar(faixa);
  }, [carregarETocar]);

  const proxima = React.useCallback(() => {
    setPosicao((pos) => {
      const prox = pos + 1;
      if (prox >= fila.length) {
        setTocando(false);
        return pos;
      }
      carregarETocar(fila[prox]);
      return prox;
    });
  }, [fila, carregarETocar]);

  const anterior = React.useCallback(() => {
    const audio = audioRef.current;
    // Se passou de 3s, volta ao início; senão, faixa anterior.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setPosicao((pos) => {
      const ant = Math.max(0, pos - 1);
      carregarETocar(fila[ant]);
      return ant;
    });
  }, [fila, carregarETocar]);

  const alternar = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !atual) return;
    if (audio.paused) {
      audio.play().then(() => setTocando(true)).catch(() => {});
    } else {
      audio.pause();
      setTocando(false);
    }
  }, [atual]);

  const buscar = React.useCallback((segundos: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = segundos;
    setProgresso(segundos);
  }, []);

  const parar = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setFila([]);
    setPosicao(0);
    setTocando(false);
    setProgresso(0);
    setDuracao(0);
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgresso(audio.currentTime);
    const onMeta = () => setDuracao(audio.duration || 0);
    const onEnded = () => proxima();
    const onPause = () => setTocando(false);
    const onPlay = () => setTocando(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [proxima]);

  return (
    <Contexto.Provider
      value={{ atual, tocando, progresso, duracao, fila, posicao, playFaixas, tocar, alternar, proxima, anterior, buscar, parar }}
    >
      {children}
    </Contexto.Provider>
  );
}
