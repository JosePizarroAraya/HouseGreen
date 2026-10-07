import { Routes, Route, Link } from "react-router-dom";
import { PropertiesPage } from "./pages/PropertiesPage";
import { PropertyDetailPage } from "./pages/PropertyDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminPublicacionesPage } from "./pages/admin/AdminPublicacionesPage";
import { AdminPublicacionDetallePage } from "./pages/admin/AdminPublicacionDetallePage";
import { AdminEditarPublicacionPage } from "./pages/admin/AdminEditarPublicacionPage";
import { AdminSemaforoPage } from "./pages/admin/AdminSemaforoPage";
import { AdminOpinionesPage } from "./pages/admin/AdminOpinionesPage";
import { AdminPanelPage } from "./pages/admin/AdminPanelPage";
import { AdminUsuariosPage } from "./pages/admin/AdminUsuariosPage";
import { AdminAnunciosPage } from "./pages/admin/AdminAnunciosPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { useAlerts } from "./context/AlertsContext";
import { useAnuncios } from "./context/AnunciosContext";
import { RegisterPage } from "./pages/RegisterPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PerfilPage } from "./pages/PerfilPage";
import { OpinionesPage } from "./pages/OpinionesPage";


function App() {
  const { estaLogueado, esAdmin, cerrarSesion } = useAuth();
  const { noLeidas } = useAlerts();
  const { sinLeer } = useAnuncios();
  // Paso 90: el número rojo junto a "Alertas" suma las notificaciones y los anuncios sin leer
  const pendientes = noLeidas + sinLeer;

  return (
    <div>
      <header className="app-header">
        <Link to="/" className="app-logo">
          HouseGreen
        </Link>

        {estaLogueado && (
          <div className="app-header-actions">
            {esAdmin && (
              <Link to="/admin" className="app-alerts-link">
                Admin
              </Link>
            )}
            <Link to="/alertas" className="app-alerts-link">
              Alertas {pendientes > 0 && <span className="app-alerts-badge">{pendientes}</span>}
            </Link>
            {/* Paso 82: el administrador ve las opiniones en su panel; el resto las envía desde aquí */}
            {!esAdmin && (
              <Link to="/opiniones" className="app-alerts-link">
                Opinar
              </Link>
            )}
            <Link to="/perfil" className="app-alerts-link">
              Perfil
            </Link>
            <button onClick={cerrarSesion} className="app-logout-btn">
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PropertiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/propiedades/:id"
          element={
            <ProtectedRoute>
              <PropertyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alertas"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opiniones"
          element={
            <ProtectedRoute>
              <OpinionesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <PerfilPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute soloAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminPanelPage />} />
          <Route path="publicaciones" element={<AdminPublicacionesPage />} />
          <Route path="publicaciones/:id" element={<AdminPublicacionDetallePage />} />
          <Route path="publicaciones/:id/editar" element={<AdminEditarPublicacionPage />} />
          <Route path="semaforo" element={<AdminSemaforoPage />} />
          <Route path="opiniones" element={<AdminOpinionesPage />} />
          <Route path="usuarios" element={<AdminUsuariosPage />} />
          <Route path="anuncios" element={<AdminAnunciosPage />} />
        </Route>

        {/* Cualquier otra dirección: aviso en vez de página en blanco */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;