import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAlerts } from "../context/AlertsContext";
import { useProperties } from "../context/PropertiesContext";
import { MisAnuncios } from "../components/MisAnuncios";
import { RiskBadge } from "../components/RiskBadge";
import { remateFinalizado, remateRetirado } from "../components/estadoRemate";
import { fechaCorta } from "../utils/opiniones";
import "./AlertsPage.css";

// Paso 94: página Alertas conectada a la base.
// - Izquierda: lo que llegó (anuncios del administrador y remates que calzan con las alertas).
// - Derecha: las alertas de la persona, es decir, de qué quiere que le avisen.

type Riesgo = "verde" | "amarillo" | "rojo";

// Lo que devuelve la API por cada alerta (tabla saved_filters)
interface AlertaGuardada {
  id: string;
  comuna_id: number | null; // null = cualquier comuna
  comuna_name: string | null;
  max_risk_level: Riesgo | null; // null = cualquier riesgo
  max_price: string | null; // null = sin tope de precio
  created_at: string;
}

const ORDEN_RIESGO: Record<Riesgo, number> = { verde: 0, amarillo: 1, rojo: 2 };
const LARGO_MAXIMO_DEL_PRECIO = 12; // cifras
const POR_TANDA = 10; // cuántas notificaciones se muestran de una vez

