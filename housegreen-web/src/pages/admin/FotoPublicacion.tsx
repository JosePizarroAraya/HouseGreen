import { useState } from "react";
import { urlDeArchivo } from "../../api/client";

interface FotoPublicacionProps {
  url: string | null;
  alt: string;
  className?: string; // "pub-foto" en la lista; el detalle usa una foto más grande
}

// Foto de la propiedad; si no tiene o no carga, muestra un recuadro "Sin foto"
export function FotoPublicacion({ url, alt, className = "pub-foto" }: FotoPublicacionProps) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) {
    return <div className={`${className} pub-foto-vacia`}>Sin foto</div>;
  }
  // urlDeArchivo agrega la dirección de la API a las fotos subidas ("/uploads/...")
  return <img className={className} src={urlDeArchivo(url)} alt={alt} onError={() => setFallo(true)} />;
}