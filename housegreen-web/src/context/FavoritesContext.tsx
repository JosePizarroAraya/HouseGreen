import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

interface FavoritesContextType {
  favoritos: string[]; // guardamos solo los ids de las propiedades favoritas
  esFavorito: (id: string) => boolean;
  alternarFavorito: (id: string) => Promise<void>;
}

// Lo que devuelve GET /favoritos (solo usamos el id de la propiedad)
interface FavoritoApi {
  property_id: string;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { estaLogueado } = useAuth();
  const [favoritos, setFavoritos] = useState<string[]>([]);

  // Antes los favoritos se guardaban en el navegador (localStorage), así que no
  // se veían en otro computador ni en la base de datos. Ahora se piden a la API
  // (tabla saved_properties) cada vez que alguien inicia sesión.
  useEffect(() => {
    if (!estaLogueado) {
      setFavoritos([]);
      return;
    }
    api
      .get("/favoritos")
      .then((datos: FavoritoApi[]) => setFavoritos(datos.map((f) => f.property_id)))
      .catch(() => setFavoritos([]));
  }, [estaLogueado]);

  function esFavorito(id: string) {
    return favoritos.includes(id);
  }

  async function alternarFavorito(id: string) {
    const yaEstaba = favoritos.includes(id);

    // 1. Cambiamos el corazón de inmediato, para que se sienta rápido
    setFavoritos((actuales) =>
      yaEstaba ? actuales.filter((favId) => favId !== id) : [...actuales, id]
    );

    // 2. Le avisamos a la API
    try {
      if (yaEstaba) {
        await api.delete(`/favoritos/${id}`);
      } else {
        await api.post(`/favoritos/${id}`, {});
      }
    } catch (err) {
      // 3. Si la API falla, deshacemos el cambio para que la pantalla no muestre algo falso
      console.error("No se pudo actualizar el favorito:", err);
      setFavoritos((actuales) =>
        yaEstaba ? [...actuales, id] : actuales.filter((favId) => favId !== id)
      );
    }
  }

  return (
    <FavoritesContext.Provider value={{ favoritos, esFavorito, alternarFavorito }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites debe usarse dentro de un <FavoritesProvider>");
  }
  return context;
}