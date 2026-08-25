"use client";

import { useMemo, useState } from "react";
import { DashboardPeriodSelector } from "@/app/components/DashboardPeriodSelector";
import { resolveRange, periodLabel, countLeadsInRange, type PeriodSelection } from "@/lib/dashboard-period";
import type { Origem } from "@/types/domain";

export type DashboardLead = {
  id: string;
  created_at: string | null;
  origem: Origem;
  assigned_to: string | null;
  agendamento_data?: string | null;
};

export function DashboardPeriodCards({
  leads,
  sellers,
}: {
  leads: DashboardLead[];
  sellers: { id: string; nome: string }[];
}) {
  const [selection, setSelection] = useState<PeriodSelection>({ kind: "preset", preset: "hoje" });
  const range = useMemo(() => resolveRange(selection), [selection]);
  const label = periodLabel(selection);
  const leadsCount = useMemo(() => countLeadsInRange(leads, range), [leads, range]);

  return (
    <div className="section-card">
      <div className="section-card-head">
        <span className="section-card-title">Painel por Período</span>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <DashboardPeriodSelector value={selection} onChange={setSelection} />
      </div>

      <div className="metrics-grid" style={{ margin: "0 16px 16px" }}>
        <div className="metric-card">
          <div className="metric-label">Leads {label}</div>
          <div className="metric-value">{leadsCount}</div>
        </div>
      </div>
    </div>
  );
}
