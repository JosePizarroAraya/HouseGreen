import { Link, useLocation } from "react-router-dom";

// Se muestra cuando la dirección no coincide con ninguna ruta (antes la página quedaba en blanco)
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div style={{ maxWidth: 480, margin: "64px auto", padding: "0 16px", textAlign: "center" }}>
      <h1>Página no encontrada</h1>
      <p>
        No existe la dirección <code>{pathname}</code>.
      </p>
      <Link to="/">Ir al catálogo</Link>
    </div>
  );
}