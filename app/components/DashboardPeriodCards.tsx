"use client";

import { useMemo, useState } from "react";
import { DashboardPeriodSelector } from "@/app/components/DashboardPeriodSelector";
import { DonutChart } from "@/app/components/DonutChart";
import {
  resolveRange,
  resolveVisitasRange,
  periodLabel,
  countLeadsInRange,
  countVisitasAgendadasInRange,
  breakdownByOrigem,
  breakdownByVendedor,
  type PeriodSelection,
} from "@/lib/dashboard-period";
import type { Origem } from "@/types/domain";

const ORIGEM_COLORS: Record<string, string> = {
  whatsapp: "#10B981",
  portal: "#005BFE",
  base_inativa: "#F59E0B",
  manual: "#8B5CF6",
  site: "#06B6D4",
};

const VENDEDOR_PALETTE = ["#005BFE", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#94A3B8"];

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
  const visitasRange = useMemo(() => resolveVisitasRange(selection), [selection]);
  const label = periodLabel(selection);
  const leadsCount = useMemo(() => countLeadsInRange(leads, range), [leads, range]);
  const visitasCount = useMemo(() => countVisitasAgendadasInRange(leads, visitasRange), [leads, visitasRange]);
  const origemBreakdown = useMemo(() => breakdownByOrigem(leads, range), [leads, range]);
  const vendedorBreakdown = useMemo(() => breakdownByVendedor(leads, sellers, range), [leads, sellers, range]);

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
        <div className="metric-card">
          <div className="metric-label">Visitas agendadas {label}</div>
          <div className="metric-value">{visitasCount}</div>
        </div>
      </div>

      <div className="dashboard-donut-grid">
        <div className="donut-card">
          <span className="donut-card-title">Leads por Origem</span>
          <DonutChart
            segments={origemBreakdown.map((e) => ({
              id: e.key,
              label: e.label,
              value: e.count,
              percent: e.percent,
              color: ORIGEM_COLORS[e.key] ?? "#94A3B8",
            }))}
          />
        </div>
        <div className="donut-card">
          <span className="donut-card-title">Leads por Vendedor</span>
          <DonutChart
            segments={vendedorBreakdown.map((e, i) => ({
              id: e.key,
              label: e.label,
              value: e.count,
              percent: e.percent,
              color: VENDEDOR_PALETTE[i % VENDEDOR_PALETTE.length],
            }))}
          />
        </div>
      </div>
    </div>
  );
}
