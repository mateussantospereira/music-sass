export type Musica = {
  id: number;
  usuarioId: number;
  donoNome?: string;
  titulo: string;
  artista: string | null;
  origemUrl: string | null;
  duracaoSeg: number | null;
  status: "processando" | "pronta" | "erro" | string;
  temAudio: boolean;
  temCapa?: boolean;
  contentType?: string | null;
  tamanho: number | null;
  erroMsg?: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
  compartilhadaComigo?: boolean;
};

export type PlaylistResumo = {
  id: number;
  usuarioId: number;
  donoNome?: string;
  nome: string;
  descricao: string | null;
  totalMusicas: number;
  criadoEm?: string;
  atualizadoEm?: string;
  compartilhadaComigo?: boolean;
};

export type Share = {
  id: number;
  usuarioId: number;
  nome: string;
  email: string;
  criadoEm?: string;
};

export type FaixaPlaylist = {
  id: number;
  titulo: string;
  artista: string | null;
  duracaoSeg: number | null;
  status: string;
  temAudio: boolean;
  ordem: number;
};

export type PlaylistDetalhe = PlaylistResumo & {
  musicas: FaixaPlaylist[];
  compartilhamentos: Share[];
};

export type Ouvinte = { id: number; nome: string; email: string };
