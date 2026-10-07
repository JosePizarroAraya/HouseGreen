import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

// Un campo de los formularios de entrada: etiqueta arriba, y dentro de un mismo borde
// un ícono, el cuadro para escribir y, si es una contraseña, el botón del ojo para verla.

type Icono = "correo" | "candado" | "persona" | "telefono";

// Los dibujos de los íconos (trazos simples de 24 x 24)
const DIBUJOS: Record<Icono, ReactNode> = {
  correo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
  candado: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  persona: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  telefono: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
};

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  icono: Icono;
  ayuda?: string; // texto chico debajo del campo
  // Solo para contraseñas: si se está mostrando y qué hacer al pulsar el ojo
  visible?: boolean;
  alCambiarVisible?: () => void;
}

export function CampoDeEntrada({ etiqueta, icono, ayuda, visible, alCambiarVisible, ...deLaEntrada }: Props) {
  const id = useId(); // une la etiqueta con su cuadro, para que al pulsar la etiqueta el cursor quede en el cuadro

  return (
    <div className="login-grupo">
      <label className="login-label" htmlFor={id}>
        {etiqueta}
      </label>

      <div className="login-campo">
        <svg className="login-icono" viewBox="0 0 24 24" aria-hidden="true">
          {DIBUJOS[icono]}
        </svg>

        <input id={id} className="login-input" {...deLaEntrada} />

        {alCambiarVisible && (
          <button
            type="button"
            className="login-ojo"
            onClick={alCambiarVisible}
            aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            aria-pressed={visible}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="3" />
              {/* Con la contraseña a la vista, el ojo va tachado: al pulsarlo se oculta */}
              {visible && <path d="M4 4l16 16" />}
            </svg>
          </button>
        )}
      </div>

      {ayuda && <p className="login-ayuda">{ayuda}</p>}
    </div>
  );
}