import { NavLink, Outlet } from "react-router-dom";
import "./AdminLayout.css";

// Las cuatro secciones del menú del administrador (como en el prototipo)
const SECCIONES = [
  { ruta: "/admin", texto: "Panel", exacta: true },
  { ruta: "/admin/publicaciones", texto: "Publicaciones", exacta: false },
  { ruta: "/admin/opiniones", texto: "Opiniones", exacta: false },
  { ruta: "/admin/anuncios", texto: "Anuncios", exacta: false },
];

// Marco común de todas las pantallas del admin: distintivo, menú y el contenido
// de la sección elegida (<Outlet /> muestra la página hija según la ruta).
export function AdminLayout() {
  return (
    <div className="admin-layout">
      <span className="admin-chip">Administrador</span>

      <nav className="admin-nav" aria-label="Secciones del administrador">
        {SECCIONES.map((s) => (
          <NavLink
            key={s.ruta}
            to={s.ruta}
            end={s.exacta}
            className={({ isActive }) => `admin-nav-link ${isActive ? "is-activo" : ""}`}
          >
            {s.texto}
          </NavLink>
        ))}
      </nav>

      <main className="admin-contenido">
        <Outlet />
      </main>
    </div>
  );
}