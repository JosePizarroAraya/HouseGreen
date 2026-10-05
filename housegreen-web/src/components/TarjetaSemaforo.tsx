import "./TarjetaSemaforo.css";

// Tarjeta del semáforo en el detalle de la propiedad (paso 53).
// Paso 63: reglas versión 2. Son 4 factores de 0 a 2 puntos, así que el máximo es 8.
// Paso 65: se explica el puntaje: cuánto aportó cada factor y qué le falta para subir de zona.

type Nivel = "verde" | "amarillo" | "rojo";

interface Detalle {
  criteria_name: string;
  points: number;
  has_data: boolean;
}

interface Evaluacion {
  result_level: Nivel;
  total_points: number | null;
  veto_applied: boolean;
  veto_reason: string | null;
  is_complete: boolean;
  missing_data: string | null;
  evaluated_at: string;
  details?: Detalle[];
}

const PUNTAJE_MAXIMO = 8;
const PUNTOS_PARA_VERDE = 6;
const PUNTOS_PARA_AMARILLO = 3;

const TEXTOS: Record<Nivel, { titulo: string; consejo: string }> = {
  verde: { titulo: "Riesgo bajo", consejo: "Excelente opción" },
  amarillo: { titulo: "Riesgo medio", consejo: "Complicado pero viable" },
  rojo: { titulo: "Riesgo alto", consejo: "Mejor dejarla pasar" },
};

// Cómo se muestra cada factor: su nombre, el texto según sus puntos (0, 1 o 2) y el texto cuando no tiene dato
const FACTORES: Record<string, { nombre: string; porPuntos: [string, string, string]; sinDato: string }> = {
  precio_rentabilidad: {
    nombre: "Precio y rentabilidad",
    porPuntos: ["Poco conveniente", "Regular", "Bueno"],
    sinDato: "Sin revisar",
  },
  estado_legal: {
    nombre: "Estado legal",
    porPuntos: ["Sin dominio", "Otro tipo de dominio", "Dominio exclusivo"],
    sinDato: "Dominio no especificado",
  },
  dinamismo_barrio: {
    nombre: "Dinamismo del barrio",
    porPuntos: ["Bajo", "Medio", "Alto"],
    sinDato: "Sin dato",
  },
  seguridad_comuna: {
    nombre: "Seguridad de la comuna",
    porPuntos: ["Baja", "Media", "Alta"],
    sinDato: "Sin dato",
  },
};

// La base guarda los datos que faltan en un solo texto:
// "Precio sin revisar por el administrador; Dominio no especificado"
// Esta función lo convierte en una lista: ["Precio sin revisar por el administrador", "Dominio no especificado"]
function datosPendientes(texto: string | null | undefined): string[] {
  if (!texto) return [];
  return texto
    .split(";")
    .map((parte) => parte.trim())
    .filter((parte) => parte !== "");
}

// "1 punto", "2 puntos"
function enPuntos(cantidad: number) {
  return cantidad === 1 ? "1 punto" : `${cantidad} puntos`;
}

