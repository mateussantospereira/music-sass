import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

export type TipoToast = "ok" | "info" | "error" | "warn";

type ToastItem = { id: number; tipo: TipoToast; texto: string };

const ToastContext = React.createContext<(tipo: TipoToast, texto: string) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const push = React.useCallback((tipo: TipoToast, texto: string) => {
    const id = ++idRef.current;
    setItens((atual) => [...atual, { id, tipo, texto }]);
    window.setTimeout(() => setItens((atual) => atual.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6">
        {itens.map((t) => {
          const Icone = t.tipo === "ok" ? CheckCircle2 : t.tipo === "error" ? XCircle : Info;
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg",
                t.tipo === "error" && "border-destructive/40 bg-[#fdf0ee] text-destructive",
                t.tipo === "warn" && "border-amber-400/60 bg-amber-50 text-amber-800",
                t.tipo === "info" && "border-border bg-card text-foreground",
                t.tipo === "ok" && "border-emerald-600/30 bg-emerald-50 text-emerald-800"
              )}
            >
              <Icone size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1 leading-snug">{t.texto}</p>
              <button onClick={() => setItens((a) => a.filter((x) => x.id !== t.id))} aria-label="Dispensar" className="opacity-60 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