function formatCLP(valor: number) {
  return valor.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

// "Riesgo bajo o medio", o vacío si la alerta acepta cualquier riesgo
function textoDelRiesgo(nivel: Riesgo | null) {
  if (nivel === "verde") return "Solo riesgo bajo";
  if (nivel === "amarillo") return "Riesgo bajo o medio";
  return "";
}

export function AlertsPage() {
  const { notificaciones, noLeidas, cargando, error, recargar, marcarLeida, marcarTodasLeidas } = useAlerts();
  const { properties, comunasPorId } = useProperties();

  // Las alertas solo se usan en esta página, así que se guardan aquí (null = todavía cargando)
  const [alertas, setAlertas] = useState<AlertaGuardada[] | null>(null);
  const [errorDeAlertas, setErrorDeAlertas] = useState("");

  // Formulario de una alerta nueva
  const [comunaId, setComunaId] = useState(""); // vacío = cualquier comuna
  const [riesgo, setRiesgo] = useState(""); // vacío = cualquier riesgo
  const [precio, setPrecio] = useState(""); // solo cifras; vacío = sin tope
  const [guardando, setGuardando] = useState(false);
  const [errorDelFormulario, setErrorDelFormulario] = useState("");

  const [tanda, setTanda] = useState(POR_TANDA);

  // Cada vez que se entra a la página se piden las notificaciones y las alertas
  useEffect(() => {
    recargar();
    api
      .get("/alertas/filtros")
      .then((datos: AlertaGuardada[]) => setAlertas(datos))
      .catch((err) => setErrorDeAlertas(err instanceof Error ? err.message : "Error desconocido"));
  }, [recargar]);

  // Comunas ordenadas por nombre, para la lista del formulario
  const comunas = useMemo(
    () =>
      Object.entries(comunasPorId)
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [comunasPorId]
  );

  // Para encontrar rápido la propiedad de cada notificación: { id: propiedad }
  const propiedadesPorId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  // Cuántos remates vigentes del catálogo cumplen hoy las condiciones de una alerta
  function calzanHoy(alerta: AlertaGuardada) {
    return properties.filter((p) => {
      if (remateFinalizado(p.auction_date) || remateRetirado(p.status)) return false;
      if (alerta.comuna_id !== null && p.comuna_id !== alerta.comuna_id) return false;
      if (alerta.max_price !== null && Number(p.opening_price) > Number(alerta.max_price)) return false;
      if (alerta.max_risk_level !== null) {
        if (!p.evaluation) return false;
        if (ORDEN_RIESGO[p.evaluation.result_level] > ORDEN_RIESGO[alerta.max_risk_level]) return false;
      }
      return true;
    }).length;
  }

  async function crearAlerta(e: React.FormEvent) {
    e.preventDefault();
    setErrorDelFormulario("");
    if (comunaId === "" && riesgo === "" && precio === "") {
      setErrorDelFormulario("Elige al menos una condición: comuna, riesgo o precio.");
      return;
    }
    setGuardando(true);
    try {
      const nueva: AlertaGuardada = await api.post("/alertas/filtros", {
        comuna_id: comunaId === "" ? null : Number(comunaId),
        max_risk_level: riesgo === "" ? null : riesgo,
        max_price: precio === "" ? null : Number(precio),
      });
      setAlertas((actuales) => [nueva, ...(actuales ?? [])]); // la nueva queda primero
      setComunaId("");
      setRiesgo("");
      setPrecio("");
    } catch (err) {
      setErrorDelFormulario(err instanceof Error ? err.message : "No se pudo crear la alerta.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarAlerta(id: string) {
    setErrorDeAlertas("");
    try {
      await api.delete(`/alertas/filtros/${id}`);
      setAlertas((actuales) => (actuales ?? []).filter((a) => a.id !== id));
    } catch (err) {
      setErrorDeAlertas(err instanceof Error ? err.message : "No se pudo eliminar la alerta.");
    }
  }

  const visibles = notificaciones.slice(0, tanda);

  return (
    <div className="alerts-page">
      <h1>Alertas</h1>
      <p className="alerts-subtitle">Te avisamos cuando llega un remate que te puede interesar.</p>

      <div className="alerts-columnas">
        {/* ---------- Lo que llegó ---------- */}
        <div className="alerts-principal">
          <MisAnuncios />

          <section>
            <div className="alerts-section-fila">
              <h2 className="alerts-section-title">
                Remates que calzan con tus alertas
                {noLeidas > 0 && <span className="alerts-sin-leer">{noLeidas} sin leer</span>}
              </h2>
              {noLeidas > 0 && (
                <button type="button" className="alerts-boton-texto" onClick={marcarTodasLeidas}>
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {error && <p className="alerts-error">No se pudieron cargar las notificaciones: {error}</p>}
            {cargando && notificaciones.length === 0 && <p className="alerts-empty">Cargando...</p>}
            {!cargando && !error && notificaciones.length === 0 && (
              <p className="alerts-empty">
                Todavía no hay avisos. Llegan cuando se carga un remate nuevo que cumple alguna de tus alertas.
              </p>
            )}

            <ul className="alerts-notification-list">
              {visibles.map((n) => {
                const propiedad = n.property_id ? propiedadesPorId.get(n.property_id) : undefined;
                const clases = `alerts-notification-item ${n.is_read ? "" : "is-unread"}`;

                // La propiedad ya no existe: se muestra el aviso, pero sin enlace
                if (!n.property_id) {
                  return (
                    <li key={n.id} className={clases}>
                      <div className="alerts-notification-texto">
                        <p className="alerts-notification-titulo">Una propiedad que ya no está disponible</p>
                        <p className="alerts-notification-detalle">Avisado el {fechaCorta(n.created_at)}</p>
                      </div>
                    </li>
                  );
                }

                const terminado =
                  propiedad && (remateRetirado(propiedad.status) || remateFinalizado(propiedad.auction_date));

                return (
                  <li key={n.id}>
                    <Link to={`/propiedades/${n.property_id}`} className={clases} onClick={() => marcarLeida(n.id)}>
                      <div className="alerts-notification-texto">
                        <p className="alerts-notification-titulo">
                          {!n.is_read && <span className="alerts-nuevo">Nuevo</span>}
                          {n.property_title ?? "Propiedad"}
                        </p>
                        <p className="alerts-notification-detalle">
                          {/* Paso 98: avisos por mejora de nivel (los demás son de remates nuevos) */}
                          {n.alert_type === "cambio_semaforo" && "Bajó su nivel de riesgo · "}
                          {propiedad && `${comunasPorId[propiedad.comuna_id] ?? "Comuna desconocida"} · `}
                          {propiedad && `${formatCLP(Number(propiedad.opening_price))} · `}
                          Avisado el {fechaCorta(n.created_at)}
                        </p>
                      </div>
                      {terminado ? (
                        <span className="alerts-terminado">
                          {remateRetirado(propiedad.status) ? "Remate retirado" : "Remate finalizado"}
                        </span>
                      ) : (
                        propiedad?.evaluation && <RiskBadge riesgo={propiedad.evaluation.result_level} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {notificaciones.length > visibles.length && (
              <button type="button" className="alerts-mas" onClick={() => setTanda(tanda + POR_TANDA)}>
                Mostrar más ({notificaciones.length - visibles.length})
              </button>
            )}
          </section>
        </div>

        {/* ---------- De qué quiere que le avisen ---------- */}
        <aside className="alerts-lateral">
          <h2 className="alerts-section-title">Mis alertas</h2>
          <p className="alerts-ayuda">
            Elige una o más condiciones. Te avisaremos cuando llegue un remate nuevo que las cumpla todas.
          </p>

          <form className="alerts-form" onSubmit={crearAlerta} noValidate>
            <label className="alerts-campo">
              Comuna
              <select value={comunaId} onChange={(e) => setComunaId(e.target.value)}>
                <option value="">Cualquier comuna</option>
                {comunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="alerts-campo">
              Riesgo
              <select value={riesgo} onChange={(e) => setRiesgo(e.target.value)}>
                <option value="">Cualquier riesgo</option>
                <option value="verde">Solo riesgo bajo</option>
                <option value="amarillo">Riesgo bajo o medio</option>
              </select>
            </label>

            <label className="alerts-campo">
              Precio mínimo del remate, hasta
              <span className="alerts-precio">
                <span aria-hidden="true">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Sin tope"
                  // Se guardan solo las cifras y se muestran con puntos: 60000000 -> 60.000.000
                  value={precio === "" ? "" : Number(precio).toLocaleString("es-CL")}
                  onChange={(e) => setPrecio(e.target.value.replace(/\D/g, "").slice(0, LARGO_MAXIMO_DEL_PRECIO))}
                />
              </span>
            </label>

            {errorDelFormulario && (
              <p className="alerts-error-chico" role="alert">
                {errorDelFormulario}
              </p>
            )}

            <button type="submit" className="alerts-submit-btn" disabled={guardando}>
              {guardando ? "Creando..." : "Crear alerta"}
            </button>
          </form>

          {errorDeAlertas && <p className="alerts-error">No se pudo completar: {errorDeAlertas}</p>}
          {alertas === null && !errorDeAlertas && <p className="alerts-empty">Cargando...</p>}
          {alertas !== null && alertas.length === 0 && (
            <p className="alerts-empty">Todavía no tienes alertas. Crea la primera con el formulario.</p>
          )}

          <ul className="alerts-criteria-list">
            {(alertas ?? []).map((alerta) => {
              const cuantos = calzanHoy(alerta);
              return (
                <li key={alerta.id} className="alerts-criteria-item">
                  <div className="alerts-criteria-texto">
                    <p className="alerts-criteria-comuna">
                      {alerta.comuna_id === null ? "Cualquier comuna" : (alerta.comuna_name ?? "Comuna desconocida")}
                    </p>
                    <p className="alerts-criteria-condiciones">
                      {[
                        textoDelRiesgo(alerta.max_risk_level),
                        alerta.max_price !== null ? `Hasta ${formatCLP(Number(alerta.max_price))}` : "",
                      ]
                        .filter((texto) => texto !== "")
                        .join(" · ") || "Cualquier riesgo y precio"}
                    </p>
                    <p className="alerts-criteria-hoy">
                      {cuantos === 0
                        ? "Hoy ningún remate vigente la cumple"
                        : cuantos === 1
                          ? "Hoy la cumple 1 remate vigente"
                          : `Hoy la cumplen ${cuantos.toLocaleString("es-CL")} remates vigentes`}
                    </p>
                  </div>
                  <button type="button" className="alerts-delete-btn" onClick={() => eliminarAlerta(alerta.id)}>
                    Eliminar
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}