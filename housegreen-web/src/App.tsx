import { Routes, Route, Link } from "react-router-dom";
import { PropertiesPage } from "./pages/PropertiesPage";
import { PropertyDetailPage } from "./pages/PropertyDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { EnConstruccion } from "./pages/admin/EnConstruccion";
import { AdminPublicacionesPage } from "./pages/admin/AdminPublicacionesPage";
import { AdminPublicacionDetallePage } from "./pages/admin/AdminPublicacionDetallePage";
import { AdminEditarPublicacionPage } from "./pages/admin/AdminEditarPublicacionPage";
import { AdminSemaforoPage } from "./pages/admin/AdminSemaforoPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { useAlerts } from "./context/AlertsContext";
import { RegisterPage } from "./pages/RegisterPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  const { estaLogueado, esAdmin, cerrarSesion } = useAuth();
  const { noLeidas } = useAlerts();

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
              Alertas {noLeidas > 0 && <span className="app-alerts-badge">{noLeidas}</span>}
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
          path="/admin"
          element={
            <ProtectedRoute soloAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EnConstruccion titulo="Panel" descripcion="Resumen de los últimos 7 días." />} />

          <Route path="publicaciones" element={<AdminPublicacionesPage />} />

          <Route path="publicaciones/:id" element={<AdminPublicacionDetallePage />} />

          <Route path="publicaciones/:id/editar" element={<AdminEditarPublicacionPage />} />
          
          <Route path="semaforo" element={<AdminSemaforoPage />} />


          <Route
            path="opiniones"
            element={<EnConstruccion titulo="Opiniones" descripcion="Sugerencias y calificaciones de la app." />}
          />

          <Route
            path="anuncios"
            element={<EnConstruccion titulo="Anuncios" descripcion="Mensajes para todos o para un grupo de usuarios." />}
          />

        </Route>
        
        {/* Cualquier otra dirección: aviso en vez de página en blanco */}
        <Route path="*" element={<NotFoundPage />} />
        
      </Routes>
    </div>
  );
}

export default App;