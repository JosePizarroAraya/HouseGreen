import type { RiskLevel } from "../types/property";
import "./RiskBadge.css";

// Mapeamos cada nivel de riesgo a su texto y a una clase CSS.
// Así, si mañana quieren cambiar el color o el texto, solo se toca este objeto.
const RISK_INFO: Record<RiskLevel, { className: string; label: string }> = {
  verde: { className: "risk-verde", label: "Riesgo bajo" },
  amarillo: { className: "risk-amarillo", label: "Riesgo medio" },
  rojo: { className: "risk-rojo", label: "Riesgo alto" },
};

// "props" son los datos que le pasas al componente al usarlo: <RiskBadge riesgo="verde" />
interface RiskBadgeProps {
  riesgo: RiskLevel;
}

export function RiskBadge({ riesgo }: RiskBadgeProps) {
  const info = RISK_INFO[riesgo];

  return (
    <span className={`risk-badge ${info.className}`}>
      <span className="risk-dot" />
      {info.label}
    </span>
  );
}