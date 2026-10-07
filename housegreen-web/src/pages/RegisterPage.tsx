import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { problemaDeContrasena, REGLA_CONTRASENA } from "../utils/contrasena";
import { MarcoDeEntrada } from "../components/MarcoDeEntrada";
import { CampoDeEntrada } from "../components/CampoDeEntrada";
import "./LoginPage.css"; // reutilizamos los mismos estilos del login

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mostrar, setMostrar] = useState(false); // el ojo: ver las contraseñas mientras se escriben
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

        <CampoDeEntrada
          etiqueta="Nombre completo"
          icono="persona"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Tu nombre completo"
        />

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
          etiqueta="Teléfono (opcional)"
          icono="telefono"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+56 9 1234 5678"
        />

        {/* Los dos ojos hacen lo mismo: muestran u ocultan las dos contraseñas a la vez */}
        <CampoDeEntrada
          etiqueta="Contraseña"
          icono="candado"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          ayuda={REGLA_CONTRASENA}
          visible={mostrar}
          alCambiarVisible={() => setMostrar(!mostrar)}
        />

        <CampoDeEntrada
          etiqueta="Confirmar contraseña"
          icono="candado"
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          visible={mostrar}
          alCambiarVisible={() => setMostrar(!mostrar)}
        />

        <button type="submit" className="login-button" disabled={guardando}>
          {guardando ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="login-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>

        <p className="login-nota">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
            <path d="m9 12 2.2 2.2L15 10.5" />
          </svg>
          Después podrás activar la verificación en dos pasos desde tu Perfil.
        </p>
      </form>
    </MarcoDeEntrada>
  );
}