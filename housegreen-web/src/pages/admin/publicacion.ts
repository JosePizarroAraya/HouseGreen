// Tipos y funciones que comparten la lista y el detalle de publicaciones del admin

export type Zona = "verde" | "amarillo" | "rojo";

// Lo que devuelve GET /admin/publicaciones (paso 14)
export interface PublicacionAdmin {
  id: string;
  title: string;
  comuna: string | null;
  property_type: string;
  status: string | null;
  image_url: string | null;
  result_level: Zona | null;
  total_points: number | null;
  vistas: number;
  personas: number;
  guardados: number;
  // Paso 68: datos para completar el semáforo
  opening_price: string | null;
  auction_date: string | null;
  market_zone: Zona | null; // zona de precio que eligió el admin (null = todavía no la elige)
  domain_type: Dominio | null; // null = no especificado
}

export type Dominio = "exclusivo" | "otro";


const NOMBRE_ZONA: Record<Zona, string> = { verde: "Verde", amarillo: "Amarilla", rojo: "Roja" };

export function nombreComuna(p: PublicacionAdmin) {
  return p.comuna ?? "Comuna desconocida";
}

// Texto del distintivo: "Verde · 9/10", "Roja · sin puntaje" o "Sin evaluar"
export function textoZona(p: PublicacionAdmin) {
  if (!p.result_level) return "Sin evaluar";
  const puntos = p.total_points === null ? "sin puntaje" : `${p.total_points}/8`;
  return `${NOMBRE_ZONA[p.result_level]} · ${puntos}`;
}

// "1 vista", "3 vistas"
export function plural(n: number, singular: string, varios: string) {
  return `${n} ${n === 1 ? singular : varios}`;
}