import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import type { UsuarioActual } from "../context/AuthContext";
import { api } from "../api/client";
import { problemaDeContrasena, REGLA_CONTRASENA } from "../utils/contrasena";
import "./PerfilPage.css";

// Paso 74: Perfil. Cada persona ve y edita sus propios datos y cambia su contraseña.
// Paso 79: también activa o desactiva la verificación en dos pasos (2FA).

const NOMBRE_ROL: Record<string, string> = {
  inversionista: "Inversionista",
  analista: "Analista",
  administrador: "Administrador",
};

// Aviso que aparece debajo de cada formulario: verde si salió bien, rojo si hubo un problema
type Aviso = { tipo: "ok" | "error"; texto: string } | null;

function MensajeAviso({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p className={`perfil-aviso is-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
      {aviso.texto}
    </p>
  );
}

function MisDatos({ usuario }: { usuario: UsuarioActual }) {
  const { actualizarUsuario } = useAuth();
  const [nombre, setNombre] = useState(usuario.full_name);
  const [telefono, setTelefono] = useState(usuario.phone ?? "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  // El botón solo se activa si se cambió algo
  const hayCambios = nombre.trim() !== usuario.full_name || telefono.trim() !== (usuario.phone ?? "");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (nombre.trim() === "") {
      setAviso({ tipo: "error", texto: "El nombre no puede quedar vacío." });
      return;
    }

    setGuardando(true);
    try {
      // La API devuelve los datos ya guardados: con eso se actualiza la sesión
      const guardado: UsuarioActual = await api.patch("/auth/me", {
        full_name: nombre.trim(),
        phone: telefono.trim(),
      });
      actualizarUsuario(guardado);
      setNombre(guardado.full_name);
      setTelefono(guardado.phone ?? "");
      setAviso({ tipo: "ok", texto: "Datos guardados." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudieron guardar los datos." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="perfil-tarjeta" onSubmit={guardar}>
      <h2>Mis datos</h2>

      <label className="perfil-campo">
        Nombre completo
        <input
          type="text"
          value={nombre}
          maxLength={150}
          autoComplete="name"
          onChange={(e) => {
            setNombre(e.target.value);
            setAviso(null);
          }}
        />
      </label>

      <label className="perfil-campo">
        Teléfono (opcional)
        <input
          type="tel"
          value={telefono}
          maxLength={30}
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          onChange={(e) => {
            setTelefono(e.target.value);
            setAviso(null);
          }}
        />
      </label>

      <dl className="perfil-fijos">
        <div>
          <dt>Correo</dt>
          <dd>{usuario.email}</dd>
        </div>
        <div>
          <dt>Tipo de cuenta</dt>
          <dd>{NOMBRE_ROL[usuario.role_name ?? ""] ?? "Sin definir"}</dd>
        </div>
      </dl>
      <p className="perfil-nota">El correo es con el que inicias sesión y no se puede cambiar desde aquí.</p>

      <MensajeAviso aviso={aviso} />

      <button type="submit" className="perfil-boton" disabled={!hayCambios || guardando}>
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const tipoDeCampo = mostrar ? "text" : "password";

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    // Se revisa lo mismo que la API, para avisar sin esperar la respuesta
    let problema: string | null = null;
    if (!actual || !nueva || !repetida) problema = "Completa los tres campos.";
    else if (problemaDeContrasena(nueva)) problema = problemaDeContrasena(nueva);
    else if (nueva !== repetida) problema = "La contraseña nueva y su repetición no coinciden.";
    else if (nueva === actual) problema = "La contraseña nueva debe ser distinta de la actual.";

    if (problema) {
      setAviso({ tipo: "error", texto: problema });
      return;
    }

    setGuardando(true);
    try {
      await api.post("/auth/me/contrasena", { current_password: actual, new_password: nueva });
      setActual("");
      setNueva("");
      setRepetida("");
      setAviso({ tipo: "ok", texto: "Contraseña actualizada. La próxima vez que inicies sesión usa la nueva." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo cambiar la contraseña." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="perfil-tarjeta" onSubmit={cambiar}>
      <h2>Cambiar contraseña</h2>

      <label className="perfil-campo">
        Contraseña actual
        <input
          type={tipoDeCampo}
          value={actual}
          autoComplete="current-password"
          onChange={(e) => setActual(e.target.value)}
        />
      </label>

      <label className="perfil-campo">
        Contraseña nueva
        <input
          type={tipoDeCampo}
          value={nueva}
          autoComplete="new-password"
          onChange={(e) => setNueva(e.target.value)}
        />
        <span className="perfil-ayuda">{REGLA_CONTRASENA}</span>
      </label>

      <label className="perfil-campo">
        Repite la contraseña nueva
        <input
          type={tipoDeCampo}
          value={repetida}
          autoComplete="new-password"
          onChange={(e) => setRepetida(e.target.value)}
        />
      </label>

      <label className="perfil-mostrar">
        <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
        Mostrar las contraseñas
      </label>

      <MensajeAviso aviso={aviso} />

      <button type="submit" className="perfil-boton" disabled={guardando}>
        {guardando ? "Cambiando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}

// Lo que responde POST /auth/2fa/iniciar
interface ClaveDeDosPasos {
  secret: string; // la clave, para escribirla a mano si no se puede escanear
  otpauth_url: string; // el enlace que se dibuja como código QR
}

// El código de la aplicación: solo números y espacio ("123 456")
function soloCodigo(texto: string) {
  return texto.replace(/[^\d ]/g, "");
}

// Paso 79: verificación en dos pasos
function DosPasos({ usuario }: { usuario: UsuarioActual }) {
  const { actualizarUsuario } = useAuth();
  const [clave, setClave] = useState<ClaveDeDosPasos | null>(null); // con valor = se está activando
  const [codigo, setCodigo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  function mostrarError(err: unknown, respaldo: string) {
    setAviso({ tipo: "error", texto: err instanceof Error ? err.message : respaldo });
  }

  // 1. Pide una clave nueva a la API y muestra el código QR
  async function empezar() {
    setAviso(null);
    setTrabajando(true);
    try {
      const nueva: ClaveDeDosPasos = await api.post("/auth/2fa/iniciar");
      setClave(nueva);
      setCodigo("");
    } catch (err) {
      mostrarError(err, "No se pudo iniciar la activación.");
    } finally {
      setTrabajando(false);
    }
  }

  // 2. Con un código de la aplicación queda activada
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (codigo.trim() === "") {
      setAviso({ tipo: "error", texto: "Escribe el código de 6 dígitos de tu aplicación." });
      return;
    }
    setTrabajando(true);
    try {
      const guardado: UsuarioActual = await api.post("/auth/2fa/confirmar", { code: codigo });
      actualizarUsuario(guardado);
      setClave(null);
      setCodigo("");
      setAviso({ tipo: "ok", texto: "Verificación en dos pasos activada. Desde ahora te pediremos un código al iniciar sesión." });
    } catch (err) {
      mostrarError(err, "No se pudo activar.");
    } finally {
      setTrabajando(false);
    }
  }

  function cancelar() {
    setClave(null);
    setCodigo("");
    setAviso(null);
  }

  // 3. Desactivar pide la contraseña y un código
  async function desactivar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (contrasena === "" || codigo.trim() === "") {
      setAviso({ tipo: "error", texto: "Escribe tu contraseña y el código de tu aplicación." });
      return;
    }
    setTrabajando(true);
    try {
      const guardado: UsuarioActual = await api.post("/auth/2fa/desactivar", { password: contrasena, code: codigo });
      actualizarUsuario(guardado);
      setContrasena("");
      setCodigo("");
      setAviso({ tipo: "ok", texto: "Verificación en dos pasos desactivada." });
    } catch (err) {
      mostrarError(err, "No se pudo desactivar.");
    } finally {
      setTrabajando(false);
    }
  }

  const titulo = (
    <div className="perfil-titulo-estado">
      <h2>Verificación en dos pasos</h2>
      <span className={`perfil-estado ${usuario.two_fa_enabled ? "is-activa" : ""}`}>
        {usuario.two_fa_enabled ? "Activada" : "Desactivada"}
      </span>
    </div>
  );

  // Paso 80: activada y obligatoria para su tipo de cuenta (administrador): no se puede desactivar
  if (usuario.two_fa_enabled && usuario.two_fa_required) {
    return (
      <div className="perfil-tarjeta">
        {titulo}
        <p className="perfil-texto">
          Al iniciar sesión te pedimos tu contraseña y un código de tu aplicación de autenticación. Tu tipo de
          cuenta la exige, así que no se puede desactivar.
        </p>
        <MensajeAviso aviso={aviso} />
      </div>
    );
  }

  // Ya está activada: se puede desactivar
  if (usuario.two_fa_enabled) {
    return (
      <form className="perfil-tarjeta" onSubmit={desactivar}>
        {titulo}
        <p className="perfil-texto">
          Al iniciar sesión te pedimos tu contraseña y un código de tu aplicación de autenticación. Para
          desactivarla, escribe los dos.
        </p>

        <label className="perfil-campo">
          Contraseña
          <input
            type="password"
            value={contrasena}
            autoComplete="current-password"
            onChange={(e) => setContrasena(e.target.value)}
          />
        </label>

        <label className="perfil-campo">
          Código de la aplicación
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123 456"
            value={codigo}
            onChange={(e) => setCodigo(soloCodigo(e.target.value))}
          />
        </label>

        <MensajeAviso aviso={aviso} />

        <button type="submit" className="perfil-boton is-peligro" disabled={trabajando}>
          {trabajando ? "Desactivando..." : "Desactivar"}
        </button>
      </form>
    );
  }

  // Se está activando: código QR y confirmación
  if (clave) {
    return (
      <form className="perfil-tarjeta" onSubmit={confirmar}>
        {titulo}
        <ol className="perfil-pasos">
          <li>Instala Google Authenticator o Microsoft Authenticator en tu teléfono.</li>
          <li>
            En la aplicación, agrega una cuenta y escanea este código:
            <div className="perfil-qr">
              <QRCodeSVG value={clave.otpauth_url} size={176} />
            </div>
            <span className="perfil-ayuda">
              ¿No puedes escanearlo? Elige "ingresar clave" en la aplicación y escribe:
            </span>
            {/* La clave en grupos de 4, para que sea más fácil copiarla */}
            <code className="perfil-clave">{clave.secret.match(/.{1,4}/g)?.join(" ")}</code>
          </li>
          <li>
            Escribe el código de 6 dígitos que muestra la aplicación:
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123 456"
              className="perfil-codigo"
              aria-label="Código de la aplicación"
              value={codigo}
              onChange={(e) => setCodigo(soloCodigo(e.target.value))}
            />
          </li>
        </ol>

        <MensajeAviso aviso={aviso} />

        <div className="perfil-botones">
          <button type="submit" className="perfil-boton" disabled={trabajando}>
            {trabajando ? "Confirmando..." : "Confirmar y activar"}
          </button>
          <button type="button" className="perfil-boton is-secundario" onClick={cancelar}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  // Desactivada
  return (
    <div className="perfil-tarjeta">
      {titulo}
      <p className="perfil-texto">
        Protege tu cuenta: además de la contraseña, al iniciar sesión te pediremos un código de 6 dígitos que
        genera una aplicación en tu teléfono.
      </p>
      {/* Paso 80: al administrador se le avisa que para él es obligatoria */}
      {usuario.two_fa_required && (
        <p className="perfil-obligatoria">
          Tu cuenta de administrador la exige: actívala para poder usar el panel de administración.
        </p>
      )}

      <MensajeAviso aviso={aviso} />

      <button type="button" className="perfil-boton" onClick={empezar} disabled={trabajando}>
        {trabajando ? "Preparando..." : "Activar"}
      </button>
    </div>
  );
}

export function PerfilPage() {
  const { usuario, cerrarSesion } = useAuth();

  // ProtectedRoute ya exige sesión, así que aquí siempre hay usuario
  if (!usuario) return null;

  return (
    <div className="perfil-page">
      <h1>Mi perfil</h1>
      <p className="perfil-subtitulo">Tus datos en HouseGreen y la contraseña de tu cuenta.</p>

      <MisDatos usuario={usuario} />
      <CambiarContrasena />
      <DosPasos usuario={usuario} />

      {/* En celular el botón "Cerrar sesión" no cabe en el encabezado: queda aquí */}
      <div className="perfil-salir">
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}