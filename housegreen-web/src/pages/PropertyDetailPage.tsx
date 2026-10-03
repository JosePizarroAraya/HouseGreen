import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useProperties } from "../context/PropertiesContext";
import { useFavorites } from "../context/FavoritesContext";
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
  extrajudicial: "Extrajudicial",
  contribuciones: "Por contribuciones",
  banco: "Bancario",
};

// "departamento" -> "Departamento"
function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "jue 22 oct" o, con el año, "jue 22 oct 2026"
function fechaCorta(fecha: Date, conAnio = false) {
  const dia = fecha.toLocaleDateString("es-CL", { weekday: "short" });
  const resto = fecha.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: conAnio ? "numeric" : undefined,
  });
  return `${dia} ${resto}`;
}

// Días que faltan para una fecha, contando días completos: 0 = hoy, negativo = ya pasó
function diasHasta(fecha: Date) {
  const soloDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((soloDia(fecha) - soloDia(new Date())) / 86_400_000);
}

function textoFaltan(dias: number) {
  if (dias < 0) return "Fecha ya pasada";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { properties, comunasPorId, cargando } = useProperties();
  const { esFavorito, alternarFavorito } = useFavorites();

  // Registra la vista (paso 12): le avisa a la API que esta persona abrió la propiedad.
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
        <Link to="/">← Volver al catálogo</Link>
      </div>
    );
  }

  const comuna = comunasPorId[property.comuna_id] ?? "Comuna desconocida";
  const favorito = esFavorito(property.id);

  const precio = Number(property.opening_price);
  const fisica = property.physical_info;
  const superficie = fisica?.surface_m2 ? Number(fisica.surface_m2) : null;
  const precioM2 = superficie ? Math.round(precio / superficie) : null;

  // Fecha del remate: las 00:00 significan "hora no informada" (igual que en la tarjeta)
  const remate = property.auction_date ? new Date(property.auction_date) : null;
  const remateConHora = remate !== null && (remate.getHours() !== 0 || remate.getMinutes() !== 0);

  // Paso 51: datos de la propiedad. Solo se agregan los que existen,
  // así no aparecen casillas vacías ni guiones.
  const datos: { etiqueta: string; valor: string; aviso?: string }[] = [];
  if (remate) {
    const hora = remate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
    datos.push({
      etiqueta: "Fecha del remate",
      valor: remateConHora ? `${fechaCorta(remate)} · ${hora}` : fechaCorta(remate),
      aviso: textoFaltan(diasHasta(remate)),
    });
  }
  datos.push({ etiqueta: "Publicado", valor: fechaCorta(new Date(property.created_at), true) });
  datos.push({ etiqueta: "Tipo de propiedad", valor: capitalizar(property.property_type) });
  datos.push({ etiqueta: "Tipo de remate", valor: NOMBRE_REMATE[property.auction_type] ?? property.auction_type });
  if (superficie !== null) datos.push({ etiqueta: "Superficie", valor: `${superficie.toLocaleString("es-CL")} m²` });
  if (fisica?.bedrooms) datos.push({ etiqueta: "Dormitorios", valor: String(fisica.bedrooms) });
  if (fisica?.bathrooms) datos.push({ etiqueta: "Baños", valor: String(fisica.bathrooms) });

  return (
    <div className="detail-page">
      <div className="detail-arriba">
        <Link to="/" className="detail-back-link">
          ‹ Volver al catálogo
        </Link>
        <button
          type="button"
          className={`detail-guardar ${favorito ? "is-guardada" : ""}`}
          onClick={() => alternarFavorito(property.id)}
        >
          {favorito ? "♥ Guardada" : "♡ Guardar"}
        </button>
      </div>

      {/* Galería (paso 29): todas las fotos que subió el admin; si no hay, la imagen de siempre.
          key hace que se reinicie al cambiar de propiedad */}
        <GaleriaFotos
        key={property.id}
        propertyId={property.id}
        imagenRespaldo={property.image_url}
        titulo={property.title}
        tipo={property.property_type}
      />

      <div className="detail-header">
        <p className="detail-comuna">{comuna}</p>
        {property.evaluation ? (
          <RiskBadge riesgo={property.evaluation.result_level} />
        ) : (
          <span className="risk-badge">Sin evaluar</span>
        )}
      </div>
      <h1 className="detail-titulo">{property.title}</h1>
      {property.address && <p className="detail-address">{property.address}</p>}

      <div className="detail-precio">
        <p className="detail-precio-etiqueta">Precio mínimo</p>
        <p className="detail-precio-valor">{formatCLP(precio)}</p>
        {precioM2 !== null && <p className="detail-precio-m2">{formatCLP(precioM2)} por m²</p>}
      </div>

      <div className="detail-datos">
        {datos.map((dato) => (
          <div key={dato.etiqueta} className="detail-dato">
            <p className="detail-dato-etiqueta">{dato.etiqueta}</p>
            <p className="detail-dato-valor">{dato.valor}</p>
            {dato.aviso && <span className="detail-dato-aviso">{dato.aviso}</span>}
          </div>
        ))}
      </div>

      {property.description && (
        <div className="detail-seccion">
          <h2>Descripción</h2>
          <p className="detail-description">{property.description}</p>
        </div>
      )}
    </div>
  );
}