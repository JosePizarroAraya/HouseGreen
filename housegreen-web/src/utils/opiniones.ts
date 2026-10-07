// Paso 82: lo que comparten la pantalla de opiniones del inversionista y la del administrador

// Los temas permitidos (los mismos de la API y de la base de datos)
export const TEMAS: { valor: string; nombre: string }[] = [
  { valor: "catalogo", nombre: "Catálogo y búsqueda" },
  { valor: "propiedad", nombre: "Información de las propiedades" },
  { valor: "semaforo", nombre: "Semáforo de riesgo" },
  { valor: "alertas", nombre: "Alertas" },
  { valor: "cuenta", nombre: "Mi cuenta" },
  { valor: "otro", nombre: "Otro" },
];

export function nombreDeTema(valor: string) {
  return TEMAS.find((tema) => tema.valor === valor)?.nombre ?? valor;
}

// Cómo se llama cada calificación, de 1 a 5
export const NOMBRE_CALIFICACION = ["", "Muy mala", "Mala", "Regular", "Buena", "Muy buena"];

export const LARGO_MAXIMO_DEL_MENSAJE = 500;

// Una respuesta del administrador
export interface Respuesta {
  id: string;
  message: string;
  created_at: string;
}

// Lo que devuelve la API por cada opinión
export interface Opinion {
  id: string;
  rating: number;
  topic: string;
  message: string | null;
  allows_reply: boolean;
  created_at: string;
  replies: Respuesta[];
}

// "2026-10-06T21:48:34Z" -> "6 oct 2026"
export function fechaCorta(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}