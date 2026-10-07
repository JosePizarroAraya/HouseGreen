import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import "./AdminPanelPage.css";

// Paso 84: Panel del administrador. Resumen de los últimos días y lo que tiene pendiente.

interface PublicacionMasVista {
  id: string;
  title: string;
  comuna: string | null;
  vistas: number;
  guardados: number;
}

// Lo que responde GET /admin/panel
interface Panel {
  dias: number;
  usuarios_nuevos: number;
  usuarios_total: number;
  publicaciones_nuevas: number;
  publicaciones_vigentes: number;
  vistas: number;
  guardados: number;
  mas_vistas: PublicacionMasVista[];
  semaforo: Record<string, number>; // verde, amarillo, rojo, sin_evaluar
  sin_zona_de_precio: number;
  opiniones_por_responder: number;
}

// Las partes de la barra del semáforo, en orden: de menor a mayor riesgo
const NIVELES: { valor: string; nombre: string }[] = [
  { valor: "verde", nombre: "Riesgo bajo" },
  { valor: "amarillo", nombre: "Riesgo medio" },
  { valor: "rojo", nombre: "Riesgo alto" },
  { valor: "sin_evaluar", nombre: "Sin evaluar" },
];

// 1234 -> "1.234"
function numero(valor: number) {
  return valor.toLocaleString("es-CL");
}

function porcentaje(parte: number, total: number) {
  return total === 0 ? "0 %" : `${Math.round((parte / total) * 100)} %`;
}

export function AdminPanelPage() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/admin/panel")
      .then((datos: Panel) => setPanel(datos))
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"));
  }, []);

  if (error) {
    return (
      <section>
        <h1 className="admin-titulo">Panel</h1>
        <p className="panel-error">No se pudo cargar el panel: {error}</p>
      </section>
    );
  }

  if (!panel) {
    return (
      <section>
        <h1 className="admin-titulo">Panel</h1>
        <p className="admin-subtitulo">Cargando...</p>
      </section>
    );
  }

  const cifras = [
    { titulo: "Usuarios nuevos", valor: panel.usuarios_nuevos, nota: `de ${numero(panel.usuarios_total)} inversionistas` },
    {
      titulo: "Publicaciones nuevas",
      valor: panel.publicaciones_nuevas,
      nota: `${numero(panel.publicaciones_vigentes)} vigentes en total`,
    },
    { titulo: "Vistas", valor: panel.vistas, nota: `propiedades abiertas en los últimos ${panel.dias} días` },
    { titulo: "Guardados", valor: panel.guardados, nota: `favoritos agregados en los últimos ${panel.dias} días` },
  ];

  const pendientes = [
    {
      cantidad: panel.sin_zona_de_precio,
      texto: panel.sin_zona_de_precio === 1 ? "publicación sin zona de precio" : "publicaciones sin zona de precio",
      enlace: "/admin/semaforo",
      accion: "Completar el semáforo",
    },
    {
      cantidad: panel.opiniones_por_responder,
      texto: panel.opiniones_por_responder === 1 ? "opinión por responder" : "opiniones por responder",
      enlace: "/admin/opiniones",
      accion: "Ver opiniones",
    },
  ].filter((pendiente) => pendiente.cantidad > 0);

  const niveles = NIVELES.map((nivel) => ({ ...nivel, cantidad: panel.semaforo[nivel.valor] ?? 0 }));
  const totalSemaforo = niveles.reduce((suma, nivel) => suma + nivel.cantidad, 0);

  return (
    <section>
      <h1 className="admin-titulo">Panel</h1>
      <p className="admin-subtitulo">Resumen de los últimos {panel.dias} días.</p>

      {/* Las cuatro cifras de la semana */}
      <div className="panel-cifras">
        {cifras.map((cifra) => (
          <div key={cifra.titulo} className="panel-cifra">
            <p className="panel-cifra-titulo">{cifra.titulo}</p>
            <p className="panel-cifra-valor">{numero(cifra.valor)}</p>
            <p className="panel-cifra-nota">{cifra.nota}</p>
          </div>
        ))}
      </div>

      {/* Paso 85: Usuarios no está en el menú; se entra desde aquí */}
      <p className="panel-accesos">
        <Link to="/admin/usuarios">Ver los usuarios registrados ›</Link>
      </p>

      {/* Lo que el administrador tiene pendiente */}
      <div className="panel-tarjeta">
        <h2>Pendientes</h2>
        {pendientes.length === 0 ? (
          <p className="panel-vacio">No tienes nada pendiente.</p>
        ) : (
          <ul className="panel-pendientes">
            {pendientes.map((pendiente) => (
              <li key={pendiente.enlace}>
                <span>
                  <strong>{numero(pendiente.cantidad)}</strong> {pendiente.texto}
                </span>
                <Link to={pendiente.enlace}>{pendiente.accion} ›</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cómo están repartidas las publicaciones vigentes según su semáforo */}
      <div className="panel-tarjeta">
        <h2>Semáforo de las publicaciones vigentes</h2>
        {totalSemaforo === 0 ? (
          <p className="panel-vacio">No hay publicaciones vigentes.</p>
        ) : (
          <>
            <div
              className="panel-barra"
              role="img"
              aria-label={niveles.map((nivel) => `${nivel.nombre}: ${nivel.cantidad}`).join(", ")}
            >
              {niveles
                .filter((nivel) => nivel.cantidad > 0)
                .map((nivel) => (
                  <span
                    key={nivel.valor}
                    className={`panel-barra-parte is-${nivel.valor}`}
                    style={{ flexGrow: nivel.cantidad }}
                    title={`${nivel.nombre}: ${numero(nivel.cantidad)} (${porcentaje(nivel.cantidad, totalSemaforo)})`}
                  />
                ))}
            </div>
            {/* La leyenda lleva el nombre y la cantidad: el color nunca va solo */}
            <ul className="panel-leyenda">
              {niveles.map((nivel) => (
                <li key={nivel.valor}>
                  <span className={`panel-leyenda-color is-${nivel.valor}`} aria-hidden="true" />
                  <span className="panel-leyenda-nombre">{nivel.nombre}</span>
                  <strong>{numero(nivel.cantidad)}</strong>
                  <span className="panel-leyenda-porcentaje">{porcentaje(nivel.cantidad, totalSemaforo)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Las publicaciones más vistas del período */}
      <div className="panel-tarjeta">
        <h2>Más vistas de la semana</h2>
        {panel.mas_vistas.length === 0 ? (
          <p className="panel-vacio">Todavía nadie ha abierto una propiedad esta semana.</p>
        ) : (
          <ol className="panel-mas-vistas">
            {panel.mas_vistas.map((publicacion, i) => (
              <li key={publicacion.id}>
                <span className="panel-puesto">{i + 1}</span>
                <span className="panel-mas-vistas-info">
                  <Link to={`/admin/publicaciones/${publicacion.id}`}>{publicacion.title}</Link>
                  <span className="panel-mas-vistas-comuna">{publicacion.comuna ?? "Sin comuna"}</span>
                </span>
                <span className="panel-mas-vistas-cifras">
                  <span>
                    <strong>{numero(publicacion.vistas)}</strong> {publicacion.vistas === 1 ? "vista" : "vistas"}
                  </span>
                  <span className="panel-mas-vistas-guardados">
                    {numero(publicacion.guardados)} {publicacion.guardados === 1 ? "guardado" : "guardados"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="panel-enlace-final">
          <Link to="/admin/publicaciones">Ver todas las publicaciones ›</Link>
        </p>
      </div>
    </section>
  );
}