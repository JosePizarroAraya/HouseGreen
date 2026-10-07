import "./Estrellas.css";

// Paso 82: muestra una calificación de 1 a 5 con estrellas (solo para ver, no para elegir)
export function Estrellas({ calificacion }: { calificacion: number }) {
  return (
    <span className="estrellas" role="img" aria-label={`${calificacion} de 5`}>
      {[1, 2, 3, 4, 5].map((numero) => (
        <span key={numero} className={numero <= calificacion ? "is-llena" : ""} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}