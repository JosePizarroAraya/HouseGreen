import { useState } from "react";
import { Link } from "react-router-dom";
import { RiskBadge } from "./RiskBadge";
import { useFavorites } from "../context/FavoritesContext";
import { useProperties } from "../context/PropertiesContext";
import { urlDeArchivo } from "../api/client";
import { SinFoto } from "./SinFoto";
import "./PropertyCard.css";

interface PropertyCardProps {
  property: {
    id: string;
    title: string;
    address: string | null;
    comuna_id: number;
    property_type: string;
    opening_price: string;
    auction_date: string | null;
    image_url: string | null;
    physical_info: { bedrooms: number | null; bathrooms: number | null; surface_m2: string | null } | null;
    evaluation: { result_level: "verde" | "amarillo" | "rojo" } | null;
    created_at: string;
  };
}

function formatCLP(valor: number) {
  return valor.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

// "Publicado hoy", "Publicado ayer" o "Publicado el 28 sept 2026"
function textoPublicado(iso: string) {
  const fecha = new Date(iso);
  const soloDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diasAtras = Math.round((soloDia(new Date()) - soloDia(fecha)) / 86_400_000);
  if (diasAtras === 0) return "Publicado hoy";
  if (diasAtras === 1) return "Publicado ayer";
  return `Publicado el ${fecha.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}`;
}

// "Remate jue 15 oct · 12:00" (como en el prototipo)
function textoRemate(iso: string) {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString("es-CL", { weekday: "short" });
  const diaMes = fecha.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  // Paso 48: las 00:00 significan "hora no informada" (así guarda el scraper los remates
  // cuando el sitio solo trae el día), por eso en ese caso se muestra solo la fecha
  if (fecha.getHours() === 0 && fecha.getMinutes() === 0) return `Remate ${dia} ${diaMes}`;
  const hora = fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Remate ${dia} ${diaMes} · ${hora}`;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const { esFavorito, alternarFavorito } = useFavorites();
  const { comunasPorId } = useProperties();
  const favorito = esFavorito(property.id);

  // Paso 52: si la foto no carga (dirección rota), se recuerda cuál falló y se muestra el dibujo.
  // Se guarda la dirección y no un simple "sí/no": así, si después la propiedad tiene otra foto, se vuelve a intentar.
  const [fotoFallida, setFotoFallida] = useState<string | null>(null);
  const tieneFoto = property.image_url !== null && property.image_url !== fotoFallida;

  function handleFavoritoClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    alternarFavorito(property.id);
  }

  const nombreComuna = comunasPorId[property.comuna_id] || "Comuna desconocida";
  // Si todavía no llegó la evaluación (recién creada, evaluándose), mostramos "amarillo" por defecto
  const riesgo = property.evaluation?.result_level ?? "amarillo";

  const precio = Number(property.opening_price);
  const fisica = property.physical_info;
  const superficie = fisica?.surface_m2 ? Number(fisica.surface_m2) : null;
  // Precio por m² (paso 34): solo si la propiedad tiene superficie
  const precioM2 = superficie ? Math.round(precio / superficie) : null;

  // Datos chicos de la tarjeta: solo se muestran los que la propiedad tiene
  const datos: string[] = [];
  if (superficie !== null) datos.push(`${superficie.toLocaleString("es-CL")} m²`);
  if (fisica?.bedrooms) datos.push(`${fisica.bedrooms} dorm.`);
  if (fisica?.bathrooms) datos.push(`${fisica.bathrooms} ${fisica.bathrooms === 1 ? "baño" : "baños"}`);
  const remate = property.auction_date ? textoRemate(property.auction_date) : null;

  return (
    <Link to={`/propiedades/${property.id}`} className="property-card">
      <div className="property-card-image-wrapper">
        {tieneFoto && property.image_url ? (
          <img
            src={urlDeArchivo(property.image_url)}
            alt={property.title}
            className="property-card-image"
            onError={() => setFotoFallida(property.image_url)}
          />
        ) : (
          <SinFoto tipo={property.property_type} className="property-card-image" />
        )}
        <div className="property-card-badge">
          <RiskBadge riesgo={riesgo} />
        </div>

        <button
          onClick={handleFavoritoClick}
          className={`property-card-fav-btn ${favorito ? "is-favorito" : ""}`}
          aria-label={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          {favorito ? "♥" : "♡"}
        </button>
      </div>

      <div className="property-card-body">
        <div className="property-card-info">
          <p className="property-card-comuna">{nombreComuna}</p>
          <h3 className="property-card-title">{property.title}</h3>
          <p className="property-card-address">{property.address || "Sin dirección informada"}</p>

          <p className="property-card-label">Precio mínimo</p>
          <div className="property-card-precios">
            <span className="property-card-price">{formatCLP(precio)}</span>
            {precioM2 !== null && <span className="property-card-m2">{formatCLP(precioM2)} / m²</span>}
          </div>

          {(datos.length > 0 || remate) && (
            <div className="property-card-details">
              {datos.map((dato) => (
                <span key={dato}>{dato}</span>
              ))}
              {remate && <span className="property-card-remate">{remate}</span>}
            </div>
          )}
        </div>

        <div className="property-card-footer">
          <span>{textoPublicado(property.created_at)}</span>
          <span className="property-card-ver">Ver detalle ›</span>
        </div>
      </div>
    </Link>
  );
}