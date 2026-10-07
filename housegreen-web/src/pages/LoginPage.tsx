import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="login-page">
        {/* key distinta a la del otro formulario: así React lo crea de nuevo y el cursor queda en el código */}
        <form key="codigo" className="login-form" onSubmit={handleSubmit}>
          <h1>Verificación en dos pasos</h1>
          <p className="login-subtitle">
            Abre tu aplicación de autenticación y escribe el código de 6 dígitos de HouseGreen.
          </p>

          {error && <p className="login-error">{error}</p>}

          <label className="login-label">
            Código
            <input
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
          </label>

          <button type="submit" className="login-button" disabled={cargando}>
            {cargando ? "Verificando..." : "Verificar"}
          </button>

          <p className="login-switch">
            <button type="button" className="login-volver" onClick={volverAlInicio}>
              Volver a escribir mi correo y contraseña
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form key="acceso" className="login-form" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="login-subtitle">Accede a HouseGreen para ver propiedades en remate</p>

        {error && <p className="login-error">{error}</p>}

        <label className="login-label">
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            placeholder="tucorreo@ejemplo.com"
          />
        </label>

        <label className="login-label">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            placeholder="••••••••"
          />
        </label>

        <button type="submit" className="login-button" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="login-switch">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </form>
    </div>
  );
}