"use client";

import { useState } from "react";
import type { PeriodPreset, PeriodSelection } from "@/lib/dashboard-period";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "todo", label: "Todo período" },
];

function IconCalendarSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function DashboardPeriodSelector({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftSince, setDraftSince] = useState("");
  const [draftUntil, setDraftUntil] = useState("");

  const activePreset = value.kind === "preset" ? value.preset : null;

  function applyCustomRange() {
    if (!draftSince || !draftUntil) return;
    onChange({ kind: "custom", since: draftSince, until: draftUntil });
    setPickerOpen(false);
  }

  return (
    <div className="dashboard-period-bar">
      <div className="leads-funnel-toggle" role="group" aria-label="Período do dashboard">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={activePreset === p.value ? "active" : ""}
            onClick={() => onChange({ kind: "preset", preset: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="dashboard-period-calendar">
        <button
          type="button"
          className={`dashboard-period-calendar-btn${value.kind === "custom" ? " active" : ""}`}
          aria-label="Escolher período personalizado"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
        >
          <IconCalendarSmall />
        </button>

        {pickerOpen && (
          <div className="dashboard-period-popover" aria-label="Período personalizado">
            <label>
              De
              <input type="date" value={draftSince} onChange={(e) => setDraftSince(e.target.value)} />
            </label>
            <label>
              Até
              <input type="date" value={draftUntil} onChange={(e) => setDraftUntil(e.target.value)} />
            </label>
            <button
              type="button"
              className="dashboard-period-popover-apply"
              onClick={applyCustomRange}
              disabled={!draftSince || !draftUntil}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
