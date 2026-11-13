import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Topbar } from "./Topbar";
import { PlayerBar } from "./PlayerBar";
import { Spinner } from "./ui/spinner";

export function PainelLayout() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Topbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  );
}
