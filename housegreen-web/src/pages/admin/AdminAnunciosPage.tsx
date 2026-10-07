import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { nombreComuna, plural } from "./publicacion";
import type { PublicacionAdmin } from "./publicacion";
import "./AdminAnunciosPage.css";

// Paso 88: el administrador envía anuncios a los inversionistas y ve los que ya envió.
// Los anuncios llegan dentro de HouseGreen (no por correo) y se envían en el momento.

type Audiencia = "todos" | "persona" | "vieron" | "guardaron";

// Lo que devuelve la API por cada anuncio enviado
interface Anuncio {
  id: string;
  title: string;
  message: string;
  audience: Audiencia;
  created_at: string;
  persona: string | null; // nombre de la persona, si fue para una sola
  publicacion: string | null; // título de la publicación, si fue para quienes la vieron o guardaron
  destinatarios: number;
  leidos: number;
}

// De GET /admin/usuarios solo se usa esto
interface Persona {
  id: string;
  full_name: string;
  email: string;
  role_name: string | null;
  is_active: boolean;
}

// Una fila de los buscadores (de personas o de publicaciones)
interface Opcion {
  id: string;
  titulo: string;
  detalle: string;
}

const AUDIENCIAS: { valor: Audiencia; nombre: string }[] = [
  { valor: "todos", nombre: "Todos los inversionistas" },
  { valor: "persona", nombre: "Una persona" },
  { valor: "vieron", nombre: "Quienes vieron una publicación" },
  { valor: "guardaron", nombre: "Quienes guardaron una publicación" },
];

const LARGO_MAXIMO_DEL_TITULO = 120;
const LARGO_MAXIMO_DEL_MENSAJE = 1000;
const OPCIONES_A_LA_VISTA = 5; // cuántos resultados muestra un buscador
const POR_TANDA = 20; // cuántos anuncios enviados se muestran de una vez

// "Irarrázaval" -> "irarrazaval": la búsqueda no distingue tildes ni mayúsculas
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// "2026-10-07T19:30:00Z" -> "7 oct 2026, 16:30"
function fechaYHora(fechaIso: string) {
  return new Date(fechaIso).toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 16:30 en vez de 04:30 p. m.
  });
}

// A quiénes fue un anuncio, en palabras
function paraQuien(anuncio: Anuncio) {
  if (anuncio.audience === "todos") return "Todos los inversionistas";
  if (anuncio.audience === "persona") return anuncio.persona ?? "Una persona (la cuenta ya no existe)";
  const accion = anuncio.audience === "vieron" ? "vieron" : "guardaron";
  return anuncio.publicacion
    ? `Quienes ${accion} «${anuncio.publicacion}»`
    : `Quienes ${accion} una publicación que ya no existe`;
}

// "3 destinatarios · 1 lo leyó"
function textoDeLectura(anuncio: Anuncio) {
  if (anuncio.destinatarios === 0) return "Sin destinatarios (las cuentas ya no existen)";
  const cuantos = plural(anuncio.destinatarios, "destinatario", "destinatarios");
  if (anuncio.leidos === 0) return `${cuantos} · nadie lo ha leído todavía`;
  if (anuncio.leidos >= anuncio.destinatarios) {
    return `${cuantos} · ${anuncio.destinatarios === 1 ? "ya lo leyó" : "todos lo leyeron"}`;
  }
  return `${cuantos} · ${anuncio.leidos} lo ${anuncio.leidos === 1 ? "leyó" : "leyeron"}`;
}

