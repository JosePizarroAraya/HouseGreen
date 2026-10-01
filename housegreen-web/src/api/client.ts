export const API_URL = "http://localhost:8000";

// Guardamos el token en una variable simple en memoria, y también en localStorage
// para que la sesión sobreviva si recargas la página.
let tokenActual: string | null = localStorage.getItem("housegreen-token");

export function guardarToken(token: string) {
  tokenActual = token;
  localStorage.setItem("housegreen-token", token);
}

export function borrarToken() {
  tokenActual = null;
  localStorage.removeItem("housegreen-token");
}

export function obtenerToken() {
  return tokenActual;
}

// Las fotos subidas llegan como "/uploads/propiedades/..." (paso 23): les falta la dirección de la API.
// Si algún día vienen de otro servicio (una URL completa), se usan tal cual.
export function urlDeArchivo(url: string) {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

// Función central: todas las llamadas a la API pasan por acá.
// Arma la URL completa, agrega el token si existe, y maneja errores de forma consistente.
async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Cuando se envían archivos (FormData), el navegador arma el Content-Type solo;
  // si lo ponemos a mano como JSON, la API no puede leer el archivo.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (tokenActual) {
    headers["Authorization"] = `Bearer ${tokenActual}`;
  }

  const respuesta = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!respuesta.ok) {
    // Intentamos leer el mensaje de error que manda FastAPI ({"detail": "..."})
    const cuerpoError = await respuesta.json().catch(() => null);
    const mensaje = cuerpoError?.detail || `Error ${respuesta.status}`;
    throw new Error(mensaje);
  }

  // 204 No Content (por ejemplo, en un DELETE exitoso) no trae cuerpo que parsear
  if (respuesta.status === 204) return null;
  return respuesta.json();
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => apiFetch(path, { method: "DELETE" }),
  // Sube archivos (por ejemplo, fotos) como formulario
  subir: (path: string, datos: FormData) => apiFetch(path, { method: "POST", body: datos }),
};