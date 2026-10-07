import { Link, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  soloAdmin?: boolean; // true = además de iniciar sesión, tiene que ser administrador
}

export function ProtectedRoute({ children, soloAdmin = false }: ProtectedRouteProps) {
  const { usuario, estaLogueado, esAdmin, verificandoSesion } = useAuth();

  // Mientras se revisa el token guardado, todavía no sabemos si hay sesión
  if (verificandoSesion) {
    return <p style={{ textAlign: "center", marginTop: 48 }}>Cargando...</p>;
  }

  // Si no está logueado, <Navigate> lo redirige a /login automáticamente,
  // sin siquiera mostrar el contenido protegido ni un instante.
  if (!estaLogueado) {
    return <Navigate to="/login" replace />;
  }

  // Si la página es solo para administradores y no lo es, vuelve al listado.
  // (La API igual rechaza con 403 a quien no es admin; esto solo esconde la pantalla.)
  if (soloAdmin && !esAdmin) {
    return <Navigate to="/" replace />;
  }

  // Paso 80: el administrador debe tener activada la verificación en dos pasos.
  // Si todavía no la activa, en vez del panel ve este aviso (la API también lo rechaza con 403).
  if (soloAdmin && usuario?.two_fa_required && !usuario.two_fa_enabled) {
    return (
      <div className="app-aviso">
        <h1>Activa la verificación en dos pasos</h1>
        <p>
          Las cuentas de administrador deben usar verificación en dos pasos. Actívala en tu Perfil para entrar al
          panel de administración.
        </p>
        <Link to="/perfil" className="app-aviso-boton">
          Ir a mi Perfil
        </Link>
      </div>
    );
  }

  // Si todo está bien, muestra lo que sea que le hayamos puesto adentro (children)
  return <>{children}</>;
}