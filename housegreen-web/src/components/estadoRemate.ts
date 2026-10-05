// Paso 69: ¿el remate ya se realizó?
// - Con hora informada: se considera finalizado cuando pasa esa hora.
// - Sin hora (las 00:00 significan "hora no informada"): cuando termina ese día.
// - Sin fecha: no se puede saber, así que se trata como vigente.
export function remateFinalizado(fechaIso: string | null): boolean {
  if (!fechaIso) return false;
  const fecha = new Date(fechaIso);
  const ahora = new Date();
  if (fecha.getHours() === 0 && fecha.getMinutes() === 0) {
    const finDelDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1);
    return ahora >= finDelDia;
  }
  return ahora > fecha;
}
// Paso 71: ¿el sitio de origen retiró el remate? (lo marca el cargador de fichas cuando la ficha ya no existe)
export function remateRetirado(estado: string | null | undefined): boolean {
  return estado === "retirada";
}