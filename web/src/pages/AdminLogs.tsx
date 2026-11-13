import * as React from "react";
import { ScrollText, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AcessoNegado } from "../components/AcessoNegado";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";

type Evento = {
  acao?: string;
  usuario?: string | null;
  papel?: string | null;
  recurso?: string | null;
  detalhe?: string | null;
  ip?: string | null;
  quando?: string;
  ts?: number | string;
  timestamp?: string;
  origem?: string;
};

function quando(e: Evento): string {
  const bruto = e.quando ?? e.timestamp ?? (e.ts ? new Date(Number(e.ts)).toISOString() : null);
  if (!bruto) return "—";
  const d = new Date(bruto);
  return Number.isNaN(d.getTime()) ? String(bruto) : d.toLocaleString("pt-BR");
}

export function AdminLogs() {
  const { temPermissao } = useAuth();
  const [eventos, setEventos] = React.useState<Evento[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [busca, setBusca] = React.useState("");

  React.useEffect(() => {
    if (!temPermissao("consultar:logs")) return;
    api<{ eventos?: Evento[]; logs?: Evento[] } | Evento[]>("/api/logs?limite=100").then(({ ok, data }) => {
      if (ok && data) {
        const lista = Array.isArray(data) ? data : data.eventos ?? data.logs ?? [];
        setEventos(lista);
      }
      setCarregando(false);
    });
  }, [temPermissao]);

  if (!temPermissao("consultar:logs")) return <AcessoNegado />;

  const filtrados = eventos.filter((e) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [e.acao, e.usuario, e.recurso, e.detalhe, e.papel].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const corPorAcao = (a?: string): "danger" | "success" | "muted" | "warn" => {
    if (!a) return "muted";
    if (a.includes("negada") || a.includes("falhou") || a.includes("removida")) return "danger";
    if (a.includes("criada") || a.includes("pronta") || a.includes("compartilhada")) return "success";
    if (a.includes("baixada") || a.includes("reproduzida")) return "warn";
    return "muted";
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">auditoria</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold tracking-tight"><ScrollText size={28} /> Eventos de negócio</h1>
      <p className="mt-1 text-sm text-muted-foreground">Stream do Redis lido pelo log-service: quem fez o quê, quando e de onde.</p>

      <div className="relative mt-5 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por ação, usuário, recurso…" className="pl-10" aria-label="Filtrar eventos" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        {carregando ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtrados.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Quem</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Detalhe</th></tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((e, i) => (
                  <tr key={i} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{quando(e)}</td>
                    <td className="px-4 py-3"><Badge variant={corPorAcao(e.acao)} className="font-mono normal-case">{e.acao ?? "evento"}</Badge></td>
                    <td className="px-4 py-3">{e.usuario ?? e.usuario === null ? <span className="text-muted-foreground">sistema</span> : e.usuario}{e.papel && <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">{e.papel}</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.recurso ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">{e.detalhe ?? "—"}{e.ip && <span className="mt-0.5 block font-mono text-[10px]">ip {e.ip}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
