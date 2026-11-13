import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, ListMusic, Library, PlusCircle, Sparkles, Users, ScrollText, Eraser, Banknote } from "lucide-react";
import { Logo } from "./LogoMark";
import { useAuth } from "../lib/auth";
import { usePlayer } from "../lib/player";
import { useToast } from "./ui/toast";
import { clearAudioCache } from "../lib/audioCache";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";

const LINKS = [
  { to: "/painel/biblioteca", label: "Biblioteca", icone: Library, perm: "ler:musica" },
  { to: "/painel/playlists", label: "Playlists", icone: ListMusic, perm: "gerenciar:playlist" },
  { to: "/painel/adicionar", label: "Adicionar", icone: PlusCircle, perm: "criar:musica" },
  { to: "/painel/plano", label: "Plano", icone: Sparkles, perm: null },
  { to: "/painel/usuarios", label: "Usuários", icone: Users, perm: "listar:usuarios" },
  { to: "/painel/logs", label: "Auditoria", icone: ScrollText, perm: "consultar:logs" },
  { to: "/painel/faturamento", label: "Faturamento", icone: Banknote, perm: "ver:faturamento" },
] as const;

export function Topbar() {
  const { usuario, sair, temPermissao } = useAuth();
  const { atual } = usePlayer();
  const toast = useToast();
  const navigate = useNavigate();

  const links = LINKS.filter((l) => !l.perm || temPermissao(l.perm));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <NavLink to="/painel/biblioteca" aria-label="Riff — início">
          <Logo />
        </NavLink>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {links.map(({ to, label, icone: Icone }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground"
                )
              }
            >
              <Icone size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {usuario?.premium && <Badge variant="default">Pro</Badge>}
          <div className="hidden text-right sm:block">
            <p className="max-w-[140px] truncate text-sm font-semibold leading-tight">{usuario?.nome}</p>
            <p className="flex items-center justify-end gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck size={11} aria-hidden />
              {usuario?.role}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpar cache de áudio"
            title="Limpar cache de áudio"
            onClick={async () => {
              await clearAudioCache();
              toast("ok", "Cache de áudio limpo.");
            }}
          >
            <Eraser size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sair"
            title="Sair"
            onClick={async () => {
              await sair();
              navigate("/login");
            }}
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      {/* Nav mobile: rolagem horizontal */}
      <nav className="flex gap-1 overflow-x-auto border-t px-2 py-1.5 md:hidden" aria-label="Navegação móvel">
        {links.map(({ to, label, icone: Icone }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
                isActive && "bg-muted text-foreground"
              )
            }
          >
            <Icone size={14} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      {atual && <div className="h-0" aria-hidden />}
    </header>
  );
}
