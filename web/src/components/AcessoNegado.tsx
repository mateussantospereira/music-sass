import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function AcessoNegado({ mensagem }: { mensagem?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed p-10 text-center">
      <ShieldX size={40} className="mx-auto text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Acesso negado</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mensagem ?? "O seu papel não tem permissão para ver esta página. A API responde 403 — e a tela também."}
      </p>
      <Link to="/painel/biblioteca" className="mt-6 inline-block"><Button variant="outline">Voltar para a biblioteca</Button></Link>
    </div>
  );
}
