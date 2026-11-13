import * as React from "react";
import { Check, Share2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./ui/toast";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import type { Ouvinte, Share } from "../lib/tipos";

type Props = {
  aberto: boolean;
  aoFechar: () => void;
  tipo: "musica" | "playlist";
  alvoId: number;
  shares: Share[];
  aoMudar: () => void;
};

export function CompartilharDialog({ aberto, aoFechar, tipo, alvoId, shares, aoMudar }: Props) {
  const [ouvintes, setOuvintes] = React.useState<Ouvinte[]>([]);
  const [carregando, setCarregando] = React.useState(false);
  const [pendente, setPendente] = React.useState<number | null>(null);
  const toast = useToast();

  React.useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    api<{ usuarios: Ouvinte[] }>("/api/musicas/compartilhaveis").then(({ ok, data }) => {
      setOuvintes(ok && data ? data.usuarios : []);
      setCarregando(false);
    });
  }, [aberto]);

  const idsCompartilhados = new Set(shares.map((s) => s.usuarioId));

  async function alternar(ouvinte: Ouvinte) {
    setPendente(ouvinte.id);
    const base = tipo === "musica" ? `/api/musicas/${alvoId}/compartilhar` : `/api/playlists/${alvoId}/compartilhar`;
    if (idsCompartilhados.has(ouvinte.id)) {
      const { ok, data } = await api(`${base}/${ouvinte.id}`, { method: "DELETE" });
      if (!ok) toast("error", (data as { error?: string })?.error ?? "Não foi possível revogar.");
      else toast("ok", "Acesso revogado.");
    } else {
      const { ok, data } = await api(base, { body: { usuarioId: ouvinte.id } });
      if (!ok) toast("error", (data as { error?: string })?.error ?? "Não foi possível compartilhar.");
      else toast("ok", `Liberado para ${ouvinte.nome}.`);
    }
    setPendente(null);
    aoMudar();
  }

  return (
    <Dialog
      open={aberto}
      onClose={aoFechar}
      title="Compartilhar com um ouvinte"
      description="Ouvintes só enxergam o que você liberar aqui. Quem não estiver na lista recebe 403."
    >
      {carregando ? (
        <div className="flex items-center justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : ouvintes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum ouvinte cadastrado ainda. Promova alguém no papel de <strong>ouvinte</strong> em Usuários (admin) e volte aqui.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {ouvintes.map((o) => {
            const ativo = idsCompartilhados.has(o.id);
            return (
              <li key={o.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground">
                  {o.nome.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{o.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.email}</p>
                </div>
                <button
                  onClick={() => alternar(o)}
                  disabled={pendente === o.id}
                  aria-pressed={ativo}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    ativo ? "border-emerald-600/40 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {pendente === o.id ? <Spinner className="h-3.5 w-3.5" /> : ativo ? <Check size={13} /> : <Share2 size={13} />}
                  {ativo ? "Liberado" : "Liberar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={aoFechar}>Fechar</Button>
      </div>
    </Dialog>
  );
}
