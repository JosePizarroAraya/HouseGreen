import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { remateFinalizado, remateRetirado } from "../../components/estadoRemate";
import { nombreComuna, plural, textoZona, type Dominio, type PublicacionAdmin, type Zona } from "./publicacion";
import "./AdminPublicacionesPage.css"; // de aquí sale el distintivo de zona (.pub-zona)
import "./AdminSemaforoPage.css";

// Paso 68: apartado del admin para completar el semáforo.
// Muestra las propiedades que todavía no tienen zona de precio y permite elegirla con un clic.

type Vista = "pendientes" | "revisadas";

// Lo que devuelve PATCH /admin/publicaciones/{id}/semaforo: cómo quedó la propiedad
interface Respuesta {
  market_zone: Zona | null;
  domain_type: Dominio | null;
  result_level: Zona | null;
  total_points: number | null;
}

const POR_TANDA = 20; // cuántas propiedades se muestran de una vez

const ZONAS: { valor: Zona; texto: string }[] = [
  { valor: "verde", texto: "Verde" },
  { valor: "amarillo", texto: "Amarilla" },
  { valor: "rojo", texto: "Roja" },
];

function formatCLP(valor: string | null) {
  if (valor === null) return "Sin precio";
  return Number(valor).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

// "Remate mar 6 oct · 13:00". Las 00:00 significan "hora no informada" y no se muestran.
function textoRemate(iso: string | null) {
  if (!iso) return "Sin fecha de remate";
  const fecha = new Date(iso);
  // toLocaleDateString entrega "mar, 6 oct": se quita la coma para que quede igual que en el catálogo
  const dia = fecha.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
  if (fecha.getHours() === 0 && fecha.getMinutes() === 0) return `Remate ${dia}`;
  const hora = fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Remate ${dia} · ${hora}`;
}

// Orden de la lista: primero las que se rematan antes; las que no tienen fecha van al final.
// (Las que ya se remataron no llegan aquí: se sacan antes, paso 70.)
function compararPorRemate(a: PublicacionAdmin, b: PublicacionAdmin) {
  const cuando = (p: PublicacionAdmin) => (p.auction_date ? new Date(p.auction_date).getTime() : Infinity);
  if (cuando(a) === cuando(b)) return 0;
  return cuando(a) < cuando(b) ? -1 : 1;
}

export function AdminSemaforoPage() {
  const [publicaciones, setPublicaciones] = useState<PublicacionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("pendientes");
  const [tanda, setTanda] = useState(POR_TANDA);
  // Propiedades que se cambiaron en esta visita: siguen a la vista aunque ya no correspondan a la pestaña,
  // así el admin alcanza a corregir si se equivocó de botón.
  const [tocadas, setTocadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null); // id de la propiedad que se está guardando
  const [errorFila, setErrorFila] = useState<{ id: string; mensaje: string } | null>(null);

  useEffect(() => {
    api
      .get("/admin/publicaciones")
      .then((datos: PublicacionAdmin[]) => setPublicaciones(datos))
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

    // Pasos 70 y 71: los remates que ya se realizaron o que el sitio retiró no se revisan,
  // así que no aparecen en ninguna de las dos pestañas
  const vigentes = publicaciones.filter((p) => !remateFinalizado(p.auction_date) && !remateRetirado(p.status));
  const finalizadas = publicaciones.length - vigentes.length;

  const totalPendientes = vigentes.filter((p) => p.market_zone === null).length;
  const totalRevisadas = vigentes.length - totalPendientes;

  const enVista = vigentes
    .filter((p) => (vista === "pendientes" ? p.market_zone === null : p.market_zone !== null) || tocadas.includes(p.id))
    .sort(compararPorRemate);
  const visibles = enVista.slice(0, tanda);

  function cambiarVista(nueva: Vista) {
    setVista(nueva);
    setTanda(POR_TANDA);
    setTocadas([]);
    setErrorFila(null);
  }

  // Guarda la zona de precio o el dominio de una propiedad. La API recalcula el semáforo y devuelve cómo quedó.
  async function guardar(id: string, cambio: { market_zone?: Zona | null; domain_type?: Dominio | null }) {
    setGuardando(id);
    setErrorFila(null);
    try {
      const respuesta: Respuesta = await api.patch(`/admin/publicaciones/${id}/semaforo`, cambio);
      setPublicaciones((actuales) => actuales.map((p) => (p.id === id ? { ...p, ...respuesta } : p)));
      setTocadas((actuales) => (actuales.includes(id) ? actuales : [...actuales, id]));
    } catch (e) {
      setErrorFila({ id, mensaje: e instanceof Error ? e.message : "error desconocido" });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <section>
      <h1 className="admin-titulo">Semáforo</h1>
      <p className="admin-subtitulo">
        {cargando ? "Cargando..." : `${plural(totalPendientes, "propiedad", "propiedades")} sin zona de precio`}
      </p>

      {finalizadas > 0 && (
        <p className="sem-nota">
          {finalizadas === 1
            ? "No se muestra 1 remate que ya se realizó."
            : `No se muestran ${finalizadas} remates que ya se realizaron.`}
        </p>
      )}

      {error && <p className="pub-error">No se pudieron cargar las propiedades: {error}</p>}

      <div className="sem-ayuda">
        <p>
          <strong>Cómo elegir la zona de precio.</strong> Compara el precio mínimo con el valor de mercado de la
          propiedad:
        </p>
        <ul>
          <li>
            <strong>Verde:</strong> está 40 % o más bajo el valor de mercado.
          </li>
          <li>
            <strong>Amarilla:</strong> está entre 15 % y 39,9 % más bajo.
          </li>
          <li>
            <strong>Roja:</strong> el descuento es menor a 15 %.
          </li>
        </ul>
      </div>

      <div className="sem-pestanas" role="tablist" aria-label="Propiedades pendientes o revisadas">
        <button
          type="button"
          role="tab"
          aria-selected={vista === "pendientes"}
          className={`sem-pestana ${vista === "pendientes" ? "is-activa" : ""}`}
          onClick={() => cambiarVista("pendientes")}
        >
          Pendientes · {totalPendientes}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === "revisadas"}
          className={`sem-pestana ${vista === "revisadas" ? "is-activa" : ""}`}
          onClick={() => cambiarVista("revisadas")}
        >
          Revisadas · {totalRevisadas}
        </button>
      </div>

      {!cargando && !error && enVista.length === 0 && (
        <p className="sem-vacio">
          {vista === "pendientes"
            ? "No se muestra 1 remate que ya se realizó o fue retirado."
            : `No se muestran ${finalizadas} remates que ya se realizaron o fueron retirados.`}
        </p>
      )}

      <ul className="sem-lista">
        {visibles.map((p) => {
          const ocupada = guardando === p.id;
          return (
            <li key={p.id} className="sem-item">
              <div className="sem-cabecera">
                <div className="sem-info">
                  <h2 className="sem-titulo">{p.title}</h2>
                  <p className="sem-meta">
                    {nombreComuna(p)} · {p.property_type} · {textoRemate(p.auction_date)}
                  </p>
                </div>
                <span className={`pub-zona pub-zona-${p.result_level ?? "sin"}`}>
                  <span className="pub-zona-punto" />
                  {textoZona(p)}
                </span>
              </div>

              <p className="sem-precio">
                Precio mínimo <strong>{formatCLP(p.opening_price)}</strong>
                <a href={`/propiedades/${p.id}`} target="_blank" rel="noopener noreferrer">
                  Ver detalle ↗
                </a>
              </p>

              <div className="sem-controles">
                <div className="sem-grupo" role="group" aria-label={`Zona de precio de ${p.title}`}>
                  <span className="sem-etiqueta">Precio</span>
                  {ZONAS.map((zona) => (
                    <button
                      key={zona.valor}
                      type="button"
                      className={`sem-zona sem-zona-${zona.valor} ${p.market_zone === zona.valor ? "is-elegida" : ""}`}
                      aria-pressed={p.market_zone === zona.valor}
                      disabled={ocupada}
                      onClick={() => guardar(p.id, { market_zone: zona.valor })}
                    >
                      {zona.texto}
                    </button>
                  ))}
                  {p.market_zone && (
                    <button
                      type="button"
                      className="sem-quitar"
                      disabled={ocupada}
                      onClick={() => guardar(p.id, { market_zone: null })}
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <label className="sem-grupo" htmlFor={`dominio-${p.id}`}>
                  <span className="sem-etiqueta">Dominio</span>
                  <select
                    id={`dominio-${p.id}`}
                    className="sem-select"
                    value={p.domain_type ?? ""}
                    disabled={ocupada}
                    onChange={(e) => guardar(p.id, { domain_type: (e.target.value || null) as Dominio | null })}
                  >
                    <option value="">Sin especificar</option>
                    <option value="exclusivo">Exclusivo</option>
                    <option value="otro">Otro (derechos, cuota, usufructo)</option>
                  </select>
                </label>
              </div>

              {ocupada && <p className="sem-estado">Guardando...</p>}
              {errorFila?.id === p.id && <p className="sem-error">No se pudo guardar: {errorFila.mensaje}</p>}
            </li>
          );
        })}
      </ul>

      {enVista.length > visibles.length && (
        <div className="sem-mas">
          <p>
            Mostrando {visibles.length} de {enVista.length}
          </p>
          <button type="button" className="sem-boton-mas" onClick={() => setTanda(tanda + POR_TANDA)}>
            Mostrar {Math.min(POR_TANDA, enVista.length - visibles.length)} más
          </button>
        </div>
      )}
    </section>
  );
}