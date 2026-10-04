import { createContext, useCallback, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

interface PropertyApiResponse {
  id: string;
  title: string;
  address: string | null;
  comuna_id: number;
  property_type: string;
  auction_type: "judicial" | "contribuciones" | "banco" | "extrajudicial";
  opening_price: string;
  auction_date: string | null; // fecha y hora del remate (paso 37); null si no se conoce
  image_url: string | null;
  description: string | null;
  // Paso 55: de dónde viene la propiedad. Los remates del scraper traen
  // source_system = "rematesinmobiliarios" y en source_reference el número del remate en ese sitio
  source_system: string | null;
  source_reference: string | null;
  physical_info: { bedrooms: number | null; bathrooms: number | null; surface_m2: string | null } | null;
    // Última evaluación del semáforo (null si todavía no se ha evaluado)
  evaluation: {
    result_level: "verde" | "amarillo" | "rojo";
    total_points: number | null; // 0 a 10; null si faltan datos para calcular
    veto_applied: boolean;
    veto_reason: string | null; // motivo del veto o lista de datos que faltan
    is_complete: boolean; // false = faltan datos, no se pudo calcular el puntaje
    evaluated_at: string;
  } | null;
  created_at: string; // fecha de publicación (para ordenar por "Más recientes")
}

interface ComunaApiResponse {
  id: number;
  name: string;
}

interface PropertiesContextType {
  properties: PropertyApiResponse[];
  comunasPorId: Record<number, string>;
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

const PropertiesContext = createContext<PropertiesContextType | undefined>(undefined);

export function PropertiesProvider({ children }: { children: ReactNode }) {
  const { estaLogueado } = useAuth();
  const [properties, setProperties] = useState<PropertyApiResponse[]>([]);
  const [comunasPorId, setComunasPorId] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useCallback hace que "recargar" sea siempre la misma función (no una nueva en cada render),
  // así las páginas pueden usarla en un useEffect sin que se repita sin parar.
  // Todos los setState van después del await: "Cargando..." solo se ve la primera vez
  // (cargando empieza en true); las recargas siguientes actualizan la lista en silencio.
  const recargar = useCallback(async () => {
    try {
      // Promise.all pide ambas cosas EN PARALELO (no una después de la otra),
      // así la carga es más rápida que esperar una petición y luego la otra.
      const [datosPropiedades, datosComunas]: [PropertyApiResponse[], ComunaApiResponse[]] =
        await Promise.all([api.get("/propiedades"), api.get("/comunas")]);

      setProperties(datosPropiedades);

      const mapa: Record<number, string> = {};
      datosComunas.forEach((c) => {
        mapa[c.id] = c.name;
      });
      setComunasPorId(mapa);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar propiedades");
    } finally {
      setCargando(false);
    }
  }, []);

  // Antes esto corría una sola vez al abrir la página, cuando todavía no había
  // token, y la API respondía con error. Ahora se ejecuta cada vez que cambia
  // "estaLogueado": al iniciar sesión pide los datos; al cerrarla, los limpia.
  useEffect(() => {
    if (estaLogueado) {
      recargar();
    } else {
      setProperties([]);
      setComunasPorId({});
      setCargando(true); // así, al volver a entrar, se ve "Cargando..." hasta que lleguen los datos
    }
  }, [estaLogueado, recargar]);

  return (
    <PropertiesContext.Provider value={{ properties, comunasPorId, cargando, error, recargar }}>
      {children}
    </PropertiesContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertiesContext);
  if (!context) {
    throw new Error("useProperties debe usarse dentro de un <PropertiesProvider>");
  }
  return context;
}