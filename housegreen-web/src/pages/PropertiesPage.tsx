import { useEffect, useMemo, useState } from "react";
import { useProperties } from "../context/PropertiesContext";
import { PropertyCard } from "../components/PropertyCard";
import { useFavorites } from "../context/FavoritesContext";
import { remateFinalizado, remateRetirado } from "../components/estadoRemate";
import { CATEGORIAS, categoriaDeTipo } from "../components/tipoPropiedad";
import type { CategoriaTipo } from "../components/tipoPropiedad";
import "./PropertiesPage.css";

type Riesgo = "verde" | "amarillo" | "rojo";
type Orden = "recientes" | "remate" | "precio_asc" | "precio_desc" | "alfabetico" | "superficie";

const OPCIONES_ORDEN: { valor: Orden; texto: string }[] = [
  { valor: "recientes", texto: "Más recientes" },
  { valor: "remate", texto: "Fecha de remate, más próximo primero" },
  { valor: "precio_asc", texto: "Precio: de menor a mayor" },
  { valor: "precio_desc", texto: "Precio: de mayor a menor" },
  { valor: "alfabetico", texto: "Alfabético (A–Z)" },
  { valor: "superficie", texto: "Superficie (m²), mayor primero" },
];

// Botones rápidos de precio: rellenan "Desde" y "Hasta" (null = sin límite)
const RANGOS_PRECIO: { texto: string; desde: number | null; hasta: number | null }[] = [
  { texto: "Hasta $40M", desde: null, hasta: 40_000_000 },
  { texto: "$40M – $80M", desde: 40_000_000, hasta: 80_000_000 },
  { texto: "$80M – $150M", desde: 80_000_000, hasta: 150_000_000 },
  { texto: "Más de $150M", desde: 150_000_000, hasta: null },
];

// Paso 49: el catálogo muestra los remates de a 24 (con 1, 2, 3 o 4 columnas, las filas quedan completas)
const POR_TANDA = 24;

const NOMBRE_RIESGO: Record<Riesgo, string> = { verde: "Bajo", amarillo: "Medio", rojo: "Alto" };

// "Irarrázaval" -> "irarrazaval", "Ñuñoa" -> "nunoa": sin mayúsculas ni tildes,
// así la búsqueda encuentra lo mismo se escriba con o sin tilde
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Lee lo que se escribe en Desde/Hasta: "$40.000.000" -> 40000000 (vacío = sin límite)
function leerPesos(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "");
  return digitos === "" ? null : Number(digitos);
}

function mostrarPesos(valor: number | null) {
  return valor === null ? "" : `$${valor.toLocaleString("es-CL")}`;
}

