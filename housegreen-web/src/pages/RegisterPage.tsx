import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { problemaDeContrasena, REGLA_CONTRASENA } from "../utils/contrasena";
import { MarcoDeEntrada } from "../components/MarcoDeEntrada";
import "./LoginPage.css"; // reutilizamos los mismos estilos del login

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mostrar, setMostrar] = useState(false); // paso 75: ver la contraseña mientras se escribe
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName || !email || !password) {
      setError("Nombre, correo y contraseña son obligatorios.");
      return;
    }

    // Paso 75: las mismas reglas de contraseña que el Perfil y la API (src/utils/contrasena.ts)
    const problema = problemaDeContrasena(password);
    if (problema) {
      setError(problema);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      // 1. Crea el usuario en el backend (POST /auth/registro)
      await api.post("/auth/registro", {
        full_name: fullName,
        email,
        phone: phone || null,
        password,
      });

      // 2. Apenas se crea, lo logueamos automáticamente para que no
      // tenga que volver a escribir sus datos en la pantalla de login.
      await iniciarSesion(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la cuenta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <MarcoDeEntrada>
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Crear cuenta</h1>
        <p className="login-subtitle">Regístrate para ver los remates y guardar tus favoritos.</p>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <label className="login-label">
          Nombre completo
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="login-input"
            placeholder="Tu nombre completo"
          />
        </label>

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
          Teléfono (opcional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="login-input"
            placeholder="+56 9 1234 5678"
          />
        </label>

        <label className="login-label">
          Contraseña
          <input
            type={mostrar ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
          <span className="login-ayuda">{REGLA_CONTRASENA}</span>
        </label>

        <label className="login-label">
          Confirmar contraseña
          <input
            type={mostrar ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="login-input"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>

        <label className="login-mostrar">
          <input type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
          Mostrar las contraseñas
        </label>

        <button type="submit" className="login-button" disabled={guardando}>
          {guardando ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="login-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </MarcoDeEntrada>
  );
}