import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useProperties } from "../context/PropertiesContext";
import { RiskBadge } from "../components/RiskBadge";
import { GaleriaFotos } from "../components/GaleriaFotos";
import "./PropertyDetailPage.css";

function formatCLP(value: string | number) {
  return Number(value).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

// Nombres para mostrar el tipo de remate que guarda la base
const NOMBRE_REMATE: Record<string, string> = {
  judicial: "Judicial",
  contribuciones: "Por contribuciones",
  banco: "Bancario",
};

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Antes esta página usaba los campos de los datos de prueba (titulo, precio, riesgo...),
  // que la API no entrega. Ahora usa los mismos datos que el listado: title, opening_price, etc.
  const { properties, comunasPorId, cargando } = useProperties();
  

  // En desarrollo React ejecuta este efecto dos veces seguidas; el useRef recuerda
  // que ya avisamos por esta propiedad y evita la llamada doble.
  const vistaRegistrada = useRef<string | null>(null);
  useEffect(() => {
    if (!id || vistaRegistrada.current === id) return;
    vistaRegistrada.current = id;
    api.post(`/propiedades/${id}/vista`).catch(() => {
      // Si falla no mostramos nada: la vista es solo una estadística
    });
  }, [id]);

  if (cargando) {
    return <div className="detail-page">Cargando propiedad...</div>;
  }

  const property = properties.find((p) => p.id === id);

  if (!property) {
    return (
      <div className="detail-page detail-not-found">
        <p>No se encontró esta propiedad.</p>
        <Link to="/">← Volver al listado</Link>
      </div>
    );
  }

  const comuna = comunasPorId[property.comuna_id] ?? "Comuna desconocida";
  const fisica = property.physical_info;

  return (
    <div className="detail-page">
      <Link to="/" className="detail-back-link">
        ← Volver al listado
      </Link>

      {/* Galería (paso 29): todas las fotos que subió el admin; si no hay, la imagen de siempre.
      key hace que se reinicie al cambiar de propiedad */}
      <GaleriaFotos
        key={property.id}
        propertyId={property.id}
        imagenRespaldo={property.image_url}
        titulo={property.title}
      />

      <div className="detail-header">
        <div>
          <h1>{property.title}</h1>
          <p className="detail-address">
            {property.address ? `${property.address}, ` : ""}
            {comuna}
          </p>
        </div>
        {property.evaluation ? (
          <RiskBadge riesgo={property.evaluation.result_level} />
        ) : (
          <span className="risk-badge">Sin evaluar</span>
        )}
      </div>

      <p className="detail-price">{formatCLP(property.opening_price)}</p>

      <div className="detail-facts">
        <span className="detail-tipo">{property.property_type}</span>
        <span>{fisica?.bedrooms ?? "-"} dormitorios</span>
        <span>{fisica?.bathrooms ?? "-"} baños</span>
        <span>{fisica?.surface_m2 ? Number(fisica.surface_m2).toLocaleString("es-CL") : "-"} m²</span>
        <span>Remate {NOMBRE_REMATE[property.auction_type] ?? property.auction_type}</span>
      </div>

      {property.description && <p className="detail-description">{property.description}</p>}
    </div>
  );
}