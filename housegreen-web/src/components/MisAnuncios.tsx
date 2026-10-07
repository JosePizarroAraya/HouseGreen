import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAnuncios } from "../context/AnunciosContext";
import type { AnuncioRecibido } from "../context/AnunciosContext";
import { fechaCorta } from "../utils/opiniones";
import "./MisAnuncios.css";

// Paso 90: los anuncios que recibió la persona, dentro de la página Alertas.
// Se ve el título de cada uno; al abrirlo aparece el mensaje y queda marcado como leído.

const POR_TANDA = 10; // cuántos anuncios se muestran de una vez

export function MisAnuncios() {
  const { esAdmin } = useAuth();
  const { anuncios, sinLeer, cargando, error, recargar, marcarLeido } = useAnuncios();
  const [abierto, setAbierto] = useState<string | null>(null); // id del anuncio abierto (uno a la vez)
  const [tanda, setTanda] = useState(POR_TANDA);

  // Cada vez que se entra a la página se vuelven a pedir, por si llegó uno nuevo
  useEffect(() => {
    recargar();
  }, [recargar]);

  // El administrador envía anuncios, no los recibe
  if (esAdmin) return null;

  function alternar(anuncio: AnuncioRecibido) {
    if (abierto === anuncio.id) {
      setAbierto(null);
      return;
    }
    setAbierto(anuncio.id);
    marcarLeido(anuncio.id);
  }

  const visibles = anuncios.slice(0, tanda);

  return (
    <section className="anuncios">
      <h2 className="alerts-section-title">
        Anuncios
        {sinLeer > 0 && <span className="anuncios-sin-leer">{sinLeer} sin leer</span>}
      </h2>

      {error && <p className="anuncios-error">No se pudieron cargar los anuncios: {error}</p>}
      {cargando && anuncios.length === 0 && <p className="alerts-empty">Cargando...</p>}
      {!cargando && !error && anuncios.length === 0 && <p className="alerts-empty">No tienes anuncios.</p>}

      <ul className="anuncios-lista">
        {visibles.map((anuncio) => {
          const estaAbierto = abierto === anuncio.id;
          const esNuevo = anuncio.read_at === null;
          return (
            <li key={anuncio.id} className={`anuncios-item ${esNuevo ? "is-nuevo" : ""}`}>
              <button
                type="button"
                className="anuncios-cabecera"
                aria-expanded={estaAbierto}
                onClick={() => alternar(anuncio)}
              >
                <span className="anuncios-titulo">
                  {esNuevo && <span className="anuncios-nuevo">Nuevo</span>}
                  {anuncio.title}
                </span>
                <span className="anuncios-fecha">{fechaCorta(anuncio.created_at)}</span>
                <span className="anuncios-flecha" aria-hidden="true">
                  {estaAbierto ? "▴" : "▾"}
                </span>
              </button>

              {estaAbierto && (
                <div className="anuncios-cuerpo">
                  <p>{anuncio.message}</p>
                  {anuncio.property_id && (
                    <Link to={`/propiedades/${anuncio.property_id}`}>
                      Ver {anuncio.publicacion ? `«${anuncio.publicacion}»` : "la publicación"} ›
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {anuncios.length > visibles.length && (
        <button type="button" className="anuncios-mas" onClick={() => setTanda(tanda + POR_TANDA)}>
          Mostrar más ({anuncios.length - visibles.length})
        </button>
      )}
    </section>
  );
}