// Agrega o quita un valor de una lista (para los botones que se pueden elegir varios)
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function PropertiesPage() {
  const [busqueda, setBusqueda] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);

  // Filtros y orden (paso 33)
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [precioDesde, setPrecioDesde] = useState<number | null>(null);
  const [precioHasta, setPrecioHasta] = useState<number | null>(null);
  const [comunasElegidas, setComunasElegidas] = useState<string[]>([]); // vacío = todas
  const [tiposElegidos, setTiposElegidos] = useState<CategoriaTipo[]>([]); // vacío = todos
  const [riesgosElegidos, setRiesgosElegidos] = useState<Riesgo[]>([]); // vacío = todos

  const { esFavorito } = useFavorites();
  const { properties, comunasPorId, cargando, error, recargar } = useProperties();

  // Paso 30: cada vez que se abre el catálogo se piden los datos de nuevo (en silencio),
  // así aparecen los cambios del admin (fotos, descripción) y los remates nuevos sin apretar F5
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Comunas que aparecen en los remates, sin repetir y de la A a la Z
  const comunas = useMemo(
    () =>
      [...new Set(properties.map((p) => comunasPorId[p.comuna_id]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [properties, comunasPorId]
  );

  // Paso 72: el sitio de remates usa más de 20 nombres de tipo; el filtro los agrupa en 8 categorías.
  // Aquí se cuenta cuántos remates vigentes hay en cada una, para mostrar el número en el botón
  const cantidadPorCategoria = useMemo(() => {
    const cantidades: Partial<Record<CategoriaTipo, number>> = {};
    for (const p of properties) {
      if (remateFinalizado(p.auction_date) || remateRetirado(p.status)) continue;
      const categoria = categoriaDeTipo(p.property_type);
      cantidades[categoria] = (cantidades[categoria] ?? 0) + 1;
    }
    return cantidades;
  }, [properties]);
  // Solo se ofrecen las categorías que tienen remates (o las que ya están elegidas)
  const categorias = CATEGORIAS.filter(
    (c) => (cantidadPorCategoria[c.valor] ?? 0) > 0 || tiposElegidos.includes(c.valor)
  );

  const propiedadesFiltradas = useMemo(() => {
    const texto = normalizar(busqueda);
    const resultado = properties.filter((p) => {
      const nombreComuna = comunasPorId[p.comuna_id] || "";
      const precio = Number(p.opening_price);
      // Si no tiene evaluación se trata como riesgo medio (igual que la tarjeta)
      const riesgo = p.evaluation?.result_level ?? "amarillo";

      const coincideTexto =
        normalizar(p.title).includes(texto) ||
        normalizar(nombreComuna).includes(texto) ||
        normalizar(p.address ?? "").includes(texto);

      return (
        coincideTexto &&
        (!soloFavoritos || esFavorito(p.id)) &&
        // Pasos 69 y 71: los remates que ya se realizaron o que el sitio retiró no se muestran,
        // salvo al ver "Solo favoritos"
        (soloFavoritos || (!remateFinalizado(p.auction_date) && !remateRetirado(p.status))) &&
        (precioDesde === null || precio >= precioDesde) &&
        (precioHasta === null || precio <= precioHasta) &&
        (comunasElegidas.length === 0 || comunasElegidas.includes(nombreComuna)) &&
        (tiposElegidos.length === 0 || tiposElegidos.includes(categoriaDeTipo(p.property_type))) &&
        (riesgosElegidos.length === 0 || riesgosElegidos.includes(riesgo))
      );
    });

    // filter() ya creó una lista nueva, así que sort() no desordena los datos originales
    const superficie = (p: (typeof properties)[number]) => Number(p.physical_info?.surface_m2 ?? -1); // sin dato: al final
    // Paso 38: fecha del remate en milisegundos; sin fecha vale Infinity para que quede al final
    const fechaRemate = (p: (typeof properties)[number]) =>
      p.auction_date ? new Date(p.auction_date).getTime() : Infinity;
    return resultado.sort((a, b) => {
      if (orden === "remate" && fechaRemate(a) !== fechaRemate(b)) return fechaRemate(a) < fechaRemate(b) ? -1 : 1;
      // (si tienen la misma fecha, o ninguna tiene, se ordenan por más recientes, abajo)
      if (orden === "precio_asc") return Number(a.opening_price) - Number(b.opening_price);
      if (orden === "precio_desc") return Number(b.opening_price) - Number(a.opening_price);
      if (orden === "alfabetico") return a.title.localeCompare(b.title, "es");
      if (orden === "superficie") return superficie(b) - superficie(a);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // más recientes primero
    });
  }, [
    properties,
    comunasPorId,
    busqueda,
    soloFavoritos,
    esFavorito,
    precioDesde,
    precioHasta,
    comunasElegidas,
    tiposElegidos,
    riesgosElegidos,
    orden,
  ]);

  // Paso 49: cuántas tarjetas se muestran. La "firma" resume la búsqueda, los filtros y el orden:
  // si cambia cualquiera de ellos, la firma guardada ya no coincide y se vuelve a las primeras 24.
  const firma = JSON.stringify([
    busqueda,
    soloFavoritos,
    orden,
    precioDesde,
    precioHasta,
    comunasElegidas,
    tiposElegidos,
    riesgosElegidos,
  ]);
  const [tanda, setTanda] = useState({ firma, cantidad: POR_TANDA });
  const cantidadVisible = tanda.firma === firma ? tanda.cantidad : POR_TANDA;
  const propiedadesVisibles = propiedadesFiltradas.slice(0, cantidadVisible);
  const faltan = propiedadesFiltradas.length - propiedadesVisibles.length;

  const filtrosActivos =
    comunasElegidas.length +
    tiposElegidos.length +
    riesgosElegidos.length +
    (precioDesde !== null || precioHasta !== null ? 1 : 0);

  function limpiar() {
    setOrden("recientes");
    setPrecioDesde(null);
    setPrecioHasta(null);
    setComunasElegidas([]);
    setTiposElegidos([]);
    setRiesgosElegidos([]);
  }

  if (cargando) {
    return <div className="properties-page">Cargando propiedades...</div>;
  }

  if (error) {
    return <div className="properties-page">Ocurrió un error: {error}</div>;
  }

  const textoOrden = OPCIONES_ORDEN.find((o) => o.valor === orden)?.texto;

  return (
    <div className="properties-page">
      <h1>Propiedades en remate</h1>
      <p className="properties-count">{propiedadesFiltradas.length} propiedades encontradas</p>

      <div className="properties-filters">
        <input
          type="text"
          placeholder="Buscar por título, comuna o dirección..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="properties-search"
        />

        <button
          type="button"
          className="cat-boton-filtros"
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto(!panelAbierto)}
        >
          Filtros y orden{filtrosActivos > 0 && ` · ${filtrosActivos}`}
        </button>

        <label className="properties-fav-toggle">
          <input type="checkbox" checked={soloFavoritos} onChange={(e) => setSoloFavoritos(e.target.checked)} />
          Solo favoritos
        </label>
      </div>

      <p className="cat-orden-actual">
        Ordenado por: <strong>{textoOrden}</strong>
      </p>

      {panelAbierto && (
        <div className="cat-panel">
          <fieldset className="cat-grupo">
            <legend>Ordenar por</legend>
            {OPCIONES_ORDEN.map((o) => (
              <label key={o.valor} className="cat-opcion">
                <input type="radio" name="orden" checked={orden === o.valor} onChange={() => setOrden(o.valor)} />
                {o.texto}
              </label>
            ))}
          </fieldset>

          <fieldset className="cat-grupo">
            <legend>Rango de precio mínimo</legend>
            <div className="cat-chips">
              {RANGOS_PRECIO.map((r) => {
                const activo = precioDesde === r.desde && precioHasta === r.hasta;
                return (
                  <button
                    key={r.texto}
                    type="button"
                    className={`cat-chip ${activo ? "is-activo" : ""}`}
                    aria-pressed={activo}
                    onClick={() => {
                      // Si ya estaba elegido, se quita; si no, rellena Desde y Hasta
                      setPrecioDesde(activo ? null : r.desde);
                      setPrecioHasta(activo ? null : r.hasta);
                    }}
                  >
                    {activo && "✓ "}
                    {r.texto}
                  </button>
                );
              })}
            </div>
            <div className="cat-precios">
              <label>
                Desde
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Sin mínimo"
                  value={mostrarPesos(precioDesde)}
                  onChange={(e) => setPrecioDesde(leerPesos(e.target.value))}
                />
              </label>
              <label>
                Hasta
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Sin máximo"
                  value={mostrarPesos(precioHasta)}
                  onChange={(e) => setPrecioHasta(leerPesos(e.target.value))}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="cat-grupo">
            <legend>Comuna</legend>
            <div className="cat-chips">
              {comunas.map((c) => {
                const activa = comunasElegidas.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cat-chip ${activa ? "is-activo" : ""}`}
                    aria-pressed={activa}
                    onClick={() => setComunasElegidas(alternar(comunasElegidas, c))}
                  >
                    {activa && "✓ "}
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="cat-grupo">
            <legend>Tipo de propiedad</legend>
            <div className="cat-chips">
              {categorias.map((c) => {
                const activo = tiposElegidos.includes(c.valor);
                return (
                  <button
                    key={c.valor}
                    type="button"
                    className={`cat-chip ${activo ? "is-activo" : ""}`}
                    aria-pressed={activo}
                    onClick={() => setTiposElegidos(alternar(tiposElegidos, c.valor))}
                  >
                    {activo && "✓ "}
                    {c.nombre}
                    <span className="cat-chip-cantidad">{cantidadPorCategoria[c.valor] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="cat-grupo">
            <legend>Riesgo según semáforo</legend>
            <div className="cat-chips">
              {(["verde", "amarillo", "rojo"] as Riesgo[]).map((r) => {
                const activo = riesgosElegidos.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    className={`cat-chip ${activo ? "is-activo" : ""}`}
                    aria-pressed={activo}
                    onClick={() => setRiesgosElegidos(alternar(riesgosElegidos, r))}
                  >
                    <span className={`cat-punto cat-punto-${r}`} />
                    {NOMBRE_RIESGO[r]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="cat-panel-botones">
            <button type="button" className="cat-boton-limpiar" onClick={limpiar}>
              Limpiar
            </button>
            <button type="button" className="cat-boton-ver" onClick={() => setPanelAbierto(false)}>
              Ver {propiedadesFiltradas.length} {propiedadesFiltradas.length === 1 ? "remate" : "remates"}
            </button>
          </div>
        </div>
      )}

      <div className="properties-grid">
        {propiedadesVisibles.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {propiedadesFiltradas.length > POR_TANDA && (
        <div className="cat-mas">
          <p>
            Mostrando {propiedadesVisibles.length} de {propiedadesFiltradas.length} remates
          </p>
          {faltan > 0 && (
            <button
              type="button"
              className="cat-boton-mas"
              onClick={() => setTanda({ firma, cantidad: cantidadVisible + POR_TANDA })}
            >
              Mostrar {Math.min(faltan, POR_TANDA)} más
            </button>
          )}
        </div>
      )}

      {propiedadesFiltradas.length === 0 && (
        <p className="properties-empty">No se encontraron propiedades con esos filtros.</p>
      )}
    </div>
  );
}