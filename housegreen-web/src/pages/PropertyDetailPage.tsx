import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useProperties } from "../context/PropertiesContext";
import { useFavorites } from "../context/FavoritesContext";
import { RiskBadge } from "../components/RiskBadge";
import { GaleriaFotos } from "../components/GaleriaFotos";
import { TarjetaSemaforo } from "../components/TarjetaSemaforo";
import { DatosRemate } from "../components/DatosRemate";
import { remateFinalizado, remateRetirado } from "../components/estadoRemate";
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
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

// Paso 69: "lunes 5 de octubre", para el aviso de remate finalizado
function fechaLarga(fecha: Date) {
  return fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
}

// Paso 54: sitios oficiales donde se revisa lo que HouseGreen no puede confirmar por su cuenta
// Paso 54: lo que hay que revisar en los sitios oficiales antes de ofertar.
// Van en orden porque el rol que se obtiene en el primero se usa en el segundo.
// Paso 54: lo que hay que revisar en los sitios oficiales antes de ofertar.
// Van en orden porque el rol que se obtiene en el primero se usa en el segundo.
const VERIFICACIONES = [
  {
    titulo: "Averigua el rol de la propiedad",
    texto:
      "En el menú Servicios online, entra a «Avalúos y contribuciones de bienes raíces» y busca la propiedad por comuna y dirección. Anota su rol (dos números, por ejemplo 1234-56) y su avalúo fiscal.",
    sitio: "Impuestos Internos (SII)",
    url: "https://www.sii.cl/",
  },
  {
    titulo: "Revisa si debe contribuciones",
    texto:
      "Con la comuna y el rol, pide el certificado de deuda de contribuciones. Esa deuda sigue a la propiedad, no al dueño anterior.",
    sitio: "Tesorería (TGR)",
    url: "https://tgr.gob.cl/",
  },
  {
    titulo: "Pide los certificados de la propiedad",
    texto:
      "Son dos: dominio vigente (quién es el dueño) e hipotecas, gravámenes y prohibiciones (qué deudas o embargos tiene). Se piden con la foja, el número y el año de la inscripción, que aparecen en el anuncio del remate (más arriba, en Datos del remate). Tienen costo.",
    sitio: "Conservador de Bienes Raíces",
    url: "https://conservadoresdigitales.cl/",
  },
];

// Paso 54: texto que se le pasa a Google Maps.
// Las direcciones del scraper ya vienen completas ("..., San Miguel, Santiago, Chile");
// a las demás se les agrega la comuna y el país para que el mapa no se confunda de ciudad.
function direccionParaMapa(direccion: string, comuna: string | undefined) {
  if (direccion.trim().toLowerCase().endsWith("chile")) return direccion;
  return comuna ? `${direccion}, ${comuna}, Chile` : `${direccion}, Chile`;
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

  // Paso 54: enlace a Google Maps con la dirección de la propiedad (solo si tiene dirección)
  const urlMapa = property.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        direccionParaMapa(property.address, comunasPorId[property.comuna_id]),
      )}`
    : null;

  const precio = Number(property.opening_price);
  const fisica = property.physical_info;
  const superficie = fisica?.surface_m2 ? Number(fisica.surface_m2) : null;
  const precioM2 = superficie ? Math.round(precio / superficie) : null;

  // Fecha del remate: las 00:00 significan "hora no informada" (igual que en la tarjeta)
  const remate = property.auction_date ? new Date(property.auction_date) : null;
  const remateConHora = remate !== null && (remate.getHours() !== 0 || remate.getMinutes() !== 0);
  const finalizado = remateFinalizado(property.auction_date);
    // Paso 71: el sitio de origen quitó este remate
  const retirado = remateRetirado(property.status);

  // Paso 51: datos de la propiedad. Solo se agregan los que existen,
  // así no aparecen casillas vacías ni guiones.
  const datos: { etiqueta: string; valor: string; aviso?: string; avisoGris?: boolean }[] = [];
  if (remate) {
    const hora = remate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
    datos.push({
      etiqueta: "Fecha del remate",
      valor: remateConHora ? `${fechaCorta(remate)} · ${hora}` : fechaCorta(remate),
      aviso: retirado ? "Retirado" : finalizado ? "Finalizado" : textoFaltan(diasHasta(remate)),
      avisoGris: retirado || finalizado,
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

        {retirado && (
        <p className="detail-finalizado" role="status">
          <strong>El sitio de origen retiró este remate.</strong> Puede haberse suspendido o cancelado. Se mantiene aquí
          solo como referencia.
        </p>
      )}

      {finalizado && !retirado && remate && (
        <p className="detail-finalizado" role="status">
          <strong>Este remate ya se realizó</strong> el {fechaLarga(remate)}. Se mantiene aquí solo como referencia.
        </p>
      )}

      {/* Galería (paso 29): todas las fotos que subió el admin; si no hay, la imagen de siempre.
          key hace que se reinicie al cambiar de propiedad */}
        <GaleriaFotos
        key={`galeria-${property.id}`}
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
      {/* Paso 54c: si el remate no trae dirección, se dice en vez de dejar el espacio vacío */}
      <p className="detail-address">{property.address || "Sin dirección informada"}</p>
      {urlMapa && (
        <a className="detail-mapa" href={urlMapa} target="_blank" rel="noopener noreferrer">
          Ver en Google Maps ↗
        </a>
      )}

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
            {dato.aviso && (
            <span className={`detail-dato-aviso ${dato.avisoGris ? "is-finalizado" : ""}`}>{dato.aviso}</span>
            )}
          </div>
        ))}
      </div>

      <TarjetaSemaforo evaluacion={property.evaluation} />
      
      <DatosRemate key={`remate-${property.id}`} propertyId={property.id} />

            {/* Paso 54: lo que conviene revisar en los sitios oficiales antes del remate */}
      <div className="detail-seccion">
        <h2>Verifica antes de ofertar</h2>
        <p className="detail-verifica-intro">
          HouseGreen no reemplaza la revisión de los documentos. Antes del remate, sigue estos pasos en los sitios
          oficiales:
        </p>
        <ol className="detail-verifica">
          {VERIFICACIONES.map((v, i) => (
            <li key={v.titulo}>
              <span className="detail-verifica-numero">{i + 1}</span>
              <div className="detail-verifica-info">
                <p className="detail-verifica-titulo">{v.titulo}</p>
                <p className="detail-verifica-texto">{v.texto}</p>
                <a href={v.url} target="_blank" rel="noopener noreferrer">
                  Ir a {v.sitio} ↗
                </a>
              </div>
            </li>
          ))}
        </ol>
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