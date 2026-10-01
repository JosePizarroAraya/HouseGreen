import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { AlertCriteria, AlertNotification, RiskLevel } from "../types/property";
import { mockProperties } from "../data/mockProperties";

interface AlertsContextType {
  criterios: AlertCriteria[];
  notificaciones: AlertNotification[];
  agregarCriterio: (criterio: Omit<AlertCriteria, "id">) => void;
  eliminarCriterio: (id: string) => void;
  marcarLeida: (id: string) => void;
  noLeidas: number;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const CRITERIOS_KEY = "housegreen-alert-criterios";
const NOTIS_KEY = "housegreen-alert-notificaciones";

// Orden de severidad, para poder comparar "riesgo A es igual o menor que riesgo B"
const ORDEN_RIESGO: Record<RiskLevel, number> = { verde: 0, amarillo: 1, rojo: 2 };

// Revisa si una propiedad cumple con un criterio de alerta.
function propiedadCoincideConCriterio(
  property: (typeof mockProperties)[number],
  criterio: AlertCriteria
) {
  const coincideComuna =
    criterio.comuna === "" || property.comuna.toLowerCase() === criterio.comuna.toLowerCase();

  const coincideRiesgo =
    criterio.riesgoMaximo === "cualquiera" ||
    ORDEN_RIESGO[property.riesgo] <= ORDEN_RIESGO[criterio.riesgoMaximo];

  const coincidePrecio = criterio.precioMaximo === null || property.precio <= criterio.precioMaximo;

  return coincideComuna && coincideRiesgo && coincidePrecio;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [criterios, setCriterios] = useState<AlertCriteria[]>(() => {
    const guardado = localStorage.getItem(CRITERIOS_KEY);
    return guardado ? JSON.parse(guardado) : [];
  });

  const [notificaciones, setNotificaciones] = useState<AlertNotification[]>(() => {
    const guardado = localStorage.getItem(NOTIS_KEY);
    return guardado ? JSON.parse(guardado) : [];
  });

  useEffect(() => {
    localStorage.setItem(CRITERIOS_KEY, JSON.stringify(criterios));
  }, [criterios]);

  useEffect(() => {
    localStorage.setItem(NOTIS_KEY, JSON.stringify(notificaciones));
  }, [notificaciones]);

  function agregarCriterio(datos: Omit<AlertCriteria, "id">) {
    const nuevoCriterio: AlertCriteria = { ...datos, id: crypto.randomUUID() };
    setCriterios((actuales) => [...actuales, nuevoCriterio]);

    // Simulamos el "escaneo" de propiedades existentes contra este nuevo criterio,
    // igual que haría un proceso automático en el backend cuando llega una propiedad nueva.
    const coincidencias = mockProperties.filter((p) => propiedadCoincideConCriterio(p, nuevoCriterio));

    const nuevasNotis: AlertNotification[] = coincidencias.map((p) => ({
      id: crypto.randomUUID(),
      propertyId: p.id,
      criteriaId: nuevoCriterio.id,
      fecha: new Date().toISOString(),
      leida: false,
    }));

    setNotificaciones((actuales) => [...nuevasNotis, ...actuales]);
  }

  function eliminarCriterio(id: string) {
    setCriterios((actuales) => actuales.filter((c) => c.id !== id));
  }

  function marcarLeida(id: string) {
    setNotificaciones((actuales) =>
      actuales.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <AlertsContext.Provider
      value={{ criterios, notificaciones, agregarCriterio, eliminarCriterio, marcarLeida, noLeidas }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error("useAlerts debe usarse dentro de un <AlertsProvider>");
  }
  return context;
}