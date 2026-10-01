import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { iniciarSesion, cargando } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Debes ingresar tu correo y contraseña.");
      return;
    }

    try {
      await iniciarSesion(email, password);
      navigate("/");
    } catch (err) {
      // Acá llega el mensaje real que mandó el backend, ej: "Correo o contraseña incorrectos"
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
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