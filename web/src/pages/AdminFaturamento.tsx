import * as React from "react";
import { CircleDollarSign, Users, BadgeCheck, TrendingUp, Minus } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AcessoNegado } from "../components/AcessoNegado";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { formatarData } from "../lib/format";

type Resumo = {
  usuarios: { total: number; gratuito: number; pro: number };
  assinaturas: { ativas: number; inadimplentes: number; canceladas: number; pendentes: number };
  mrr: number;
  valorMensal: number;
  preco: string;
  stripeConfigurado: boolean;
  eventos: {
    id?: string;
    timestamp?: string;
    acao?: string;
    usuario?: string | null;
    recurso?: string | null;
    detalhe?: string | null;
  }[];
};

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const COR_ACAO = (a?: string): "danger" | "success" | "warn" | "muted" => {
  if (!a) return "muted";
  if (a.includes("cancelad") || a.includes("inadimplente") || a.includes("negada") || a.includes("falhou")) return "danger";
  if (a.includes("ativ") || a.includes("pronta") || a.includes("compartilhada")) return "success";
  return "warn";
};

export function AdminFaturamento() {
  const { temPermissao } = useAuth();
  const [dados, setDados] = React.useState<Resumo | null>(null);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    if (!temPermissao("ver:faturamento")) return;
    api<Resumo>("/api/plano/resumo").then(({ ok, data }) => {
      if (ok && data) setDados(data);
      setCarregando(false);
    });
  }, [temPermissao]);

  if (!temPermissao("ver:faturamento")) return <AcessoNegado />;

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }

  if (!dados) {
    return <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Não foi possível carregar o resumo de faturamento.</p>;
  }

  const cartoes = [
    { icone: Users, rotulo: "Usuários no total", valor: String(dados.usuarios.total), detalhe: `${dados.usuarios.gratuito} Free · ${dados.usuarios.pro} Pro` },
    { icone: BadgeCheck, rotulo: "Assinaturas ativas", valor: String(dados.assinaturas.ativas), detalhe: `${dados.assinaturas.inadimplentes} inadimplentes · ${dados.assinaturas.canceladas} canceladas` },
    { icone: TrendingUp, rotulo: "MRR (modo de teste)", valor: moeda(dados.mrr), detalhe: `${moeda(dados.valorMensal)} × ${dados.assinaturas.ativas} ativa(s)` },
    { icone: CircleDollarSign, rotulo: "Plano Pro", valor: dados.preco.replace("/mês", ""), detalhe: "cobrado mensalmente, no modo de teste do Stripe" },
  ];

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">administração</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold tracking-tight"><CircleDollarSign size={28} /> Faturamento</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Visão geral do SaaS em modo de teste: quem está em cada plano, quantas assinaturas estão de pé e
        quanto o produto fatura por mês (MRR).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map(({ icone: Icone, rotulo, valor, detalhe }) => (
          <div key={rotulo} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icone size={19} />
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{rotulo}</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight">{valor}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Usuários por plano */}
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">usuários por plano</p>
          <div className="mt-4 space-y-3">
            {[
              { rotulo: "Gratuito", n: dados.usuarios.gratuito, classe: "bg-muted text-muted-foreground" },
              { rotulo: "Pro", n: dados.usuarios.pro, classe: "bg-primary text-primary-foreground" },
            ].map((p) => {
              const pct = dados.usuarios.total ? Math.round((p.n / dados.usuarios.total) * 100) : 0;
              return (
                <div key={p.rotulo}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{p.rotulo}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.n} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${p.classe === "bg-primary text-primary-foreground" ? "bg-primary" : "bg-muted-foreground/50"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">assinaturas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="success">{dados.assinaturas.ativas} ativas</Badge>
            {dados.assinaturas.inadimplentes > 0 && <Badge variant="warn">{dados.assinaturas.inadimplentes} inadimplentes</Badge>}
            {dados.assinaturas.canceladas > 0 && <Badge variant="muted">{dados.assinaturas.canceladas} canceladas</Badge>}
            {dados.assinaturas.pendentes > 0 && <Badge variant="muted">{dados.assinaturas.pendentes} pendentes</Badge>}
          </div>
        </div>

        {/* Últimos eventos */}
        <div className="rounded-2xl border bg-card shadow-[var(--shadow-card)] lg:col-span-3">
          <div className="border-b p-5 pb-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">últimos eventos do log</p>
          </div>
          <ul className="divide-y">
            {dados.eventos.length === 0 && <li className="p-5 text-sm text-muted-foreground">Nenhum evento recente.</li>}
            {dados.eventos.map((e, i) => (
              <li key={e.id ?? i} className="flex items-center gap-3 px-5 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COR_ACAO(e.acao) === "danger" ? "bg-destructive" : COR_ACAO(e.acao) === "success" ? "bg-emerald-600" : "bg-muted-foreground/60"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.acao ?? "evento"} <span className="font-normal text-muted-foreground">{e.usuario ?? "sistema"}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{e.recurso ?? "—"}{e.detalhe ? ` · ${e.detalhe}` : ""}</p>
                </div>
                <time className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">{e.timestamp ? formatarData(e.timestamp) : "—"}</time>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!dados.stripeConfigurado && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <Minus size={16} /> Stripe ainda não configurado neste ambiente — o painel mostra zeros até que STRIPE_SECRET_KEY e STRIPE_PRICE_ID sejam definidas na stack.
        </p>
      )}
    </div>
  );
}
