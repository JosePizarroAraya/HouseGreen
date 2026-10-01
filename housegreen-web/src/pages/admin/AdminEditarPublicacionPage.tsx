import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, urlDeArchivo } from "../../api/client";
import { FotoPublicacion } from "./FotoPublicacion";
import { nombreComuna, type PublicacionAdmin } from "./publicacion";
import "./AdminEditarPublicacionPage.css";

// Una foto de la publicación (pasos 23 y 24)
interface Foto {
  id: string;
  url: string;
  label: string | null;
  position: number; // 0 = portada
}

// Solo usamos estos datos del detalle (GET /admin/publicaciones/{id}, pasos 20 y 23)
interface PublicacionEditable extends PublicacionAdmin {
  opening_price: string | null;
  description: string | null;
  fotos: Foto[];
}

const MAX_DESCRIPCION = 1000;
const MAX_FOTOS = 15; // los mismos límites que revisa la API
const MAX_BYTES_FOTO = 5 * 1024 * 1024;
const MAX_ETIQUETA = 40;

function formatCLP(valor: string | null) {
  if (valor === null) return "Sin precio";
  return Number(valor).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

// Orden y etiquetas en un texto, para comparar fácilmente si algo cambió
function resumenFotos(fotos: Foto[]) {
  return JSON.stringify(fotos.map((f) => [f.id, f.label ?? ""]));
}

export function AdminEditarPublicacionPage() {
  const { id } = useParams<{ id: string }>();
  const [publicacion, setPublicacion] = useState<PublicacionEditable | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [texto, setTexto] = useState(""); // lo que está escrito en el cuadro
  const [original, setOriginal] = useState(""); // lo que está guardado en la base
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Fotos: "fotos" es lo que se ve (con el orden y etiquetas que el admin va cambiando)
  // y "fotosGuardadas" es lo que hay en la base. Si difieren, hay cambios sin guardar.
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotosGuardadas, setFotosGuardadas] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState<string | null>(null); // "Subiendo 1 de 3..."
  const [erroresFotos, setErroresFotos] = useState<string[]>([]);

  useEffect(() => {
    api
      .get(`/admin/publicaciones/${id}`)
      .then((datos: PublicacionEditable) => {
        setPublicacion(datos);
        setTexto(datos.description ?? "");
        setOriginal(datos.description ?? "");
        setFotos(datos.fotos);
        setFotosGuardadas(datos.fotos);
      })
      .catch((e: Error) => setErrorCarga(e.message));
  }, [id]);

  const cambioDescripcion = texto !== original;
  const cambioFotos = resumenFotos(fotos) !== resumenFotos(fotosGuardadas);
  const ocupado = guardando || subiendo !== null;

  // Guarda la descripción y/o el orden y etiquetas de las fotos (solo lo que cambió)
  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      if (cambioDescripcion) {
        const respuesta = await api.patch(`/admin/publicaciones/${id}/descripcion`, { description: texto });
        // La API quita los espacios sobrantes; mostramos lo que realmente quedó guardado
        const guardada = respuesta.description ?? "";
        setTexto(guardada);
        setOriginal(guardada);
      }
      if (cambioFotos) {
        const orden = fotos.map((f) => ({ id: f.id, label: f.label }));
        const respuesta: Foto[] = await api.put(`/admin/publicaciones/${id}/fotos`, orden);
        setFotos(respuesta);
        setFotosGuardadas(respuesta);
      }
      setMensaje({ tipo: "ok", texto: "Cambios guardados." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: `No se pudo guardar: ${(e as Error).message}` });
    } finally {
      setGuardando(false);
    }
  }

  // Sube las fotos elegidas una por una; si alguna falla, sigue con las demás y avisa cuál fue
  async function subirFotos(archivos: File[]) {
    const errores: string[] = [];
    let cantidad = fotos.length;
    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      // Estas revisiones también las hace la API; hacerlas antes evita subir archivos que igual se rechazarían
      if (cantidad >= MAX_FOTOS) {
        errores.push(`${archivo.name}: ya hay ${MAX_FOTOS} fotos, que es el máximo`);
        continue;
      }
      if (archivo.size > MAX_BYTES_FOTO) {
        errores.push(`${archivo.name}: pesa más de 5 MB`);
        continue;
      }
      setSubiendo(`Subiendo ${i + 1} de ${archivos.length}...`);
      const datos = new FormData();
      datos.append("archivo", archivo); // "archivo" es el nombre del campo que espera la API
      try {
        const nueva: Foto = await api.subir(`/admin/publicaciones/${id}/fotos`, datos);
        // La API la deja al final, así que se agrega al final en las dos listas
        setFotos((anteriores) => [...anteriores, nueva]);
        setFotosGuardadas((anteriores) => [...anteriores, nueva]);
        cantidad++;
      } catch (e) {
        errores.push(`${archivo.name}: ${(e as Error).message}`);
      }
    }
    setSubiendo(null);
    setErroresFotos(errores);
  }

  // Borra una foto al tiro (también se borra el archivo), después de confirmar
  async function borrarFoto(foto: Foto) {
    if (!window.confirm("¿Borrar esta foto? No se puede deshacer.")) return;
    setMensaje(null);
    try {
      const quedan: Foto[] = await api.delete(`/admin/publicaciones/${id}/fotos/${foto.id}`);
      setFotosGuardadas(quedan);
      // Se respeta el orden que el admin tenía en pantalla (aunque no lo haya guardado todavía)
      setFotos((anteriores) => anteriores.filter((f) => f.id !== foto.id));
    } catch (e) {
      setMensaje({ tipo: "error", texto: `No se pudo borrar la foto: ${(e as Error).message}` });
    }
  }

  // Mueve la foto de la posición "desde" a la posición "hasta" (solo en pantalla, hasta guardar)
  function moverFoto(desde: number, hasta: number) {
    setFotos((anteriores) => {
      const copia = [...anteriores];
      const [foto] = copia.splice(desde, 1);
      copia.splice(hasta, 0, foto);
      return copia;
    });
    setMensaje(null);
  }

  function cambiarEtiqueta(fotoId: string, etiqueta: string) {
    setFotos((anteriores) => anteriores.map((f) => (f.id === fotoId ? { ...f, label: etiqueta } : f)));
    setMensaje(null);
  }

  const volver = (
    <Link to={`/admin/publicaciones/${id}`} className="det-volver">
      ‹ Volver a la publicación
    </Link>
  );

  if (errorCarga) {
    return (
      <section>
        {volver}
        <p className="pub-error">No se pudo cargar la publicación: {errorCarga}</p>
      </section>
    );
  }

  if (!publicacion) {
    return (
      <section>
        {volver}
        <p className="admin-subtitulo">Cargando publicación...</p>
      </section>
    );
  }

  const urlPortada = fotos[0] ? urlDeArchivo(fotos[0].url) : publicacion.image_url;

  return (
    <section>
      {volver}
      <h1 className="admin-titulo">Editar publicación</h1>

      <p className="edi-aviso">
        🔒 Solo puedes cambiar las <strong>fotos</strong> y la <strong>descripción</strong>. Los datos del remate no
        se editan.
      </p>

      {/* Datos del remate: solo se muestran, no se pueden cambiar */}
      <div className="edi-bloqueada">
        {/* Si ya subieron fotos se muestra la portada; si no, la imagen que traía la publicación.
            key hace que React la vuelva a crear cuando cambia la portada (así reintenta si la anterior falló) */}
        <FotoPublicacion key={urlPortada} url={urlPortada} alt={publicacion.title} />
        <div className="edi-bloqueada-datos">
          <strong>{publicacion.title}</strong>
          <span>{nombreComuna(publicacion)} · mínimo</span>
          <span>{formatCLP(publicacion.opening_price)}</span>
        </div>
        <span className="edi-candado" aria-label="No editable">
          🔒
        </span>
      </div>

      {/* Fotos: subir (paso 25); borrar, portada, orden y etiquetas (paso 26) */}
      <div className="edi-tarjeta">
        <div className="edi-tarjeta-cabecera">
          <h2>Fotos</h2>
          <span className="edi-contador">
            {fotos.length} de {MAX_FOTOS}
          </span>
        </div>
        <p className="edi-ayuda">
          La primera es la portada: usa ‹ › para ordenar y ★ para elegir la portada. JPG, PNG o WEBP, hasta 5 MB.
        </p>

        <div className="edi-fotos">
          {fotos.map((foto, i) => (
            <div key={foto.id} className="edi-foto-caja">
              <figure className="edi-foto">
                <img src={urlDeArchivo(foto.url)} alt={foto.label || `Foto ${i + 1}`} />
                {i === 0 && <span className="edi-foto-chip edi-foto-portada">Portada</span>}
                <button
                  type="button"
                  className="edi-foto-borrar"
                  aria-label="Borrar foto"
                  title="Borrar foto"
                  disabled={ocupado}
                  onClick={() => borrarFoto(foto)}
                >
                  ✕
                </button>
              </figure>

              <div className="edi-foto-botones">
                <button
                  type="button"
                  aria-label="Mover a la izquierda"
                  title="Mover a la izquierda"
                  disabled={i === 0 || ocupado}
                  onClick={() => moverFoto(i, i - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Usar como portada"
                  title="Usar como portada"
                  disabled={i === 0 || ocupado}
                  onClick={() => moverFoto(i, 0)}
                >
                  ★
                </button>
                <button
                  type="button"
                  aria-label="Mover a la derecha"
                  title="Mover a la derecha"
                  disabled={i === fotos.length - 1 || ocupado}
                  onClick={() => moverFoto(i, i + 1)}
                >
                  ›
                </button>
              </div>

              <input
                className="edi-foto-etiqueta"
                type="text"
                maxLength={MAX_ETIQUETA}
                placeholder="Etiqueta (ej. Living)"
                aria-label={`Etiqueta de la foto ${i + 1}`}
                value={foto.label ?? ""}
                onChange={(e) => cambiarEtiqueta(foto.id, e.target.value)}
              />
            </div>
          ))}

          {fotos.length < MAX_FOTOS && (
            <label className={`edi-agregar ${subiendo ? "is-subiendo" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={ocupado}
                onChange={(e) => {
                  const archivos = Array.from(e.target.files ?? []);
                  e.target.value = ""; // permite volver a elegir el mismo archivo
                  if (archivos.length > 0) subirFotos(archivos);
                }}
              />
              <span className="edi-agregar-mas">+</span>
              <span>{subiendo ?? "Agregar"}</span>
            </label>
          )}
        </div>

        {cambioFotos && <p className="edi-pendiente">Cambiaste el orden o las etiquetas: falta guardar.</p>}

        {erroresFotos.length > 0 && (
          <ul className="pub-error edi-errores">
            {erroresFotos.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="edi-tarjeta">
        <div className="edi-tarjeta-cabecera">
          <label htmlFor="descripcion">Descripción</label>
          <span className={texto.length >= MAX_DESCRIPCION * 0.9 ? "edi-contador is-cerca" : "edi-contador"}>
            {texto.length.toLocaleString("es-CL")} / {MAX_DESCRIPCION.toLocaleString("es-CL")}
          </span>
        </div>
        <textarea
          id="descripcion"
          className="edi-textarea"
          rows={8}
          maxLength={MAX_DESCRIPCION}
          value={texto}
          placeholder="Describe la propiedad: superficie, piso, orientación, estado, cercanía a servicios..."
          onChange={(e) => {
            setTexto(e.target.value);
            setMensaje(null);
          }}
        />
      </div>

      {mensaje && <p className={mensaje.tipo === "ok" ? "edi-ok" : "pub-error"}>{mensaje.texto}</p>}

      <button
        type="button"
        className="edi-guardar"
        onClick={guardar}
        disabled={!(cambioDescripcion || cambioFotos) || ocupado}
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </section>
  );
}