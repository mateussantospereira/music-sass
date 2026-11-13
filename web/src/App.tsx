import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { PlayerProvider } from "./lib/player";
import { ToastProvider } from "./components/ui/toast";
import { PainelLayout } from "./components/PainelLayout";
import { Landing } from "./pages/Landing";
import { Entrar } from "./pages/Entrar";
import { RecuperarSenha, ResetPassword } from "./pages/RecuperarSenha";
import { Biblioteca } from "./pages/Biblioteca";
import { Adicionar } from "./pages/Adicionar";
import { MusicaDetalhe } from "./pages/MusicaDetalhe";
import { Playlists } from "./pages/Playlists";
import { PlaylistDetalhe } from "./pages/PlaylistDetalhe";
import { Plano } from "./pages/Plano";
import { AdminUsuarios } from "./pages/AdminUsuarios";
import { AdminLogs } from "./pages/AdminLogs";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PlayerProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Entrar modoInicial="login" />} />
              <Route path="/cadastro" element={<Entrar modoInicial="cadastro" />} />
              <Route path="/recuperar" element={<RecuperarSenha />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/painel" element={<PainelLayout />}>
                <Route index element={<Navigate to="biblioteca" replace />} />
                <Route path="biblioteca" element={<Biblioteca />} />
                <Route path="musicas/:id" element={<MusicaDetalhe />} />
                <Route path="playlists" element={<Playlists />} />
                <Route path="playlists/:id" element={<PlaylistDetalhe />} />
                <Route path="adicionar" element={<Adicionar />} />
                <Route path="plano" element={<Plano />} />
                <Route path="usuarios" element={<AdminUsuarios />} />
                <Route path="logs" element={<AdminLogs />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </PlayerProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
