export type RiskLevel = "verde" | "amarillo" | "rojo";

export type EstadoOcupacion = "desocupada" | "ocupada_originales" | "ocupada_ilegal";
export type EstadoLegal = "limpio" | "embargos_multiples" | "usufructo_herencia";
export type DinamismoBarrio = "alta_demanda" | "demanda_media" | "inseguro_estancado";

export interface Property {
  id: string;
  titulo: string;
  direccion: string;
  comuna: string;
  precio: number;
  tipoRemate: "judicial" | "contribuciones" | "banco";
  dormitorios: number;
  banos: number;
  metrosCuadrados: number;
  imagenUrl: string;
  descripcion: string;

  // Datos crudos para el motor de reglas (los llena el administrador)
  valorMercado: number;
  deudaHeredada: number;
  presupuestoReparacion: number;
  estadoOcupacion: EstadoOcupacion;
  estadoLegal: EstadoLegal;
  dinamismoBarrio: DinamismoBarrio;

  // Este campo YA NO se elige a mano: se calcula con calcularRiesgo() al guardar
  riesgo: RiskLevel;
}

export interface AlertCriteria {
  id: string;
  comuna: string;
  riesgoMaximo: RiskLevel | "cualquiera";
  precioMaximo: number | null;
}

export interface AlertNotification {
  id: string;
  propertyId: string;
  criteriaId: string;
  fecha: string;
  leida: boolean;
}