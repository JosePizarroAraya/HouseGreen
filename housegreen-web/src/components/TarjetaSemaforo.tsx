import "./TarjetaSemaforo.css";

// Paso 53: tarjeta del semáforo en el detalle de la propiedad.
// Muestra el resultado, el puntaje y por qué quedó así (veto o datos que faltan).

type Nivel = "verde" | "amarillo" | "rojo";

interface Evaluacion {
  result_level: Nivel;
  total_points: number | null;
  veto_applied: boolean;
  veto_reason: string | null;
  is_complete: boolean;
  evaluated_at: string;
}

const TEXTOS: Record<Nivel, { titulo: string; consejo: string }> = {
  verde: { titulo: "Riesgo bajo", consejo: "Excelente opción" },
  amarillo: { titulo: "Riesgo medio", consejo: "Complicado pero viable" },
  rojo: { titulo: "Riesgo alto", consejo: "Mejor dejarla pasar" },
};

// La base agrega "(Factor 3)" a sus mensajes; para la persona que lee no aporta, así que se quita
function sinFactor(texto: string) {
  return texto.replace(/\s*\(Factor \d\)/g, "").trim();
}

// La base guarda los datos que faltan en un solo texto:
// "Información incompleta: Sin comparables de mercado suficientes (Factor 1); Sin deuda de ... (Factor 2)"
// Esta función lo convierte en una lista: ["Sin comparables de mercado suficientes", "Sin deuda de ..."]
function datosQueFaltan(motivo: string | null): string[] {
  if (!motivo) return [];
  const sinPrefijo = motivo.includes(":") ? motivo.slice(motivo.indexOf(":") + 1) : motivo;
  return sinPrefijo
    .split(";")
    .map((parte) => sinFactor(parte))
    .filter((parte) => parte !== "");
}

export function TarjetaSemaforo({ evaluacion }: { evaluacion: Evaluacion | null }) {
  if (!evaluacion) {
    return (
      <section className="semaforo">
        <p className="semaforo-rotulo">Semáforo HouseGreen</p>
        <p className="semaforo-titulo">Sin evaluar</p>
        <p className="semaforo-nota">Esta propiedad todavía no tiene una evaluación de riesgo.</p>
      </section>
    );
  }

  const fecha = new Date(evaluacion.evaluated_at).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Caso 1: faltan datos, así que no hay puntaje. No se muestra como "mala opción", sino como "sin datos".
  if (!evaluacion.is_complete) {
    const faltantes = datosQueFaltan(evaluacion.veto_reason);
    return (
      <section className="semaforo">
        <div className="semaforo-arriba">
          <div className="semaforo-luces" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="semaforo-rotulo">Semáforo HouseGreen</p>
            <p className="semaforo-titulo">Faltan datos para evaluarla</p>
          </div>
        </div>
        <p className="semaforo-nota">
          Por ahora aparece en riesgo alto porque no tenemos toda la información, no porque sea una mala opción.
          Revisa estos puntos antes de ofertar:
        </p>
        {faltantes.length > 0 && (
          <ul className="semaforo-lista">
            {faltantes.map((dato) => (
              <li key={dato}>{dato}</li>
            ))}
          </ul>
        )}
        <p className="semaforo-pie">Revisada el {fecha}</p>
      </section>
    );
  }

  // Caso 2: evaluación completa, con puntaje de 0 a 10
  const nivel = evaluacion.result_level;
  const puntos = evaluacion.total_points ?? 0;
  return (
    <section className={`semaforo semaforo-${nivel}`}>
      <div className="semaforo-arriba">
        <div className="semaforo-luces" aria-hidden="true">
          <span className={nivel === "rojo" ? "is-encendida" : ""} />
          <span className={nivel === "amarillo" ? "is-encendida" : ""} />
          <span className={nivel === "verde" ? "is-encendida" : ""} />
        </div>
        <div className="semaforo-texto">
          <p className="semaforo-rotulo">Semáforo HouseGreen</p>
          <p className="semaforo-titulo">{TEXTOS[nivel].titulo}</p>
          <p className="semaforo-consejo">{TEXTOS[nivel].consejo}</p>
        </div>
        <p className="semaforo-puntos">
          <span className="semaforo-puntos-valor">
            <strong>{puntos}</strong>/10
          </span>
          <span className="semaforo-puntos-texto">puntos</span>
        </p>
      </div>

      {/* Barra de 10 casillas: se pintan tantas como puntos tiene */}
      <div className="semaforo-barra" role="img" aria-label={`${puntos} de 10 puntos`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < puntos ? "is-llena" : ""} />
        ))}
      </div>

      {evaluacion.veto_applied && evaluacion.veto_reason && (
        <p className="semaforo-veto">
          <strong>Veto:</strong> {sinFactor(evaluacion.veto_reason)} Por eso queda en riesgo alto aunque sume {puntos}{" "}
          puntos.
        </p>
      )}

      <p className="semaforo-pie">
        7 a 10 puntos: riesgo bajo · 4 a 6: riesgo medio · 0 a 3: riesgo alto. Evaluada el {fecha}.
      </p>
    </section>
  );
}