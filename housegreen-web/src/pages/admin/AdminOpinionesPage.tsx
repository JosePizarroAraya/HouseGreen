import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Estrellas } from "../../components/Estrellas";
import { TEMAS, nombreDeTema, fechaCorta } from "../../utils/opiniones";
import type { Opinion } from "../../utils/opiniones";
import "./AdminOpinionesPage.css";

// Paso 83: el administrador ve todas las opiniones, con su promedio, y responde
// las de quienes aceptaron respuesta.

// Una opinión como la ve el administrador: con el nombre y el correo de quien la envió
interface OpinionAdmin extends Opinion {
  user_name: string;
  user_email: string;
}

interface Resumen {
  total: number;
  average: number | null;
  by_rating: Record<string, number>; // {"1": 0, "2": 3, ...}
  pending_reply: number;
}

type Vista = "todas" | "por_responder" | "respondidas";

const POR_TANDA = 20; // cuántas opiniones se muestran de una vez
const LARGO_MAXIMO_DE_LA_RESPUESTA = 1000;

function esperaRespuesta(opinion: OpinionAdmin) {
  return opinion.allows_reply && opinion.replies.length === 0;
}

// Con los datos de la lista se vuelve a calcular el resumen (así se actualiza al responder)
function resumir(opiniones: OpinionAdmin[]): Resumen {
  const porCalificacion: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let suma = 0;
  for (const opinion of opiniones) {
    porCalificacion[String(opinion.rating)] += 1;
    suma += opinion.rating;
  }
  return {
    total: opiniones.length,
    average: opiniones.length > 0 ? Math.round((suma / opiniones.length) * 10) / 10 : null,
    by_rating: porCalificacion,
    pending_reply: opiniones.filter(esperaRespuesta).length,
  };
}

