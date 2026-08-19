"use client";

import { useState } from "react";
import type { FunnelCounts, FunnelStage } from "@/lib/lead-funnel";

const STAGES: { key: FunnelStage; label: string; color: string }[] = [
  { key: "frio",   label: "Frio",   color: "var(--funnel-frio)" },
  { key: "morno",  label: "Morno",  color: "var(--funnel-morno)" },
  { key: "quente", label: "Quente", color: "var(--funnel-quente)" },
];

type Props = {
  filtered: FunnelCounts;
  total: FunnelCounts;
  filteredLabel?: string;
  totalLabel?: string;
};

export function LeadsFunnel({ filtered, total, filteredLabel = "Filtrado", totalLabel = "Total" }: Props) {
  const [showTotal, setShowTotal] = useState(false);
  const counts = showTotal ? total : filtered;
  const max = Math.max(1, counts.frio, counts.morno, counts.quente);
  const closedOrLost = counts.fechado + counts.perdido;

  return (
    <div className="leads-funnel">
      <div className="leads-funnel-head">
        <span className="section-card-title">Funil de Temperatura</span>
        <div className="leads-funnel-toggle" role="group" aria-label="Escopo do funil">
          <button
            type="button"
            className={!showTotal ? "active" : ""}
            onClick={() => setShowTotal(false)}
          >
            {filteredLabel}
          </button>
          <button
            type="button"
            className={showTotal ? "active" : ""}
            onClick={() => setShowTotal(true)}
          >
            {totalLabel}
          </button>
        </div>
      </div>

      <div className="leads-funnel-bars">
        {STAGES.map(({ key, label, color }) => {
          const value = counts[key];
          const scale = value === 0 ? 0 : Math.max(0.14, value / max);
          return (
            <div key={key} className="leads-funnel-stage">
              <div className="leads-funnel-stage-head">
                <span className="leads-funnel-stage-label">{label}</span>
                <span className="leads-funnel-stage-value">{value}</span>
              </div>
              <div className="leads-funnel-track">
                <div
                  className="leads-funnel-fill"
                  style={{ transform: `scaleX(${scale})`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="leads-funnel-closed-chip">
        {closedOrLost} {closedOrLost === 1 ? "lead fechado/perdido" : "leads fechados/perdidos"} · fora do funil
      </p>
    </div>
  );
}
