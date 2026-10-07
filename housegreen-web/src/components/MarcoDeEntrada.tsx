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

// ---------- Dibujo del fondo: la cordillera y una fila de edificios ----------
// Algunas ventanas van encendidas con los colores del semáforo: cada propiedad, con su riesgo.

const COLOR_DE_LA_LUZ: Record<string, string> = { verde: "#22c55e", amarillo: "#facc15", rojo: "#ef4444" };

// Cada edificio: dónde parte (x), su ancho y su alto. "luces" dice qué ventanas van encendidas
// (se cuentan de izquierda a derecha y de arriba hacia abajo, partiendo en 0) y de qué color.
const EDIFICIOS: { x: number; ancho: number; alto: number; luces: Record<number, string> }[] = [
  { x: 24, ancho: 60, alto: 78, luces: { 4: "amarillo" } },
  { x: 92, ancho: 76, alto: 122, luces: { 2: "verde", 13: "amarillo" } },
  { x: 178, ancho: 60, alto: 62, luces: { 3: "rojo" } },
  { x: 250, ancho: 92, alto: 100, luces: { 6: "verde", 17: "verde" } },
  { x: 352, ancho: 60, alto: 142, luces: { 1: "amarillo", 11: "verde", 16: "rojo" } },
  { x: 424, ancho: 76, alto: 84, luces: { 5: "verde" } },
  { x: 512, ancho: 60, alto: 112, luces: { 7: "amarillo" } },
  { x: 584, ancho: 92, alto: 70, luces: { 2: "verde", 8: "rojo" } },
  { x: 688, ancho: 76, alto: 130, luces: { 0: "verde", 14: "amarillo" } },
  { x: 776, ancho: 60, alto: 88, luces: { 6: "verde" } },
  { x: 848, ancho: 92, alto: 108, luces: { 3: "amarillo", 12: "verde" } },
];

const ALTO_DEL_DIBUJO = 300;

function Paisaje() {
  return (
    <svg
      className="entrada-paisaje"
      viewBox={`0 0 960 ${ALTO_DEL_DIBUJO}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Cordillera al fondo y cerros más cerca */}
      <path
        fill="#14503f"
        d="M0 300V206l66-40 58 26 84-66 62 46 68-28 82-50 78 66 62-24 78 40 82-62 70 50 72-20 98 48v114Z"
      />
      <path fill="#124838" d="M0 300v-82c120-36 220 14 340-12s220-34 360 6 180-20 260 8v80Z" />

      {/* Edificios, con sus ventanas */}
      {EDIFICIOS.map((edificio) => {
        const arriba = ALTO_DEL_DIBUJO - edificio.alto;
        const columnas = Math.floor((edificio.ancho - 12) / 16);
        const filas = Math.floor((edificio.alto - 16) / 18);
        return (
          <g key={edificio.x}>
            <rect x={edificio.x} y={arriba} width={edificio.ancho} height={edificio.alto} fill="#0a2e24" />
            {Array.from({ length: columnas * filas }, (_, numero) => (
              <rect
                key={numero}
                x={edificio.x + 10 + (numero % columnas) * 16}
                y={arriba + 12 + Math.floor(numero / columnas) * 18}
                width="8"
                height="10"
                rx="1"
                fill={COLOR_DE_LA_LUZ[edificio.luces[numero]] ?? "#134a3b"}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function MarcoDeEntrada({ children }: { children: ReactNode }) {
  return (
    <div className="entrada">
      <aside className="entrada-panel">
        <div className="entrada-contenido">
            <p className="entrada-titulo">HouseGreen</p>
            <p className="entrada-bajada">Remates de propiedades, con el riesgo a la vista.</p>

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
        </div>

        <Paisaje />
      </aside>

      <main className="entrada-formulario">{children}</main>
    </div>
  );
}