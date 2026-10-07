import { Link, useLocation } from "react-router-dom";

// Se muestra cuando la dirección no coincide con ninguna ruta.
// Usa el mismo aviso a página completa que el resto de la aplicación (.app-aviso, en index.css).
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="app-aviso">
      {/* El semáforo de HouseGreen con la luz roja encendida: por aquí no se pasa */}
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#0f3d30" />
        <circle cx="32" cy="15" r="7.5" fill="#ef4444" />
        <circle cx="32" cy="32" r="7.5" fill="#1f5747" />
        <circle cx="32" cy="49" r="7.5" fill="#1f5747" />
      </svg>

      <h1>Página no encontrada</h1>
      <p>
        La dirección <strong>{pathname}</strong> no existe en HouseGreen.
      </p>
      <Link to="/" className="app-aviso-boton">
        Ir a los remates
      </Link>
    </div>
  );
}