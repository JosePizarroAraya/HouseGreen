// Paso 74: las mismas reglas de contraseña que revisa la API (app/auth/security.py).
// La web las revisa antes de enviar para avisar de inmediato; la API las vuelve a revisar igual.
// Si el equipo cambia las reglas, hay que cambiarlas en los dos lugares.
const LARGO_MINIMO = 8;
const LARGO_MAXIMO = 64;

export const REGLA_CONTRASENA = `Entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} caracteres, con al menos una letra y un número.`;

// Devuelve el motivo por el que la contraseña no sirve, o null si cumple las reglas
export function problemaDeContrasena(clave: string): string | null {
  if (clave.length < LARGO_MINIMO) return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (clave.length > LARGO_MAXIMO) return `La contraseña puede tener como máximo ${LARGO_MAXIMO} caracteres.`;
  if (!/\p{L}/u.test(clave)) return "La contraseña debe tener al menos una letra.";
  if (!/\d/.test(clave)) return "La contraseña debe tener al menos un número.";
  return null;
}