export function AdminOpinionesPage() {
  const [opiniones, setOpiniones] = useState<OpinionAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [vista, setVista] = useState<Vista>("todas");
  const [tema, setTema] = useState(""); // vacío = todos
  const [calificacion, setCalificacion] = useState(0); // 0 = todas
  const [tanda, setTanda] = useState(POR_TANDA);

  // Respuesta que se está escribiendo: una sola a la vez
  const [respondiendo, setRespondiendo] = useState<string | null>(null); // id de la opinión
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorDeRespuesta, setErrorDeRespuesta] = useState("");

  useEffect(() => {
    api
      .get("/admin/opiniones")
      .then((datos: { items: OpinionAdmin[] }) => setOpiniones(datos.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setCargando(false));
  }, []);

  const resumen = resumir(opiniones);
  const respondidas = opiniones.filter((o) => o.replies.length > 0).length;

  const filtradas = opiniones.filter(
    (o) =>
      (vista === "todas" ||
        (vista === "por_responder" && esperaRespuesta(o)) ||
        (vista === "respondidas" && o.replies.length > 0)) &&
      (tema === "" || o.topic === tema) &&
      (calificacion === 0 || o.rating === calificacion)
  );
  const visibles = filtradas.slice(0, tanda);

  function cambiarFiltro(cambio: () => void) {
    cambio();
    setTanda(POR_TANDA);
  }

  function abrirRespuesta(id: string) {
    setRespondiendo(id);
    setTexto("");
    setErrorDeRespuesta("");
  }

  async function responder(e: React.FormEvent, id: string) {
    e.preventDefault();
    setErrorDeRespuesta("");
    if (texto.trim() === "") {
      setErrorDeRespuesta("Escribe la respuesta.");
      return;
    }
    setEnviando(true);
    try {
      // La API devuelve la opinión con la respuesta nueva: se reemplaza en la lista
      const actualizada: OpinionAdmin = await api.post(`/admin/opiniones/${id}/respuesta`, { message: texto.trim() });
      setOpiniones((actuales) => actuales.map((o) => (o.id === id ? actualizada : o)));
      setRespondiendo(null);
      setTexto("");
    } catch (err) {
      setErrorDeRespuesta(err instanceof Error ? err.message : "No se pudo enviar la respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  const mayorCantidad = Math.max(1, ...Object.values(resumen.by_rating));

  return (
    <section>
      <h1 className="admin-titulo">Opiniones</h1>
      <p className="admin-subtitulo">
        {cargando
          ? "Cargando..."
          : resumen.total === 1
            ? "1 opinión recibida"
            : `${resumen.total} opiniones recibidas`}
      </p>

      {error && <p className="opa-error">No se pudieron cargar las opiniones: {error}</p>}

      {!cargando && !error && resumen.total === 0 && (
        <div className="opa-vacio">Todavía no hay opiniones. Aparecerán aquí cuando alguien envíe la primera.</div>
      )}

      {resumen.total > 0 && (
        <>
          {/* Resumen: promedio y cuántas opiniones hay de cada calificación */}
          <div className="opa-resumen">
            <div className="opa-promedio">
              <p className="opa-promedio-numero">{resumen.average?.toLocaleString("es-CL", { minimumFractionDigits: 1 })}</p>
              <Estrellas calificacion={Math.round(resumen.average ?? 0)} />
              <p className="opa-promedio-texto">promedio de 5</p>
            </div>
            <ul className="opa-barras" aria-label="Opiniones por calificación">
              {[5, 4, 3, 2, 1].map((numero) => {
                const cantidad = resumen.by_rating[String(numero)] ?? 0;
                return (
                  <li key={numero}>
                    <span className="opa-barra-numero">{numero} ★</span>
                    <span className="opa-barra-fondo">
                      <span className="opa-barra-llena" style={{ width: `${(cantidad / mayorCantidad) * 100}%` }} />
                    </span>
                    <span className="opa-barra-cantidad">{cantidad}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pestañas */}
          <div className="opa-pestanas" role="tablist" aria-label="Qué opiniones mostrar">
            {(
              [
                ["todas", `Todas · ${resumen.total}`],
                ["por_responder", `Por responder · ${resumen.pending_reply}`],
                ["respondidas", `Respondidas · ${respondidas}`],
              ] as [Vista, string][]
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={vista === valor}
                className={`opa-pestana ${vista === valor ? "is-activa" : ""}`}
                onClick={() => cambiarFiltro(() => setVista(valor))}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {/* Filtros por tema y calificación */}
          <div className="opa-filtros">
            <label>
              Tema
              <select value={tema} onChange={(e) => cambiarFiltro(() => setTema(e.target.value))}>
                <option value="">Todos</option>
                {TEMAS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Calificación
              <select
                value={calificacion}
                onChange={(e) => cambiarFiltro(() => setCalificacion(Number(e.target.value)))}
              >
                <option value={0}>Todas</option>
                {[5, 4, 3, 2, 1].map((numero) => (
                  <option key={numero} value={numero}>
                    {numero} {numero === 1 ? "estrella" : "estrellas"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtradas.length === 0 && <div className="opa-vacio">No hay opiniones con esos filtros.</div>}

          <ul className="opa-lista">
            {visibles.map((opinion) => (
              <li key={opinion.id} className="opa-item">
                <div className="opa-item-arriba">
                  <Estrellas calificacion={opinion.rating} />
                  <span className="opa-item-tema">{nombreDeTema(opinion.topic)}</span>
                  <span className="opa-item-fecha">{fechaCorta(opinion.created_at)}</span>
                </div>
                <p className="opa-item-persona">
                  {opinion.user_name} · {opinion.user_email}
                </p>

                {opinion.message ? (
                  <p className="opa-item-mensaje">{opinion.message}</p>
                ) : (
                  <p className="opa-item-mensaje is-vacio">Sin mensaje.</p>
                )}

                {opinion.replies.map((respuesta) => (
                  <div key={respuesta.id} className="opa-respuesta">
                    <p className="opa-respuesta-titulo">Respuesta enviada · {fechaCorta(respuesta.created_at)}</p>
                    <p>{respuesta.message}</p>
                  </div>
                ))}

                {/* Solo se puede responder si la persona lo autorizó */}
                {!opinion.allows_reply && <p className="opa-item-nota">No autorizó que le respondan.</p>}

                {opinion.allows_reply && respondiendo !== opinion.id && (
                  <button type="button" className="opa-boton-responder" onClick={() => abrirRespuesta(opinion.id)}>
                    {opinion.replies.length === 0 ? "Responder" : "Responder otra vez"}
                  </button>
                )}

                {opinion.allows_reply && respondiendo === opinion.id && (
                  <form className="opa-formulario" onSubmit={(e) => responder(e, opinion.id)}>
                    <label>
                      Tu respuesta para {opinion.user_name}
                      <textarea
                        rows={3}
                        autoFocus
                        maxLength={LARGO_MAXIMO_DE_LA_RESPUESTA}
                        value={texto}
                        onChange={(e) => {
                          setTexto(e.target.value);
                          setErrorDeRespuesta("");
                        }}
                      />
                    </label>
                    {errorDeRespuesta && (
                      <p className="opa-error-chico" role="alert">
                        {errorDeRespuesta}
                      </p>
                    )}
                    <div className="opa-formulario-botones">
                      <button type="submit" className="opa-boton-enviar" disabled={enviando}>
                        {enviando ? "Enviando..." : "Enviar respuesta"}
                      </button>
                      <button type="button" className="opa-boton-cancelar" onClick={() => setRespondiendo(null)}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>

          {filtradas.length > visibles.length && (
            <div className="opa-mas">
              <p>
                Mostrando {visibles.length} de {filtradas.length}
              </p>
              <button type="button" onClick={() => setTanda(tanda + POR_TANDA)}>
                Mostrar más
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}