// Buscador para elegir UNA opción de una lista (una persona o una publicación).
// Cuando ya hay una elegida, la muestra con un botón para cambiarla.
function Elegir({
  etiqueta,
  textoDeAyuda,
  opciones,
  elegida,
  alElegir,
  sinOpciones,
}: {
  etiqueta: string;
  textoDeAyuda: string;
  opciones: Opcion[] | null; // null = todavía cargando
  elegida: Opcion | null;
  alElegir: (opcion: Opcion | null) => void;
  sinOpciones: string;
}) {
  const [busqueda, setBusqueda] = useState("");

  if (elegida) {
    return (
      <div className="anu-elegida">
        <div className="anu-elegida-texto">
          <p className="anu-elegida-titulo">{elegida.titulo}</p>
          <p className="anu-elegida-detalle">{elegida.detalle}</p>
        </div>
        <button type="button" className="anu-boton-claro" onClick={() => alElegir(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  if (opciones === null) return <p className="anu-nota">Cargando la lista...</p>;
  if (opciones.length === 0) return <p className="anu-nota">{sinOpciones}</p>;

  const texto = normalizar(busqueda.trim());
  const coinciden = opciones.filter((o) => texto === "" || normalizar(`${o.titulo} ${o.detalle}`).includes(texto));
  const aLaVista = coinciden.slice(0, OPCIONES_A_LA_VISTA);

  return (
    <div className="anu-elegir">
      <label className="anu-campo">
        {etiqueta}
        <input
          type="search"
          placeholder={textoDeAyuda}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {coinciden.length === 0 && <p className="anu-nota">Nada coincide con esa búsqueda.</p>}

      <ul className="anu-opciones">
        {aLaVista.map((opcion) => (
          <li key={opcion.id}>
            <button type="button" onClick={() => alElegir(opcion)}>
              <span className="anu-opciones-titulo">{opcion.titulo}</span>
              <span className="anu-opciones-detalle">{opcion.detalle}</span>
            </button>
          </li>
        ))}
      </ul>

      {coinciden.length > aLaVista.length && (
        <p className="anu-nota">Hay {coinciden.length - aLaVista.length} más. Escribe para acotar la búsqueda.</p>
      )}
    </div>
  );
}

export function AdminAnunciosPage() {
  // Anuncios enviados
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tanda, setTanda] = useState(POR_TANDA);

  // Listas para elegir a quién va (null = todavía cargando)
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [publicaciones, setPublicaciones] = useState<PublicacionAdmin[] | null>(null);
  const [errorDeListas, setErrorDeListas] = useState("");

  // El anuncio que se está escribiendo
  const [para, setPara] = useState<Audiencia>("todos");
  const [persona, setPersona] = useState<Opcion | null>(null);
  const [publicacion, setPublicacion] = useState<Opcion | null>(null);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [confirmando, setConfirmando] = useState(false); // se pregunta antes de enviar
  const [enviando, setEnviando] = useState(false);
  const [errorDeEnvio, setErrorDeEnvio] = useState("");
  const [aviso, setAviso] = useState(""); // "Anuncio enviado a 3 personas."

  useEffect(() => {
    api
      .get("/admin/anuncios")
      .then((datos: Anuncio[]) => setAnuncios(datos))
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setCargando(false));

    const avisarError = (err: unknown) => setErrorDeListas(err instanceof Error ? err.message : "Error desconocido");
    api
      .get("/admin/usuarios")
      .then((datos: Persona[]) => setPersonas(datos))
      .catch(avisarError);
    api
      .get("/admin/publicaciones")
      .then((datos: PublicacionAdmin[]) => setPublicaciones(datos))
      .catch(avisarError);
  }, []);

  // Solo reciben anuncios los inversionistas con la cuenta habilitada (la misma regla de la API)
  const inversionistas = personas?.filter((p) => p.role_name === "inversionista" && p.is_active) ?? null;

  const opcionesDePersonas: Opcion[] | null =
    inversionistas
      ?.map((p) => ({ id: p.id, titulo: p.full_name, detalle: p.email }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "es")) ?? null;

  // Publicaciones que alguien vio (o guardó), de la que tiene más personas a la que tiene menos
  const cuenta = (p: PublicacionAdmin) => (para === "vieron" ? p.personas : p.guardados);
  const opcionesDePublicaciones: Opcion[] | null =
    publicaciones
      ?.filter((p) => cuenta(p) > 0)
      .sort((a, b) => cuenta(b) - cuenta(a))
      .map((p) => ({
        id: p.id,
        titulo: p.title,
        detalle:
          para === "vieron"
            ? `${nombreComuna(p)} · ${plural(p.personas, "persona la vio", "personas la vieron")}`
            : `${nombreComuna(p)} · ${plural(p.guardados, "persona la guardó", "personas la guardaron")}`,
      })) ?? null;

  function cambiarPara(valor: Audiencia) {
    setPara(valor);
    setPublicacion(null); // la publicación elegida puede no servir para la otra opción
    setErrorDeEnvio("");
    setAviso("");
  }

  // Cada vez que se cambia algo del anuncio se borran los mensajes anteriores
  function alCambiar(cambio: () => void) {
    cambio();
    setErrorDeEnvio("");
    setAviso("");
  }

  // A quiénes va el anuncio que se está escribiendo, para la pregunta de confirmación
  function destinoEnPalabras() {
    if (para === "todos") {
      return inversionistas ? `los ${plural(inversionistas.length, "inversionista", "inversionistas")}` : "todos los inversionistas";
    }
    if (para === "persona") return persona?.titulo ?? "";
    return `quienes ${para === "vieron" ? "vieron" : "guardaron"} «${publicacion?.titulo ?? ""}»`;
  }

  // Primer paso: se revisa el anuncio y se pregunta antes de enviarlo
  function revisar(e: React.FormEvent) {
    e.preventDefault();
    setAviso("");
    let problema = "";
    if (para === "persona" && !persona) problema = "Elige a la persona.";
    else if ((para === "vieron" || para === "guardaron") && !publicacion) problema = "Elige la publicación.";
    else if (titulo.trim() === "") problema = "Escribe el título del anuncio.";
    else if (mensaje.trim() === "") problema = "Escribe el mensaje del anuncio.";

    setErrorDeEnvio(problema);
    if (problema === "") setConfirmando(true);
  }

  // Segundo paso: se envía
  async function enviar() {
    setEnviando(true);
    setErrorDeEnvio("");
    try {
      const enviado: Anuncio = await api.post("/admin/anuncios", {
        title: titulo.trim(),
        message: mensaje.trim(),
        audience: para,
        target_user_id: para === "persona" ? persona?.id : null,
        property_id: para === "vieron" || para === "guardaron" ? publicacion?.id : null,
      });
      setAnuncios((actuales) => [enviado, ...actuales]); // el nuevo queda primero
      setAviso(`Anuncio enviado a ${plural(enviado.destinatarios, "persona", "personas")}.`);
      setTitulo("");
      setMensaje("");
      setPersona(null);
      setPublicacion(null);
    } catch (err) {
      setErrorDeEnvio(err instanceof Error ? err.message : "No se pudo enviar el anuncio.");
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  }

  const visibles = anuncios.slice(0, tanda);

  return (
    <section>
      <h1 className="admin-titulo">Anuncios</h1>
      <p className="admin-subtitulo">Mensajes para los inversionistas. Les llegan dentro de HouseGreen.</p>

      {/* ---------- Nuevo anuncio ---------- */}
      <form className="anu-formulario" onSubmit={revisar} noValidate>
        <h2 className="anu-seccion">Nuevo anuncio</h2>

        {/* Mientras se pregunta o se envía, los campos quedan bloqueados */}
        <fieldset className="anu-campos" disabled={confirmando || enviando}>
          <p className="anu-etiqueta" id="anu-para">
            Para
          </p>
          <div className="anu-para" role="radiogroup" aria-labelledby="anu-para">
            {AUDIENCIAS.map((a) => (
              <label key={a.valor} className={`anu-para-opcion ${para === a.valor ? "is-activa" : ""}`}>
                <input
                  type="radio"
                  name="para"
                  value={a.valor}
                  checked={para === a.valor}
                  onChange={() => cambiarPara(a.valor)}
                />
                {a.nombre}
              </label>
            ))}
          </div>

          {errorDeListas && para !== "todos" && (
            <p className="anu-error-chico">No se pudo cargar la lista: {errorDeListas}</p>
          )}

          {para === "todos" && inversionistas && (
            <p className="anu-nota">
              {inversionistas.length === 0
                ? "Todavía no hay inversionistas registrados."
                : inversionistas.length === 1
                  ? "Lo recibirá el único inversionista registrado."
                  : `Lo recibirán los ${inversionistas.length} inversionistas registrados.`}
            </p>
          )}

          {para === "persona" && !errorDeListas && (
            <Elegir
              etiqueta="Buscar a la persona"
              textoDeAyuda="Nombre o correo"
              opciones={opcionesDePersonas}
              elegida={persona}
              alElegir={(opcion) => alCambiar(() => setPersona(opcion))}
              sinOpciones="Todavía no hay inversionistas registrados."
            />
          )}

          {(para === "vieron" || para === "guardaron") && !errorDeListas && (
            <Elegir
              key={para} // al cambiar entre "vieron" y "guardaron" el buscador parte vacío
              etiqueta="Buscar la publicación"
              textoDeAyuda="Título o comuna"
              opciones={opcionesDePublicaciones}
              elegida={publicacion}
              alElegir={(opcion) => alCambiar(() => setPublicacion(opcion))}
              sinOpciones={
                para === "vieron"
                  ? "Todavía nadie ha visto una publicación."
                  : "Todavía nadie ha guardado una publicación."
              }
            />
          )}

          <label className="anu-campo">
            <span className="anu-campo-arriba">
              Título
              <span className="anu-contador">
                {titulo.length}/{LARGO_MAXIMO_DEL_TITULO}
              </span>
            </span>
            <input
              type="text"
              maxLength={LARGO_MAXIMO_DEL_TITULO}
              value={titulo}
              onChange={(e) => alCambiar(() => setTitulo(e.target.value))}
            />
          </label>

          <label className="anu-campo">
            <span className="anu-campo-arriba">
              Mensaje
              <span className="anu-contador">
                {mensaje.length}/{LARGO_MAXIMO_DEL_MENSAJE}
              </span>
            </span>
            <textarea
              rows={4}
              maxLength={LARGO_MAXIMO_DEL_MENSAJE}
              value={mensaje}
              onChange={(e) => alCambiar(() => setMensaje(e.target.value))}
            />
          </label>
        </fieldset>

        {errorDeEnvio && (
          <p className="anu-error-chico" role="alert">
            {errorDeEnvio}
          </p>
        )}
        {aviso && (
          <p className="anu-aviso" role="status">
            {aviso}
          </p>
        )}

        {!confirmando && !enviando && (
          <button type="submit" className="anu-boton-enviar">
            Enviar anuncio
          </button>
        )}

        {/* Un anuncio enviado no se puede retirar: por eso se pregunta antes */}
        {(confirmando || enviando) && (
          <div className="anu-confirmar">
            <p>
              ¿Enviar este anuncio a {destinoEnPalabras()}? Después no se puede retirar.
            </p>
            <div className="anu-confirmar-botones">
              <button type="button" className="anu-boton-enviar" onClick={enviar} disabled={enviando}>
                {enviando ? "Enviando..." : "Sí, enviar"}
              </button>
              <button
                type="button"
                className="anu-boton-claro"
                onClick={() => setConfirmando(false)}
                disabled={enviando}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ---------- Enviados ---------- */}
      <h2 className="anu-seccion anu-seccion-enviados">
        Enviados{!cargando && !error && ` · ${anuncios.length}`}
      </h2>

      {cargando && <p className="anu-nota">Cargando...</p>}
      {error && <p className="anu-error">No se pudieron cargar los anuncios: {error}</p>}
      {!cargando && !error && anuncios.length === 0 && (
        <div className="anu-vacio">Todavía no has enviado anuncios. Aparecerán aquí después del primero.</div>
      )}

      <ul className="anu-lista">
        {visibles.map((anuncio) => (
          <li key={anuncio.id} className="anu-item">
            <div className="anu-item-arriba">
              <h3>{anuncio.title}</h3>
              <span className="anu-item-fecha">{fechaYHora(anuncio.created_at)}</span>
            </div>
            <p className="anu-item-para">Para: {paraQuien(anuncio)}</p>
            <p className="anu-item-mensaje">{anuncio.message}</p>
            <p className="anu-item-lectura">{textoDeLectura(anuncio)}</p>
          </li>
        ))}
      </ul>

      {anuncios.length > visibles.length && (
        <div className="anu-mas">
          <p>
            Mostrando {visibles.length} de {anuncios.length}
          </p>
          <button type="button" className="anu-boton-claro" onClick={() => setTanda(tanda + POR_TANDA)}>
            Mostrar más
          </button>
        </div>
      )}
    </section>
  );
}