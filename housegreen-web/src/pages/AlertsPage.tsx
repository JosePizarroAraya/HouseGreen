import { useState } from "react";
import { Link } from "react-router-dom";
import { useAlerts } from "../context/AlertsContext";
import { mockProperties } from "../data/mockProperties";
import type { RiskLevel } from "../types/property";
import "./AlertsPage.css";

export function AlertsPage() {
  const { criterios, notificaciones, agregarCriterio, eliminarCriterio, marcarLeida } = useAlerts();

  const [comuna, setComuna] = useState("");
  const [riesgoMaximo, setRiesgoMaximo] = useState<RiskLevel | "cualquiera">("cualquiera");
  const [precioMaximo, setPrecioMaximo] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    agregarCriterio({
      comuna,
      riesgoMaximo,
      precioMaximo: precioMaximo ? Number(precioMaximo) : null,
    });
    // Limpiamos el formulario después de crear el criterio
    setComuna("");
    setRiesgoMaximo("cualquiera");
    setPrecioMaximo("");
  }

  // Función auxiliar: busca los datos completos de la propiedad a partir del propertyId
  // guardado en la notificación (la notificación solo guarda el id, no la propiedad completa).
  function obtenerPropiedad(propertyId: string) {
    return mockProperties.find((p) => p.id === propertyId);
  }

  return (
    <div className="alerts-page">
      <h1>Alertas</h1>
      <p className="alerts-subtitle">Configura criterios y te avisamos cuando aparezca algo que calce.</p>

      <form className="alerts-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Comuna (vacío = cualquiera)"
          value={comuna}
          onChange={(e) => setComuna(e.target.value)}
          className="alerts-input"
        />

        <select
          value={riesgoMaximo}
          onChange={(e) => setRiesgoMaximo(e.target.value as RiskLevel | "cualquiera")}
          className="alerts-input"
        >
          <option value="cualquiera">Riesgo: cualquiera</option>
          <option value="verde">Riesgo máximo: bajo</option>
          <option value="amarillo">Riesgo máximo: medio</option>
          <option value="rojo">Riesgo máximo: alto</option>
        </select>

        <input
          type="number"
          placeholder="Precio máximo (opcional)"
          value={precioMaximo}
          onChange={(e) => setPrecioMaximo(e.target.value)}
          className="alerts-input"
        />

        <button type="submit" className="alerts-submit-btn">
          Crear alerta
        </button>
      </form>

      <h2 className="alerts-section-title">Mis criterios</h2>
      {criterios.length === 0 && <p className="alerts-empty">Aún no tienes criterios configurados.</p>}

      <ul className="alerts-criteria-list">
        {criterios.map((c) => (
          <li key={c.id} className="alerts-criteria-item">
            <span>
              {c.comuna || "Cualquier comuna"} · Riesgo máx: {c.riesgoMaximo} ·{" "}
              {c.precioMaximo ? `Hasta $${c.precioMaximo.toLocaleString("es-CL")}` : "Sin tope de precio"}
            </span>
            <button onClick={() => eliminarCriterio(c.id)} className="alerts-delete-btn">
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <h2 className="alerts-section-title">Notificaciones</h2>
      {notificaciones.length === 0 && <p className="alerts-empty">No tienes notificaciones todavía.</p>}

            <ul className="alerts-notification-list">
        {notificaciones.map((n) => {
          const propiedad = obtenerPropiedad(n.propertyId);
          if (!propiedad) return null;

          return (
            <Link
              key={n.id}
              to={`/propiedades/${propiedad.id}`}
              onClick={() => marcarLeida(n.id)}
              className={`alerts-notification-item ${n.leida ? "" : "is-unread"}`}
            >
              <span>
                Nueva propiedad que calza: <strong>{propiedad.titulo}</strong> ({propiedad.comuna})
              </span>
              {!n.leida && <span className="alerts-unread-dot" />}
            </Link>
          );
        })}
      </ul>
    </div>
    
  );
  
}