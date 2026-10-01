import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, guardarToken, borrarToken, obtenerToken } from "../api/client";

// id del rol administrador en la tabla roles (el mismo que revisa requerir_admin en la API)
const ROL_ADMIN_ID = 3;

// Lo que responde GET /auth/me
export interface UsuarioActual {
  id: string;
  email: string;
  full_name: string;
  role_id: number;
  phone: string | null;
  role_name: string | null;
}

interface AuthContextType {
  usuario: UsuarioActual | null;
  estaLogueado: boolean;
  esAdmin: boolean;
  verificandoSesion: boolean; // true mientras se revisa un token guardado al abrir la página
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(obtenerToken() !== null);
  const [cargando, setCargando] = useState(false);

  // Si había un token guardado de una sesión anterior, le preguntamos a la API
  // quién es. Si el token venció, la API responde 401 y partimos sin sesión.
  useEffect(() => {
    if (!obtenerToken()) return;
    api
      .get("/auth/me")
      .then((datos: UsuarioActual) => setUsuario(datos))
      .catch(() => borrarToken())
      .finally(() => setVerificandoSesion(false));
  }, []);

  async function iniciarSesion(email: string, password: string) {
    setCargando(true);
    try {
      // 1. POST /auth/login entrega el token
      const respuesta = await api.post("/auth/login", { email, password });
      guardarToken(respuesta.access_token);
      // 2. GET /auth/me dice quién es y qué rol tiene
      const datos: UsuarioActual = await api.get("/auth/me");
      setUsuario(datos);
    } catch (err) {
      borrarToken();
      throw err; // LoginPage muestra el mensaje de error
    } finally {
      setCargando(false);
    }
  }

  function cerrarSesion() {
    borrarToken();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        estaLogueado: usuario !== null,
        esAdmin: usuario?.role_id === ROL_ADMIN_ID,
        verificandoSesion,
        cargando,
        iniciarSesion,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }
  return context;
}