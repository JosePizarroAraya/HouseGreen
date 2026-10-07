import { Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
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


// Clases de un enlace del menú: el de la sección actual queda marcado
function claseDelEnlace({ isActive }: { isActive: boolean }) {
  return `app-nav-link ${isActive ? "is-activo" : ""}`;
}

function App() {
  const { estaLogueado, esAdmin, cerrarSesion } = useAuth();
  const { noLeidas } = useAlerts();
  const { sinLeer } = useAnuncios();
  // Paso 90: el número rojo junto a "Alertas" suma las notificaciones y los anuncios sin leer
  const pendientes = noLeidas + sinLeer;

  // "Remates" queda marcado en el catálogo y también dentro del detalle de una propiedad
  const { pathname } = useLocation();
  const enRemates = pathname === "/" || pathname.startsWith("/propiedades");

  return (
    <div>
      <header className={`app-header ${estaLogueado ? "is-con-menu" : ""}`}>
        <Link to="/" className="app-logo">
          {/* El mismo dibujo del ícono de la pestaña (public/favicon.svg) */}
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#0f3d30" />
            <circle cx="32" cy="15" r="7.5" fill="#ef4444" />
            <circle cx="32" cy="32" r="7.5" fill="#facc15" />
            <circle cx="32" cy="49" r="7.5" fill="#22c55e" />
          </svg>
          <span className="app-logo-nombre">HouseGreen</span>
        </Link>

        {estaLogueado && (
          <nav className="app-header-actions" aria-label="Menú principal">
            <Link to="/" className={`app-nav-link app-nav-inicio ${enRemates ? "is-activo" : ""}`}>
              Remates
            </Link>
            {esAdmin && (
              <NavLink to="/admin" className={claseDelEnlace}>
                Admin
              </NavLink>
            )}
            <NavLink to="/alertas" className={claseDelEnlace}>
              Alertas{" "}
              {/* Con más de 9 se muestra "9+", para que el número no ensanche el menú */}
              {pendientes > 0 && <span className="app-alerts-badge">{pendientes > 9 ? "9+" : pendientes}</span>}
            </NavLink>
            {/* Paso 82: el administrador ve las opiniones en su panel; el resto las envía desde aquí */}
            {!esAdmin && (
              <NavLink to="/opiniones" className={claseDelEnlace}>
                Opinar
              </NavLink>
            )}
            <NavLink to="/perfil" className={claseDelEnlace}>
              Perfil
            </NavLink>
            <button onClick={cerrarSesion} className="app-logout-btn">
              Cerrar sesión
            </button>
          </nav>
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