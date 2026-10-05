import { useEffect, useState } from "react";
import { api } from "../api/client";
import "./DatosRemate.css";

// Paso 66: datos del remate que el scraper leyó de la ficha del sitio de origen
// (GET /propiedades/{id}/remate). Si la propiedad no los tiene, esta sección no aparece.
interface Remate {
  origin: string | null;
  court: string | null;
  case_number: string | null;
  modality: string | null;
  place: string | null;
  guarantee_amount: string | null;
  guarantee_text: string | null;
  payment_method: string | null;
  payment_term: string | null;
  requirements: string | null;
  conditions: string | null;
  announcement: string | null;
  observations: string | null;
  source_url: string | null;
}

function formatCLP(valor: string) {
  return Number(valor).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

export function DatosRemate({ propertyId }: { propertyId: string }) {
  const [remate, setRemate] = useState<Remate | null>(null);

  useEffect(() => {
    api
      .get(`/propiedades/${propertyId}/remate`)
      .then((datos: Remate | null) => setRemate(datos))
      .catch(() => setRemate(null)); // si falla, simplemente no se muestra la sección
  }, [propertyId]);

  if (!remate) return null;

  // Casillas con los datos cortos: solo se agregan los que existen
  const casillas: { etiqueta: string; valor: string }[] = [];
  if (remate.court) casillas.push({ etiqueta: "Tribunal", valor: remate.court });
  if (remate.case_number) casillas.push({ etiqueta: "Rol de la causa", valor: remate.case_number });
  if (remate.modality) casillas.push({ etiqueta: "Modalidad", valor: remate.modality });
  if (remate.place) casillas.push({ etiqueta: "Lugar", valor: remate.place });
  if (remate.guarantee_amount) casillas.push({ etiqueta: "Garantía", valor: formatCLP(remate.guarantee_amount) });
  if (remate.payment_method) casillas.push({ etiqueta: "Forma de pago", valor: remate.payment_method });
  if (remate.payment_term) casillas.push({ etiqueta: "Plazo para pagar", valor: remate.payment_term });
  if (remate.origin) casillas.push({ etiqueta: "Origen", valor: remate.origin });

  // Textos más largos: van debajo, cada uno con su título
  const textos: { titulo: string; texto: string }[] = [];
  if (remate.guarantee_text) textos.push({ titulo: "Cómo se entrega la garantía", texto: remate.guarantee_text });
  if (remate.requirements) textos.push({ titulo: "Requisitos para participar", texto: remate.requirements });
  if (remate.conditions) textos.push({ titulo: "Condiciones", texto: remate.conditions });
  if (remate.observations) textos.push({ titulo: "Observaciones", texto: remate.observations });

  return (
    <div className="detail-seccion">
      <h2>Datos del remate</h2>

      {casillas.length > 0 && (
        <div className="remate-datos">
          {casillas.map((casilla) => (
            <div key={casilla.etiqueta} className="remate-dato">
              <p className="remate-dato-etiqueta">{casilla.etiqueta}</p>
              <p className="remate-dato-valor">{casilla.valor}</p>
            </div>
          ))}
        </div>
      )}

      {textos.map((bloque) => (
        <div key={bloque.titulo} className="remate-texto">
          <h3>{bloque.titulo}</h3>
          <p>{bloque.texto}</p>
        </div>
      ))}

      {/* El anuncio es largo: queda cerrado y se abre al hacer clic */}
      {remate.announcement && (
        <details className="remate-anuncio">
          <summary>Ver el anuncio completo</summary>
          <p>{remate.announcement}</p>
        </details>
      )}

      <p className="remate-fuente">
        Fuente: Remates Inmobiliarios.
        {remate.source_url && (
          <>
            {" "}
            <a href={remate.source_url} target="_blank" rel="noopener noreferrer">
              Ver la publicación original ↗
            </a>
          </>
        )}
      </p>
    </div>
  );
}