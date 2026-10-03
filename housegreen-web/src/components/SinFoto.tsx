import { categoriaDeTipo } from "./tipoPropiedad";
import type { CategoriaTipo } from "./tipoPropiedad";
import "./SinFoto.css";

// Paso 52: imagen propia para las propiedades que no tienen fotos.
// En vez de un rectángulo gris, se muestra un dibujo según la categoría de la propiedad (paso 52b).

function Dibujo({ categoria }: { categoria: CategoriaTipo }) {
  switch (categoria) {
    case "departamento": // edificio con ventanas
      return (
        <>
          <rect x="12" y="6" width="24" height="36" rx="2" />
          <path d="M18 14h4M26 14h4M18 21h4M26 21h4M18 28h4M26 28h4" />
          <path d="M21 42v-7h6v7" />
        </>
      );
    case "casa": // casa con techo a dos aguas
      return (
        <>
          <path d="M5 23 24 8l19 15" />
          <path d="M11 19v21h26V19" />
          <path d="M20 40V29h8v11" />
        </>
      );
    case "terreno": // sitio vacío con una estaca que lo marca
      return (
        <>
          <path d="M24 20 44 30 24 40 4 30z" />
          <path d="M24 30V9" />
          <path d="M24 9l9 4-9 4" />
        </>
      );
    case "parcela": // árbol sobre el campo
      return (
        <>
          <circle cx="24" cy="17" r="10" />
          <path d="M24 27v13" />
          <path d="M24 33l5-4" />
          <path d="M9 40h30" />
        </>
      );
    case "comercial": // local con toldo
      return (
        <>
          <path d="M8 19 12 8h24l4 11" />
          <path d="M8 19a4 4 0 0 0 8 0 4 4 0 0 0 8 0 4 4 0 0 0 8 0 4 4 0 0 0 8 0" />
          <path d="M11 24v16h26V24" />
          <path d="M20 40V30h8v10" />
        </>
      );
    case "bodega": // galpón con portón
      return (
        <>
          <path d="M5 20 24 9l19 11" />
          <path d="M9 18v22h30V18" />
          <rect x="16" y="25" width="16" height="15" />
          <path d="M16 30h16M16 35h16" />
        </>
      );
    case "derechos": // documento con un porcentaje: se remata una parte de la propiedad
      return (
        <>
          <path d="M13 6h15l8 8v28H13z" />
          <path d="M28 6v8h8" />
          <circle cx="20" cy="25" r="2.5" />
          <circle cx="29" cy="34" r="2.5" />
          <path d="M30 23 19 36" />
        </>
      );
    default: // marcador de ubicación
      return (
        <>
          <path d="M24 43s13-12.5 13-23a13 13 0 1 0-26 0c0 10.5 13 23 13 23z" />
          <circle cx="24" cy="20" r="5" />
        </>
      );
  }
}

interface SinFotoProps {
  tipo: string; // property_type de la propiedad
  className?: string; // para darle el mismo tamaño que tendría la foto
}

export function SinFoto({ tipo, className = "" }: SinFotoProps) {
  const categoria = categoriaDeTipo(tipo);
  return (
    <div className={`sin-foto sin-foto-${categoria} ${className}`} role="img" aria-label="Propiedad sin fotos">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <Dibujo categoria={categoria} />
      </svg>
    </div>
  );
}