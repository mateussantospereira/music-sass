import * as React from "react";
import { api, obterToken, removerToken, salvarToken } from "./api";

export type Papel = "admin" | "curador" | "ouvinte";

export type Usuario = {
  usuarioId: number;
  nome: string;
  email: string;
  role: Papel;
  premium: boolean;
  permissoes: string[];
};

type AuthContexto = {
  usuario: Usuario | null;
  carregando: boolean;
  temPermissao: (permissao: string) => boolean;
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
};

const Contexto = React.createContext<AuthContexto | null>(null);

export function useAuth(): AuthContexto {
  const ctx = React.useContext(Contexto);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = React.useState<Usuario | null>(null);
  const [carregando, setCarregando] = React.useState(true);

  const recarregar = React.useCallback(async () => {
    const token = obterToken();
    if (!token) {
      setUsuario(null);
      setCarregando(false);
      return;
    }
    const { ok, data } = await api<Usuario>("/api/me");
    setUsuario(ok && data ? data : null);
    if (!ok) removerToken();
    setCarregando(false);
  }, []);

  React.useEffect(() => {
    recarregar();
  }, [recarregar]);

  const entrar = React.useCallback(async (email: string, senha: string) => {
    const { ok, data } = await api<{ token: string; nome: string; role: Papel }>("/api/login", {
      body: { email, senha },
    });
    if (!ok || !data?.token) {
      return { ok: false, erro: (data as { error?: string } | null)?.error ?? "E-mail ou senha inválidos." };
    }
    salvarToken(data.token);
    await recarregar();
    return { ok: true };
  }, [recarregar]);

  const cadastrar = React.useCallback(
    async (nome: string, email: string, senha: string) => {
      const registro = await api<{ message?: string }>("/api/register", { body: { nome, email, senha } });
      if (!registro.ok) {
        return { ok: false, erro: (registro.data as { error?: string } | null)?.error ?? "Não foi possível criar a conta." };
      }
      return entrar(email, senha);
    },
    [entrar]
  );

  const sair = React.useCallback(async () => {
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    removerToken();
    setUsuario(null);
  }, []);

  const temPermissao = React.useCallback(
    (permissao: string) => Boolean(usuario?.permissoes?.includes(permissao)),
    [usuario]
  );

  return (
    <Contexto.Provider value={{ usuario, carregando, temPermissao, entrar, cadastrar, sair, recarregar }}>
      {children}
    </Contexto.Provider>
  );
}
