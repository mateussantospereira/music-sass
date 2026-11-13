import * as React from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check, CreditCard, Minus, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";

type StatusPlano = {
  premium: boolean;
  plano: string;
  limiteMusicas: number | null;
  musicas: number;
  restantes: number | null;
  preco: string;
  stripeConfigurado: boolean;
};

export function Plano() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = React.useState<StatusPlano | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [redirecionando, setRedirecionando] = React.useState(false);

  React.useEffect(() => {
    api<StatusPlano>("/api/plano/status").then(({ ok, data }) => {
      if (ok && data) setStatus(data);
      setCarregando(false);
    });
  }, []);

  React.useEffect(() => {
    const checkout = params.get("checkout");
    if (!checkout) return;
    toast(checkout === "sucesso" ? "ok" : "info",
      checkout === "sucesso" ? "Assinatura confirmada! O Pro será ativado pelo webhook em instantes." : "Checkout cancelado. Nenhuma cobrança foi feita.");
    params.delete("checkout");
    setParams(params, { replace: true });
  }, [params, setParams, toast]);

  async function assinar() {
    setRedirecionando(true);
    const { ok, status: httpStatus, data } = await api<{ url?: string; error?: string }>("/api/plano/checkout", { method: "POST", body: {} });
    setRedirecionando(false);
    if (ok && data?.url) {
      window.location.href = data.url;
      return;
    }
    toast("error", (data as { error?: string } | null)?.error ?? (httpStatus === 503 ? "Pagamentos não configurados neste ambiente." : "Não foi possível abrir o checkout."));
  }

  const ehPro = Boolean(usuario?.premium);
  const gratuitoItens: [string, boolean][] = [
    ["Até 10 músicas na biblioteca", true],
    ["Playlists ilimitadas", true],
    ["Compartilhar com ouvintes", true],
    ["Stream de áudio no navegador", true],
    ["Músicas ilimitadas", false],
  ];
  const proItens: [string, boolean][] = [
    ["Músicas ilimitadas", true],
    ["Tudo do plano Gratuito", true],
    ["Suporte prioritário", true],
    ["Para curadores e times", true],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">plano</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-bold tracking-tight"><Sparkles size={28} /> Gratuito ou Pro?</h1>
      <p className="mt-1 text-sm text-muted-foreground">O pagamento é no Stripe hospedado — nenhum dado de cartão passa por aqui.</p>

      {carregando ? (
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      ) : status && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">seu plano agora</p>
            <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
              {ehPro ? "Pro" : "Gratuito"} {ehPro && <Badge>Pro</Badge>}
            </p>
            {!ehPro && status.limiteMusicas != null && (
              <p className="mt-1 text-sm text-muted-foreground">{status.musicas} de {status.limiteMusicas} músicas usadas · faltam {status.restantes}</p>
            )}
          </div>
          {!ehPro && (
            <Button size="lg" onClick={assinar} disabled={redirecionando}>
              <CreditCard size={18} /> {redirecionando ? "Abrindo checkout…" : `Assinar Pro — ${status.preco}`}
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          { nome: "Gratuito", preco: "R$ 0", itens: gratuitoItens, destaque: false },
          { nome: "Pro", preco: status?.preco ?? "R$ 29,00/mês", itens: proItens, destaque: true },
        ].map((plano) => (
          <div key={plano.nome} className={`rounded-2xl border p-6 ${plano.destaque ? "border-primary bg-primary text-primary-foreground" : "bg-card"} shadow-[var(--shadow-card)]`}>
            <p className={`font-mono text-xs uppercase tracking-widest ${plano.destaque ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{plano.nome}</p>
            <p className="mt-2 font-display text-4xl font-bold">{plano.preco}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {plano.itens.map(([texto, incluso]) => (
                <li key={texto} className="flex items-center gap-2">
                  {incluso
                    ? <Check size={16} className={plano.destaque ? "" : "text-primary"} />
                    : <Minus size={16} className={plano.destaque ? "opacity-50" : "text-muted-foreground"} />}
                  <span className={incluso ? "" : plano.destaque ? "opacity-60" : "text-muted-foreground"}>{texto}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Dúvidas sobre cobrança? Fale com o admin do workspace.{" "}
        <Link to="/painel/biblioteca" className="underline underline-offset-4 hover:text-foreground">Voltar para a biblioteca</Link>
      </p>
    </div>
  );
}
