import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

// Paso 90: los anuncios que el administrador le envió a la persona de la sesión.
// Están en un contexto porque los usan dos lugares: el número rojo del encabezado y la página Alertas.

// Lo que devuelve GET /anuncios por cada anuncio
export interface AnuncioRecibido {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null; // null = todavía no lo lee
  property_id: string | null; // si el anuncio es sobre una publicación
  publicacion: string | null; // título de esa publicación
}

interface AnunciosContextType {
  anuncios: AnuncioRecibido[];
  sinLeer: number;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
  marcarLeido: (id: string) => void;
}

const AnunciosContext = createContext<AnunciosContextType | undefined>(undefined);

export function AnunciosProvider({ children }: { children: ReactNode }) {
  const { estaLogueado, esAdmin } = useAuth();
  // El administrador envía anuncios, no los recibe: para él no se le pregunta nada a la API
  const recibeAnuncios = estaLogueado && !esAdmin;

  const [anuncios, setAnuncios] = useState<AnuncioRecibido[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useCallback guarda la función entre un dibujo y otro: así los useEffect que la usan
  // solo se repiten cuando cambia la sesión, y no en cada dibujo.
  const recargar = useCallback(() => {
    if (!recibeAnuncios) {
      setAnuncios([]);
      return;
    }
    setCargando(true);
    api
      .get("/anuncios")
      .then((datos: AnuncioRecibido[]) => {
        setAnuncios(datos);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setCargando(false));
  }, [recibeAnuncios]);

  // Se piden al iniciar sesión (y se vacían al cerrarla)
  useEffect(() => {
    recargar();
  }, [recargar]);

  function marcarLeido(id: string) {
    const anuncio = anuncios.find((a) => a.id === id);
    if (!anuncio || anuncio.read_at !== null) return; // ya estaba leído: no hay nada que hacer

    // 1. Se marca de inmediato en la pantalla
    const ahora = new Date().toISOString();
    setAnuncios((actuales) => actuales.map((a) => (a.id === id ? { ...a, read_at: ahora } : a)));
    // 2. Se avisa a la API. Si falla, se vuelven a pedir para mostrar lo que hay de verdad en la base.
    api.patch(`/anuncios/${id}/leido`).catch(() => recargar());
  }

  const sinLeer = anuncios.filter((a) => a.read_at === null).length;

  return (
    <AnunciosContext.Provider value={{ anuncios, sinLeer, cargando, error, recargar, marcarLeido }}>
      {children}
    </AnunciosContext.Provider>
  );
}

export function useAnuncios() {
  const context = useContext(AnunciosContext);
  if (!context) {
    throw new Error("useAnuncios debe usarse dentro de un <AnunciosProvider>");
  }
  return context;
}