export function formatarDuracao(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg)) return "—";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatarTempo(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg) || Number.isNaN(seg)) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatarBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function statusBadgeVariant(status: string): "success" | "warn" | "danger" | "muted" {
  switch (status) {
    case "pronta": return "success";
    case "processando": return "warn";
    case "erro": return "danger";
    default: return "muted";
  }
}

export function rotuloStatus(status: string): string {
  switch (status) {
    case "pronta": return "pronta";
    case "processando": return "extraindo…";
    case "erro": return "erro";
    default: return status;
  }
}
