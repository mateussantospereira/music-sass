import * as React from "react";
import { Users } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";
import { useAuth } from "../lib/auth";
import { AcessoNegado } from "../components/AcessoNegado";
import { Badge } from "../components/ui/badge";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { formatarData } from "../lib/format";
import type { Papel } from "../lib/auth";

type UsuarioAdmin = { id: number; nome: string; email: string; role: Papel; premium: boolean; criadoEm: string | null };
const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: "admin", rotulo: "admin" },
  { valor: "curador", rotulo: "curador" },
  { valor: "ouvinte", rotulo: "ouvinte" },
];

export function AdminUsuarios() {
  const { temPermissao, usuario: eu } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = React.useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [pendente, setPendente] = React.useState<number | null>(null);

  const carregar = React.useCallback(async () => {
    const { ok, data } = await api<{ usuarios: UsuarioAdmin[] }>("/api/usuarios");
    if (ok && data) setUsuarios(data.usuarios);
    setCarregando(false);
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  if (!temPermissao("listar:usuarios")) return <AcessoNegado />;

  async function trocarPapel(alvo: UsuarioAdmin, role: Papel) {
    setPendente(alvo.id);
    const { ok, data } = await api(`/api/usuarios/${alvo.id}/role`, { method: "PATCH", body: { role } });
    setPendente(null);
    if (!ok) {
      toast("error", (data as { error?: string } | null)?.error ?? "Não foi possível alterar o papel.");
      return;
    }
    toast("ok", `Papel de ${alvo.nome} → ${role}.`);
    carregar();
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">administração</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold tracking-tight"><Users size={28} /> Usuários e papéis</h1>
      <p className="mt-1 text-sm text-muted-foreground">Somente admin. A troca vale na API imediatamente — a sessão do usuário muda no próximo /me.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Cadastrado</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Papel</th></tr>
            </thead>
            <tbody className="divide-y">
              {carregando && [1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {usuarios.map((u) => (
                <tr key={u.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold leading-tight">{u.nome}{u.id === eu?.usuarioId && <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">(você)</span>}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatarData(u.criadoEm)}</td>
                  <td className="px-4 py-3">{u.premium ? <Badge>Pro</Badge> : <Badge variant="muted">Gratuito</Badge>}</td>
                  <td className="px-4 py-3">
                    <Select value={u.role} disabled={pendente === u.id} onChange={(e) => trocarPapel(u, e.target.value as Papel)} aria-label={`Papel de ${u.nome}`} className="w-36">
                      {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
