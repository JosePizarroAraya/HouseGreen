import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Estrellas } from "../components/Estrellas";
import {
  TEMAS,
  NOMBRE_CALIFICACION,
  LARGO_MAXIMO_DEL_MENSAJE,
  nombreDeTema,
  fechaCorta,
} from "../utils/opiniones";
import type { Opinion } from "../utils/opiniones";
import "./OpinionesPage.css";

// Paso 82: la persona califica HouseGreen (1 a 5), elige un tema, deja un mensaje opcional
// y ve las opiniones que ha enviado, con las respuestas del equipo.

type Aviso = { tipo: "ok" | "error"; texto: string } | null;

export function OpinionesPage() {
  // Formulario
  const [calificacion, setCalificacion] = useState(0); // 0 = todavía no elige
  const [tema, setTema] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [aceptaRespuesta, setAceptaRespuesta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  // Opiniones ya enviadas
  const [opiniones, setOpiniones] = useState<Opinion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorDeCarga, setErrorDeCarga] = useState("");

  useEffect(() => {
    api
      .get("/opiniones/mias")
      .then((datos: Opinion[]) => setOpiniones(datos))
      .catch((err) => setErrorDeCarga(err instanceof Error ? err.message : "No se pudieron cargar tus opiniones."))
      .finally(() => setCargando(false));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (calificacion === 0) {
      setAviso({ tipo: "error", texto: "Elige una calificación de 1 a 5 estrellas." });
      return;
    }
    if (tema === "") {
      setAviso({ tipo: "error", texto: "Elige un tema." });
      return;
    }

    setEnviando(true);
    try {
      const guardada: Opinion = await api.post("/opiniones", {
        rating: calificacion,
        topic: tema,
        message: mensaje.trim(),
        allows_reply: aceptaRespuesta,
      });
      // La opinión nueva queda primera en la lista y el formulario se limpia
      setOpiniones((actuales) => [guardada, ...actuales]);
      setCalificacion(0);
      setTema("");
      setMensaje("");
      setAceptaRespuesta(false);
      setAviso({ tipo: "ok", texto: "¡Gracias! Recibimos tu opinión." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo enviar tu opinión." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="opi-page">
      <h1>Tu opinión</h1>
      <p className="opi-subtitulo">Cuéntanos qué te parece HouseGreen. Nos ayuda a mejorar.</p>

      <form className="opi-tarjeta" onSubmit={enviar}>
        <fieldset className="opi-grupo">
          <legend>Calificación</legend>
          <div className="opi-estrellas" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
            {[1, 2, 3, 4, 5].map((numero) => (
              <button
                key={numero}
                type="button"
                role="radio"
                aria-checked={calificacion === numero}
                aria-label={`${numero} de 5: ${NOMBRE_CALIFICACION[numero]}`}
                className={numero <= calificacion ? "is-llena" : ""}
                onClick={() => {
                  setCalificacion(numero);
                  setAviso(null);
                }}
              >
                ★
              </button>
            ))}
            <span className="opi-estrellas-texto">
              {calificacion === 0 ? "Sin elegir" : NOMBRE_CALIFICACION[calificacion]}
            </span>
          </div>
        </fieldset>

        <label className="opi-campo">
          Tema
          <select
            value={tema}
            onChange={(e) => {
              setTema(e.target.value);
              setAviso(null);
            }}
          >
            <option value="">Elige un tema</option>
            {TEMAS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="opi-campo">
          Mensaje (opcional)
          <textarea
            rows={4}
            maxLength={LARGO_MAXIMO_DEL_MENSAJE}
            placeholder="¿Qué te gustó? ¿Qué mejorarías?"
            value={mensaje}
            onChange={(e) => {
              setMensaje(e.target.value);
              setAviso(null);
            }}
          />
          <span className="opi-contador">
            {mensaje.length} / {LARGO_MAXIMO_DEL_MENSAJE}
          </span>
        </label>

        <label className="opi-casilla">
          <input type="checkbox" checked={aceptaRespuesta} onChange={(e) => setAceptaRespuesta(e.target.checked)} />
          Acepto que el equipo de HouseGreen me responda
        </label>

        {aviso && (
          <p className={`opi-aviso is-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            {aviso.texto}
          </p>
        )}

        <button type="submit" className="opi-boton" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar opinión"}
        </button>
      </form>

      <h2 className="opi-titulo-lista">Mis opiniones</h2>

      {cargando && <p className="opi-vacio">Cargando...</p>}
      {errorDeCarga && <p className="opi-aviso is-error">{errorDeCarga}</p>}
      {!cargando && !errorDeCarga && opiniones.length === 0 && (
        <p className="opi-vacio">Todavía no has enviado opiniones.</p>
      )}

      <ul className="opi-lista">
        {opiniones.map((opinion) => (
          <li key={opinion.id} className="opi-item">
            <div className="opi-item-arriba">
              <Estrellas calificacion={opinion.rating} />
              <span className="opi-item-tema">{nombreDeTema(opinion.topic)}</span>
              <span className="opi-item-fecha">{fechaCorta(opinion.created_at)}</span>
            </div>

            {opinion.message ? (
              <p className="opi-item-mensaje">{opinion.message}</p>
            ) : (
              <p className="opi-item-mensaje is-vacio">Sin mensaje.</p>
            )}

            {opinion.replies.map((respuesta) => (
              <div key={respuesta.id} className="opi-respuesta">
                <p className="opi-respuesta-titulo">Respuesta de HouseGreen · {fechaCorta(respuesta.created_at)}</p>
                <p>{respuesta.message}</p>
              </div>
            ))}

            {opinion.replies.length === 0 && (
              <p className="opi-item-nota">
                {opinion.allows_reply ? "Aceptaste que te respondan. Todavía no hay respuesta." : "No pediste respuesta."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}