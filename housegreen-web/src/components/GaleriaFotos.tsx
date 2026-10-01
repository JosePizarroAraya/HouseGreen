import { useEffect, useState } from "react";
import { api, urlDeArchivo } from "../api/client";
import "./GaleriaFotos.css";

// Una foto subida por el admin (GET /propiedades/{id}/fotos, paso 28)
interface Foto {
  id: string;
  url: string;
  label: string | null;
  position: number; // 0 = portada
}

interface GaleriaFotosProps {
  propertyId: string;
  imagenRespaldo: string | null; // la imagen de la propiedad, por si no tiene fotos subidas
  titulo: string;
}

const SIN_IMAGEN = "https://placehold.co/900x500?text=Sin+imagen";

// Foto grande con flechas y miniaturas para cambiarla (paso 29)
export function GaleriaFotos({ propertyId, imagenRespaldo, titulo }: GaleriaFotosProps) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [actual, setActual] = useState(0); // posición de la foto que se ve en grande

  useEffect(() => {
    api
      .get(`/propiedades/${propertyId}/fotos`)
      .then((datos: Foto[]) => setFotos(datos))
      .catch(() => setFotos([])); // si falla, se muestra la imagen de respaldo
  }, [propertyId]);

  // Sin fotos subidas: una sola imagen, como antes
  if (fotos.length === 0) {
    return (
      <img
        src={imagenRespaldo ? urlDeArchivo(imagenRespaldo) : SIN_IMAGEN}
        alt={titulo}
        className="detail-image"
      />
    );
  }

  const foto = fotos[actual];
  // El % hace que después de la última vuelva a la primera (y al revés)
  const anterior = () => setActual((actual - 1 + fotos.length) % fotos.length);
  const siguiente = () => setActual((actual + 1) % fotos.length);

  return (
    <div className="galeria">
      <div className="galeria-principal">
        <img src={urlDeArchivo(foto.url)} alt={foto.label ?? titulo} className="detail-image" />
        {foto.label && <span className="galeria-etiqueta">{foto.label}</span>}

        {fotos.length > 1 && (
          <>
            <button type="button" className="galeria-flecha galeria-flecha-izq" aria-label="Foto anterior" onClick={anterior}>
              ‹
            </button>
            <button type="button" className="galeria-flecha galeria-flecha-der" aria-label="Foto siguiente" onClick={siguiente}>
              ›
            </button>
            <span className="galeria-contador">
              {actual + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>

      {fotos.length > 1 && (
        <div className="galeria-miniaturas">
          {fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`galeria-miniatura ${i === actual ? "is-activa" : ""}`}
              aria-label={`Ver foto ${i + 1}${f.label ? `: ${f.label}` : ""}`}
              onClick={() => setActual(i)}
            >
              <img src={urlDeArchivo(f.url)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}