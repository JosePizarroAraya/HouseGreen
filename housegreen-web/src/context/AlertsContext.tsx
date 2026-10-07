import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

// Paso 94: las notificaciones de la persona (remates nuevos que calzan con sus alertas).
// Antes eran datos de ejemplo guardados en el navegador; ahora vienen de la API (tabla alerts).
// Están en un contexto porque las usan dos lugares: el número rojo del encabezado y la página Alertas.

// Lo que devuelve GET /alertas por cada notificación
export interface Notificacion {
  id: string;
  property_id: string | null; // null si la propiedad ya no existe
  property_title: string | null;
  alert_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AlertsContextType {
  notificaciones: Notificacion[];
  noLeidas: number;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
  marcarLeida: (id: string) => void;
  marcarTodasLeidas: () => void;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { estaLogueado } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useCallback guarda la función entre un dibujo y otro: así los useEffect que la usan
  // solo se repiten cuando cambia la sesión, y no en cada dibujo.
  const recargar = useCallback(() => {
    if (!estaLogueado) {
      setNotificaciones([]);
      return;
    }
    setCargando(true);
    api
      .get("/alertas")
      .then((datos: Notificacion[]) => {
        setNotificaciones(datos);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setCargando(false));
  }, [estaLogueado]);

  // Se piden al iniciar sesión (y se vacían al cerrarla)
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Los datos de ejemplo que antes se guardaban en el navegador ya no se usan: se borran
  useEffect(() => {
    localStorage.removeItem("housegreen-alert-criterios");
    localStorage.removeItem("housegreen-alert-notificaciones");
  }, []);

  function marcarLeida(id: string) {
    const notificacion = notificaciones.find((n) => n.id === id);
    if (!notificacion || notificacion.is_read) return; // ya estaba leída: no hay nada que hacer

    // 1. Se marca de inmediato en la pantalla
    setNotificaciones((actuales) => actuales.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    // 2. Se avisa a la API. Si falla, se vuelven a pedir para mostrar lo que hay de verdad en la base.
    api.patch(`/alertas/${id}/leida`).catch(() => recargar());
  }

  function marcarTodasLeidas() {
    setNotificaciones((actuales) => actuales.map((n) => ({ ...n, is_read: true })));
    api.post("/alertas/leidas").catch(() => recargar());
  }

  const noLeidas = notificaciones.filter((n) => !n.is_read).length;

  return (
    <AlertsContext.Provider
      value={{ notificaciones, noLeidas, cargando, error, recargar, marcarLeida, marcarTodasLeidas }}
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