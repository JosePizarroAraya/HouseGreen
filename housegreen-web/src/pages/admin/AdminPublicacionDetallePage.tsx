import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { FotoPublicacion } from "./FotoPublicacion";
import { nombreComuna, plural, textoZona, type PublicacionAdmin } from "./publicacion";
import "./AdminPublicacionDetallePage.css";

// Lo que devuelve GET /admin/publicaciones/{id} (paso 17)
interface PersonaQueLaVio {
  user_id: string;
  full_name: string;
  email: string;
  visitas: number;
  ultima_visita: string;
  la_guardo: boolean;
}

interface PersonaQueLaGuardo {
  user_id: string;
  full_name: string;
  email: string;
  guardada_el: string;
  visitas: number;
}

interface PublicacionDetalle extends PublicacionAdmin {
  la_vieron: PersonaQueLaVio[];
  la_guardaron: PersonaQueLaGuardo[];
}

type Pestana = "vieron" | "guardaron";

// "José Pizarro" -> "JP"
function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase())
    .join("");
}

// "hoy 09:42", "ayer 22:05" o "mié, 23 sept"
function formatearFecha(iso: string) {
  const fecha = new Date(iso);
  const hora = fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  const hoy = new Date();
  const soloDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diasAtras = Math.round((soloDia(hoy) - soloDia(fecha)) / 86_400_000);
  if (diasAtras === 0) return `hoy ${hora}`;
  if (diasAtras === 1) return `ayer ${hora}`;
  return fecha.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

export function AdminPublicacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<PublicacionDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("vieron");

  useEffect(() => {
    api
      .get(`/admin/publicaciones/${id}`)
      .then((datos: PublicacionDetalle) => setDetalle(datos))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const volver = (
    <Link to="/admin/publicaciones" className="det-volver">
      ‹ Publicaciones
    </Link>
  );

  if (error) {
    return (
      <section>
        {volver}
        <p className="pub-error">No se pudo cargar la publicación: {error}</p>
      </section>
    );
  }

  if (!detalle) {
    return (
      <section>
        {volver}
        <p className="admin-subtitulo">Cargando publicación...</p>
      </section>
    );
  }

  return (
    <section>
        <div className="det-arriba">
        {volver}
            <Link to={`/admin/publicaciones/${id}/editar`} className="det-editar">
                ✎ Editar
            </Link>
        </div>

      <div className="det-foto-caja">
        <FotoPublicacion url={detalle.image_url} alt={detalle.title} className="det-foto" />
        <span className={`pub-zona pub-zona-${detalle.result_level ?? "sin"} det-zona`}>
          <span className="pub-zona-punto" />
          {textoZona(detalle)}
        </span>
      </div>

      <h1 className="admin-titulo det-titulo">{detalle.title}</h1>
      <p className="admin-subtitulo">
        {nombreComuna(detalle)} · {detalle.property_type}
      </p>

      {/* Resumen: personas que la vieron (con vistas totales) y personas que la guardaron */}
      <div className="det-cifras">
        <div className="det-cifra">
          <strong>{detalle.personas}</strong>
          <span>{detalle.personas === 1 ? "persona la vio" : "personas la vieron"}</span>
          <span className="det-cifra-extra">{plural(detalle.vistas, "vista", "vistas")} en total</span>
        </div>
        <div className="det-cifra">
          <strong>{detalle.guardados}</strong>
          <span>{detalle.guardados === 1 ? "persona la guardó" : "personas la guardaron"}</span>
        </div>
      </div>

      {/* Pestañas */}
      <div className="det-pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "vieron"}
          className={`det-pestana ${pestana === "vieron" ? "is-activa" : ""}`}
          onClick={() => setPestana("vieron")}
        >
          La vieron · {detalle.la_vieron.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "guardaron"}
          className={`det-pestana ${pestana === "guardaron" ? "is-activa" : ""}`}
          onClick={() => setPestana("guardaron")}
        >
          La guardaron · {detalle.la_guardaron.length}
        </button>
      </div>

      {pestana === "vieron" && (
        <ul className="det-personas">
          {detalle.la_vieron.length === 0 && <li className="det-vacio">Todavía nadie la ha visto.</li>}
          {detalle.la_vieron.map((p) => (
            <li key={p.user_id} className="det-persona">
              <span className="det-avatar">{iniciales(p.full_name)}</span>
              <div className="det-persona-datos">
                <strong>{p.full_name}</strong>
                <span className="det-correo">{p.email}</span>
                <span>
                  {formatearFecha(p.ultima_visita)} · {plural(p.visitas, "visita", "visitas")}
                </span>
              </div>
              {p.la_guardo && <span className="det-etiqueta">La guardó</span>}
            </li>
          ))}
        </ul>
      )}

      {pestana === "guardaron" && (
        <ul className="det-personas">
          {detalle.la_guardaron.length === 0 && <li className="det-vacio">Nadie la ha guardado todavía.</li>}
          {detalle.la_guardaron.map((p) => (
            <li key={p.user_id} className="det-persona">
              <span className="det-avatar">{iniciales(p.full_name)}</span>
              <div className="det-persona-datos">
                <strong>{p.full_name}</strong>
                <span className="det-correo">{p.email}</span>
                <span>
                  La guardó {formatearFecha(p.guardada_el)} · {plural(p.visitas, "visita", "visitas")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}