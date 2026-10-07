import type { ReactNode } from "react";
import "./MarcoDeEntrada.css";

// Marco de las pantallas de entrada (iniciar sesión y crear cuenta):
// a la izquierda, qué es HouseGreen con su semáforo; a la derecha, el formulario.

// Los tres niveles, en el orden de un semáforo de verdad (rojo arriba)
const NIVELES = [
  { color: "rojo", nombre: "Riesgo alto", detalle: "Pocos puntos a favor o un impedimento legal." },
  { color: "amarillo", nombre: "Riesgo medio", detalle: "Le falta algún dato o tiene un punto débil." },
  { color: "verde", nombre: "Riesgo bajo", detalle: "Buen precio, dominio claro y buena comuna." },
];

export function MarcoDeEntrada({ children }: { children: ReactNode }) {
  return (
    <div className="entrada">
      <aside className="entrada-panel">
        <p className="entrada-titulo">Remates de propiedades, con el riesgo a la vista.</p>
        <p className="entrada-bajada">
          HouseGreen reúne los remates de la Región Metropolitana y le pone un semáforo a cada uno.
        </p>

        <ul className="entrada-semaforo">
          {NIVELES.map((nivel) => (
            <li key={nivel.color}>
              <span className={`entrada-luz is-${nivel.color}`} aria-hidden="true" />
              <span className="entrada-nivel">
                <strong>{nivel.nombre}</strong>
                {nivel.detalle}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="entrada-formulario">{children}</main>
    </div>
  );
}