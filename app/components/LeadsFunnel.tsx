"use client";

import { useRouter, usePathname } from "next/navigation";
import { calculateFunnelConversion, type FunnelCounts, type FunnelStage } from "@/lib/lead-funnel";
import { useState } from "react";

const STAGES: { key: FunnelStage; label: string; color: string }[] = [
  { key: "frio",   label: "Frio",   color: "var(--funnel-frio)" },
  { key: "morno",  label: "Morno",  color: "var(--funnel-morno)" },
  { key: "quente", label: "Quente", color: "var(--funnel-quente)" },
];

// Geometria fixa do funil 3D em coordenadas de viewBox — o overlay HTML
// (labels/valores/badge de conversão) usa os mesmos números em % pra ficar
// alinhado com as formas SVG, então width/height do wrapper têm
// aspect-ratio travado em VB_W/VB_H (ver CSS .leads-funnel-svg-wrap).
const VB_W = 320;
const VB_H = 232;
const CX = VB_W / 2;
const STAGE_H = 58;
const MIN_TOP_W = 74;
const MAX_TOP_W = 264;
const ELLIPSE_RY = 9;
const BULGE = -12;

const STAGE_Y: Record<FunnelStage, { y0: number; y1: number }> = {
  frio:   { y0: 8,   y1: 8 + STAGE_H },
  morno:  { y0: 86,  y1: 86 + STAGE_H },
  quente: { y0: 164, y1: 164 + STAGE_H },
};
const GAP_Y = { frioToMorno: 77, mornoToQuente: 155 };

function topWidth(count: number, max: number): number {
  if (max <= 0) return MIN_TOP_W;
  return MIN_TOP_W + (MAX_TOP_W - MIN_TOP_W) * (count / max);
}

function frustumPath(y0: number, y1: number, tw: number, bw: number): string {
  const txL = CX - tw / 2, txR = CX + tw / 2;
  const bxL = CX - bw / 2, bxR = CX + bw / 2;
  const midY1 = y0 + (y1 - y0) * 0.35;
  const midY2 = y0 + (y1 - y0) * 0.65;
  return [
    `M ${txL} ${y0}`,
    `A ${tw / 2} ${ELLIPSE_RY} 0 0 1 ${txR} ${y0}`,
    `C ${txR + BULGE} ${midY1}, ${bxR + BULGE} ${midY2}, ${bxR} ${y1}`,
    `A ${bw / 2} ${ELLIPSE_RY} 0 0 1 ${bxL} ${y1}`,
    `C ${bxL - BULGE} ${midY2}, ${txL - BULGE} ${midY1}, ${txL} ${y0}`,
    "Z",
  ].join(" ");
}

function pct(vbValue: number, axis: "x" | "y"): string {
  return `${(vbValue / (axis === "x" ? VB_W : VB_H)) * 100}%`;
}

function formatConversion(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

type Props = {
  filtered: FunnelCounts;
  total: FunnelCounts;
  filteredLabel?: string;
  totalLabel?: string;
  /** Habilita clique-pra-filtrar o kanban abaixo via ?stage=. Default false
   *  (usado por /inicio, que não tem kanban pra filtrar). */
  enableStageFilter?: boolean;
  /** Camada ativa como filtro no momento (lida da URL pelo caller). */
  activeStage?: FunnelStage | null;
  /** Demais query params atuais da página (exceto "stage"), pra preservar
   *  ao alternar o filtro de camada — ex: { assignedTo: "x", atrasado: "1" }.
   *  Passado pelo Server Component caller; evita useSearchParams() aqui
   *  (exigiria Suspense boundary em volta em toda página que usa o componente). */
  currentParams?: Record<string, string>;
};

export function LeadsFunnel({
  filtered,
  total,
  filteredLabel = "Filtrado",
  totalLabel = "Total",
  enableStageFilter = false,
  activeStage = null,
  currentParams,
}: Props) {
  const [showTotal, setShowTotal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const counts = showTotal ? total : filtered;
  const max = Math.max(counts.frio, counts.morno, counts.quente);
  const closedOrLost = counts.fechado + counts.perdido;
  const conversion = calculateFunnelConversion(counts);

  const widths: Record<FunnelStage, number> = {
    frio: topWidth(counts.frio, max),
    morno: topWidth(counts.morno, max),
    quente: topWidth(counts.quente, max),
  };
  const bottomWidths: Record<FunnelStage, number> = {
    frio: widths.morno,
    morno: widths.quente,
    quente: widths.quente * 0.55,
  };

  function stageHref(stage: FunnelStage): string {
    const params = new URLSearchParams(currentParams);
    if (activeStage !== stage) {
      params.set("stage", stage);
    }
    // stage já ativo → toggle off: currentParams (passado pelo caller) já
    // vem sem "stage", então só não setar de novo é suficiente pra remover.
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onStageClick(stage: FunnelStage) {
    if (!enableStageFilter) return;
    router.push(stageHref(stage));
  }

  return (
    <div className="leads-funnel">
      <div className="leads-funnel-head">
        <span className="section-card-title">Funil de Temperatura</span>
        <div className="leads-funnel-toggle" role="group" aria-label="Escopo do funil">
          <button type="button" className={!showTotal ? "active" : ""} onClick={() => setShowTotal(false)}>
            {filteredLabel}
          </button>
          <button type="button" className={showTotal ? "active" : ""} onClick={() => setShowTotal(true)}>
            {totalLabel}
          </button>
        </div>
      </div>

      <div className="leads-funnel-svg-wrap">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="leads-funnel-svg" aria-hidden="true">
          {STAGES.map(({ key, color }) => {
            const { y0, y1 } = STAGE_Y[key];
            const isActive = activeStage === key;
            return (
              <g
                key={key}
                className={`leads-funnel-shape-group${enableStageFilter ? " clickable" : ""}${isActive ? " active" : ""}`}
                onClick={() => onStageClick(key)}
              >
                <path
                  d={frustumPath(y0, y1, widths[key], bottomWidths[key])}
                  fill={color}
                  className="leads-funnel-shape"
                />
              </g>
            );
          })}
        </svg>

        {STAGES.map(({ key, label }) => {
          const { y0, y1 } = STAGE_Y[key];
          const centerY = y0 + (y1 - y0) / 2;
          return (
            <div
              key={key}
              className="leads-funnel-stage-overlay"
              style={{ top: pct(centerY, "y") }}
            >
              <span className="leads-funnel-stage-label">{label}</span>
              <span className="leads-funnel-stage-value">{counts[key]}</span>
            </div>
          );
        })}

        <div className="leads-funnel-conversion" style={{ top: pct(GAP_Y.frioToMorno, "y") }}>
          {formatConversion(conversion.frioToMorno)}
        </div>
        <div className="leads-funnel-conversion" style={{ top: pct(GAP_Y.mornoToQuente, "y") }}>
          {formatConversion(conversion.mornoToQuente)}
        </div>
      </div>

      <p className="leads-funnel-closed-chip">
        {closedOrLost} {closedOrLost === 1 ? "lead fechado/perdido" : "leads fechados/perdidos"} · fora do funil
      </p>
    </div>
  );
}