// Paso 65: frase que explica qué le falta a la propiedad para subir de zona
function fraseDeLoQueFalta(nivel: Nivel, puntos: number, tieneVeto: boolean, sinDato: string[]): string {
  const partes: string[] = [];

  if (!tieneVeto) {
    if (nivel === "verde") {
      partes.push(`Está en riesgo bajo porque suma ${PUNTOS_PARA_VERDE} puntos o más.`);
    } else if (nivel === "amarillo") {
      const faltan = PUNTOS_PARA_VERDE - puntos;
      partes.push(`${faltan === 1 ? "Le falta" : "Le faltan"} ${enPuntos(faltan)} para riesgo bajo.`);
    } else {
      const faltan = PUNTOS_PARA_AMARILLO - puntos;
      partes.push(`${faltan === 1 ? "Le falta" : "Le faltan"} ${enPuntos(faltan)} para riesgo medio.`);
    }
  }

  if (sinDato.length === 1) {
    partes.push(`Todavía no tiene dato en ${sinDato[0]}: cuando se complete puede sumar hasta 2 puntos.`);
  } else if (sinDato.length > 1) {
    const ultimo = sinDato[sinDato.length - 1];
    const lista = `${sinDato.slice(0, -1).join(", ")} y ${ultimo}`;
    partes.push(`Todavía no tiene dato en ${lista}: cuando se completen pueden sumar hasta ${sinDato.length * 2} puntos.`);
  }

  return partes.join(" ");
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

  const nivel = evaluacion.result_level;
  const puntos = evaluacion.total_points ?? 0;
  const pendientes = datosPendientes(evaluacion.missing_data);
  const tieneVeto = evaluacion.veto_applied && Boolean(evaluacion.veto_reason);

  // Paso 65: solo los factores que la web conoce (las evaluaciones antiguas traían otros)
  const factores = (evaluacion.details ?? []).filter((detalle) => detalle.criteria_name in FACTORES);
  const nombresSinDato = factores
    .filter((detalle) => !detalle.has_data)
    .map((detalle) => FACTORES[detalle.criteria_name].nombre.toLowerCase());
  const explicacion = fraseDeLoQueFalta(nivel, puntos, tieneVeto, nombresSinDato);

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
          {/* El consejo solo se da cuando se revisaron los 4 factores */}
          <p className="semaforo-consejo">{pendientes.length === 0 ? TEXTOS[nivel].consejo : "Evaluación parcial"}</p>
        </div>
        <p className="semaforo-puntos">
          <span className="semaforo-puntos-valor">
            <strong>{puntos}</strong>/{PUNTAJE_MAXIMO}
          </span>
          <span className="semaforo-puntos-texto">puntos</span>
        </p>
      </div>

      {/* Barra de 8 casillas: se pintan tantas como puntos tiene */}
      <div className="semaforo-barra" role="img" aria-label={`${puntos} de ${PUNTAJE_MAXIMO} puntos`}>
        {Array.from({ length: PUNTAJE_MAXIMO }, (_, i) => (
          <span key={i} className={i < puntos ? "is-llena" : ""} />
        ))}
      </div>

      {tieneVeto && (
        <p className="semaforo-veto">
          <strong>Veto:</strong> {evaluacion.veto_reason} Por eso queda en riesgo alto aunque sume {puntos} puntos.
        </p>
      )}

      {/* Paso 65: de dónde salen los puntos */}
      {factores.length > 0 && (
        <div className="semaforo-factores">
          <p className="semaforo-subtitulo">Por qué tiene este puntaje</p>
          <ul>
            {factores.map((detalle) => {
              const factor = FACTORES[detalle.criteria_name];
              const clase = detalle.has_data ? `is-p${detalle.points}` : "is-sin-dato";
              return (
                <li key={detalle.criteria_name} className={`semaforo-factor ${clase}`}>
                  <span className="semaforo-factor-punto" aria-hidden="true" />
                  <span className="semaforo-factor-nombre">{factor.nombre}</span>
                  <span className="semaforo-factor-texto">
                    {detalle.has_data ? factor.porPuntos[detalle.points] : factor.sinDato}
                  </span>
                  
                </li>
              );
            })}
          </ul>
          {explicacion && <p className="semaforo-explica">{explicacion}</p>}
        </div>
      )}

      {/* Si la API no entrega el detalle por factor, al menos se avisa qué datos faltan */}
      {factores.length === 0 && pendientes.length > 0 && (
        <div className="semaforo-pendiente">
          <p>
            <strong>Datos pendientes.</strong> Estos factores todavía no tienen dato y por ahora valen 0 puntos:
          </p>
          <ul>
            {pendientes.map((dato) => (
              <li key={dato}>{dato}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="semaforo-pie">
        6 a 8 puntos: riesgo bajo · 3 a 5: riesgo medio · 0 a 2: riesgo alto. Evaluada el {fecha}.
      </p>
    </section>
  );
}