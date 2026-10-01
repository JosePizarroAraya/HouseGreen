import type { Property, RiskLevel } from "../types/property";

type ZonaFactor = "verde" | "amarillo" | "rojo";

// --- Factores numéricos: se calculan con porcentajes ---

function zonaMargen(valorMercado: number, precio: number): ZonaFactor {
  const margen = (valorMercado - precio) / valorMercado;
  if (margen >= 0.4) return "verde";
  if (margen >= 0.15) return "amarillo";
  return "rojo";
}

function zonaDeuda(valorMercado: number, deuda: number): ZonaFactor {
  const porcentaje = deuda / valorMercado;
  if (porcentaje < 0.02) return "verde";
  if (porcentaje <= 0.15) return "amarillo";
  return "rojo";
}

function zonaReparacion(valorMercado: number, presupuesto: number): ZonaFactor {
  const porcentaje = presupuesto / valorMercado;
  if (porcentaje <= 0.1) return "verde";
  if (porcentaje <= 0.2) return "amarillo";
  return "rojo";
}

// --- Factores cualitativos: mapeo directo desde lo que elige el admin ---

function zonaOcupacion(estado: Property["estadoOcupacion"]): ZonaFactor {
  if (estado === "desocupada") return "verde";
  if (estado === "ocupada_originales") return "amarillo";
  return "rojo"; // ocupada_ilegal
}

function zonaLegal(estado: Property["estadoLegal"]): ZonaFactor {
  if (estado === "limpio") return "verde";
  if (estado === "embargos_multiples") return "amarillo";
  return "rojo"; // usufructo_herencia
}

function zonaBarrio(estado: Property["dinamismoBarrio"]): ZonaFactor {
  if (estado === "alta_demanda") return "verde";
  if (estado === "demanda_media") return "amarillo";
  return "rojo"; // inseguro_estancado
}

// Datos de entrada necesarios para calcular el riesgo (todo lo de Property menos id/riesgo/textos)
type DatosParaRiesgo = Pick<Property, 
"precio" | 
"valorMercado" | 
"deudaHeredada" | 
"presupuestoReparacion" | 
"estadoOcupacion" | 
"estadoLegal" | 
"dinamismoBarrio"
>;

// Regla de combinación: "un solo factor rojo hace toda la propiedad roja".
// Si no hay rojos pero hay al menos un amarillo, la propiedad es amarilla.
// Solo si los 6 factores son verdes, la propiedad es verde.
export function calcularRiesgo(datos: DatosParaRiesgo): RiskLevel {
  const zonas: ZonaFactor[] = [
    zonaMargen(datos.valorMercado, datos.precio),
    zonaDeuda(datos.valorMercado, datos.deudaHeredada),
    zonaReparacion(datos.valorMercado, datos.presupuestoReparacion),
    zonaOcupacion(datos.estadoOcupacion),
    zonaLegal(datos.estadoLegal),
    zonaBarrio(datos.dinamismoBarrio),
  ];

  if (zonas.includes("rojo")) return "rojo";
  if (zonas.includes("amarillo")) return "amarillo";
  return "verde";
}