import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MarcoDeEntrada } from "../components/MarcoDeEntrada";
import { CampoDeEntrada } from "../components/CampoDeEntrada";
import "./LoginPage.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false); // el ojo: ver la contraseña mientras se escribe
  const [error, setError] = useState("");

  // Paso 78: segundo paso del inicio de sesión (solo para cuentas con verificación en dos pasos)
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");

  const { iniciarSesion, cargando } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Debes ingresar tu correo y contraseña.");
      return;
    }

    if (pideCodigo && codigo.trim() === "") {
      setError("Escribe el código de 6 dígitos de tu aplicación.");
      return;
    }

    try {
      const entro = await iniciarSesion(email, password, pideCodigo ? codigo : undefined);
      if (entro) {
        navigate("/");
      } else {
        // La contraseña está bien, pero la cuenta pide el código: se muestra el segundo paso
        setPideCodigo(true);
        setCodigo("");
      }
    } catch (err) {
      // Acá llega el mensaje real que mandó el backend, ej: "Correo o contraseña incorrectos"
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  function volverAlInicio() {
    setPideCodigo(false);
    setCodigo("");
    setError("");
  }

  // Paso 78: pantalla del código
  if (pideCodigo) {
    return (
      <MarcoDeEntrada>
        {/* key distinta a la del otro formulario: así React lo crea de nuevo y el cursor queda en el código */}
        <form key="codigo" className="login-form" onSubmit={handleSubmit}>
          <h1>Verificación en dos pasos</h1>
          <p className="login-subtitle">
            Abre tu aplicación de autenticación y escribe el código de 6 dígitos de HouseGreen.
          </p>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <div className="login-grupo">
            <label className="login-label" htmlFor="codigo-de-dos-pasos">
              Código
            </label>
            <div className="login-campo">
              <input
                id="codigo-de-dos-pasos"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                value={codigo}
                // Solo números y espacio (la aplicación lo muestra como "123 456")
                onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ""))}
                className="login-input login-codigo"
                placeholder="123 456"
              />
            </div>
          </div>

          <button type="submit" className="login-button" disabled={cargando}>
            {cargando ? "Verificando..." : "Verificar"}
          </button>

          <p className="login-switch">
            <button type="button" className="login-volver" onClick={volverAlInicio}>
              Volver a escribir mi correo y contraseña
            </button>
          </p>
        </form>
      </MarcoDeEntrada>
    );
  }

  return (
    <MarcoDeEntrada>
      <form key="acceso" className="login-form" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="login-subtitle">Entra para ver los remates y su semáforo.</p>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <CampoDeEntrada
          etiqueta="Correo electrónico"
          icono="correo"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
        />

        <CampoDeEntrada
          etiqueta="Contraseña"
          icono="candado"
          type={mostrar ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          visible={mostrar}
          alCambiarVisible={() => setMostrar(!mostrar)}
        />

        <button type="submit" className="login-button" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="login-switch">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>

        <p className="login-nota">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
            <path d="m9 12 2.2 2.2L15 10.5" />
          </svg>
          Puedes proteger tu cuenta con verificación en dos pasos desde tu Perfil.
        </p>
      </form>
    </MarcoDeEntrada>
  );
}