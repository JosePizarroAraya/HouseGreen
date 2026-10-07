import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fechaCorta } from "../../utils/opiniones";
import "./AdminUsuariosPage.css";

// Paso 85: el administrador ve quiénes están registrados y cuánto usan la aplicación.

// Lo que devuelve GET /admin/usuarios por cada persona
interface UsuarioAdmin {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_name: string | null;
  is_active: boolean;
  two_fa_enabled: boolean;
  created_at: string | null;
  vistas: number;
  guardados: number;
  opiniones: number;
  ultima_actividad: string | null;
}

type Orden = "recientes" | "actividad" | "vistas" | "nombre";

const ROLES: { valor: string; nombre: string; plural: string }[] = [
  { valor: "inversionista", nombre: "Inversionista", plural: "Inversionistas" },
  { valor: "analista", nombre: "Analista", plural: "Analistas" },
  { valor: "administrador", nombre: "Administrador", plural: "Administradores" },
];

const POR_TANDA = 20; // cuántas personas se muestran de una vez

// "Irarrázaval" -> "irarrazaval": la búsqueda no distingue tildes ni mayúsculas
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Fecha en milisegundos; sin fecha vale 0 para que quede al final al ordenar
function tiempo(fechaIso: string | null) {
  return fechaIso ? new Date(fechaIso).getTime() : 0;
}

export function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState(""); // vacío = todos
  const [orden, setOrden] = useState<Orden>("recientes");
  const [tanda, setTanda] = useState(POR_TANDA);

  useEffect(() => {
    api
      .get("/admin/usuarios")
      .then((datos: UsuarioAdmin[]) => setUsuarios(datos))
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setCargando(false));
  }, []);

  const texto = normalizar(busqueda.trim());
  const filtrados = usuarios
    .filter(
      (u) =>
        (rol === "" || u.role_name === rol) &&
        (texto === "" || normalizar(u.full_name).includes(texto) || normalizar(u.email).includes(texto))
    )
    // filter() ya creó una lista nueva, así que sort() no desordena los datos originales
    .sort((a, b) => {
      if (orden === "actividad") return tiempo(b.ultima_actividad) - tiempo(a.ultima_actividad);
      if (orden === "vistas") return b.vistas - a.vistas;
      if (orden === "nombre") return a.full_name.localeCompare(b.full_name, "es");
      return tiempo(b.created_at) - tiempo(a.created_at); // más recientes primero
    });
  const visibles = filtrados.slice(0, tanda);

  function cambiarFiltro(cambio: () => void) {
    cambio();
    setTanda(POR_TANDA);
  }

  return (
    <section>
      <Link to="/admin" className="usu-volver">
        ‹ Volver al Panel
      </Link>
      <h1 className="admin-titulo">Usuarios</h1>
      <p className="admin-subtitulo">
        {cargando
          ? "Cargando..."
          : usuarios.length === 1
            ? "1 persona registrada"
            : `${usuarios.length} personas registradas`}
      </p>

      {error && <p className="usu-error">No se pudieron cargar los usuarios: {error}</p>}

      {!cargando && !error && (
        <>
          <div className="usu-filtros">
            <label className="usu-buscar">
              Buscar
              <input
                type="search"
                placeholder="Nombre o correo"
                value={busqueda}
                onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))}
              />
            </label>
            <label>
              Tipo de cuenta
              <select value={rol} onChange={(e) => cambiarFiltro(() => setRol(e.target.value))}>
                <option value="">Todos</option>
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.plural}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar por
              <select value={orden} onChange={(e) => cambiarFiltro(() => setOrden(e.target.value as Orden))}>
                <option value="recientes">Registro más reciente</option>
                <option value="actividad">Última actividad</option>
                <option value="vistas">Más vistas</option>
                <option value="nombre">Nombre (A–Z)</option>
              </select>
            </label>
          </div>

          <p className="usu-cuenta">
            {filtrados.length === usuarios.length
              ? `Mostrando ${visibles.length} de ${usuarios.length}`
              : `${filtrados.length} de ${usuarios.length} coinciden con los filtros`}
          </p>

          {filtrados.length === 0 && <div className="usu-vacio">Nadie coincide con esos filtros.</div>}

          <ul className="usu-lista">
            {visibles.map((u) => (
              <li key={u.id} className="usu-item">
                <div className="usu-cabecera">
                  <div className="usu-persona">
                    <h2>{u.full_name}</h2>
                    <p>
                      {u.email}
                      {u.phone && ` · ${u.phone}`}
                    </p>
                  </div>
                  <div className="usu-etiquetas">
                    <span className="usu-etiqueta">
                      {ROLES.find((r) => r.valor === u.role_name)?.nombre ?? "Sin tipo"}
                    </span>
                    {u.two_fa_enabled && <span className="usu-etiqueta is-dos-pasos">Dos pasos</span>}
                    {!u.is_active && <span className="usu-etiqueta is-deshabilitada">Deshabilitada</span>}
                  </div>
                </div>

                <dl className="usu-cifras">
                  <div>
                    <dt>Vistas</dt>
                    <dd>{u.vistas.toLocaleString("es-CL")}</dd>
                  </div>
                  <div>
                    <dt>Guardados</dt>
                    <dd>{u.guardados.toLocaleString("es-CL")}</dd>
                  </div>
                  <div>
                    <dt>Opiniones</dt>
                    <dd>{u.opiniones.toLocaleString("es-CL")}</dd>
                  </div>
                </dl>

                <p className="usu-fechas">
                  {u.created_at ? `Se registró el ${fechaCorta(u.created_at)}` : "Sin fecha de registro"} ·{" "}
                  {u.ultima_actividad ? `Última actividad: ${fechaCorta(u.ultima_actividad)}` : "Sin actividad todavía"}
                </p>
              </li>
            ))}
          </ul>

          {filtrados.length > visibles.length && (
            <div className="usu-mas">
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