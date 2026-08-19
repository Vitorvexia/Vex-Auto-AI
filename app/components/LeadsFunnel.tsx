"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  calculateFunnelConversion,
  calculateStageBreakdown,
  type FunnelCounts,
  type FunnelStage,
} from "@/lib/lead-funnel";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/types/domain";

const STAGES: { key: FunnelStage; color: string }[] = [
  // Frio reaproveita o azul canônico do projeto (--accent, #005BFE) — não
  // é um tom de "frio" novo, é literalmente a cor de marca. Morno/Quente
  // não têm equivalente semântico entre os tokens existentes (ver DL-0018).
  { key: "frio",   color: "var(--accent)" },
  { key: "morno",  color: "var(--funnel-morno)" },
  { key: "quente", color: "var(--funnel-quente)" },
];

// Geometria fixa do funil 3D em coordenadas de viewBox — largo o
// suficiente (VB_W) pra caber a coluna de breakdown por etapa à direita
// das formas. O overlay HTML do número total usa os mesmos números em %
// (SHAPE_CX/VB_W), então aspect-ratio do wrapper fica travado em VB_W/VB_H.
const VB_W = 480;
const VB_H = 232;
const SHAPE_CX = 150;
const STAGE_H = 58;
const MIN_TOP_W = 74;
const MAX_TOP_W = 220;
const ELLIPSE_RY = 6;
// Construção da lateral: cada ponto de controle da bezier cúbica fica na
// MESMA coordenada x do seu ponto de âncora (topo ou base), só variando
// y — isso garante (por convexidade de Bézier) que x nunca ultrapassa o
// intervalo [base, topo], ou seja, a lateral só afunila, nunca alarga de
// novo no meio (era o bug do "vaso": pontos de controle deslocados pra
// um x médio comum criavam overshoot).
const TOP_BULGE = 4;
const BOTTOM_BULGE = 3;
const SIDE_EASE = 9;

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
  const txL = SHAPE_CX - tw / 2, txR = SHAPE_CX + tw / 2;
  const bxL = SHAPE_CX - bw / 2, bxR = SHAPE_CX + bw / 2;
  return [
    `M ${txL} ${y0}`,
    `C ${txL} ${y0 - TOP_BULGE} ${txR} ${y0 - TOP_BULGE} ${txR} ${y0}`,
    `C ${txR} ${y0 + SIDE_EASE} ${bxR} ${y1 - SIDE_EASE} ${bxR} ${y1}`,
    `C ${bxR} ${y1 + BOTTOM_BULGE} ${bxL} ${y1 + BOTTOM_BULGE} ${bxL} ${y1}`,
    `C ${bxL} ${y1 - SIDE_EASE} ${txL} ${y0 + SIDE_EASE} ${txL} ${y0}`,
    "Z",
  ].join(" ");
}

function pctX(vbValue: number): string {
  return `${(vbValue / VB_W) * 100}%`;
}
function pctY(vbValue: number): string {
  return `${(vbValue / VB_H) * 100}%`;
}

function formatConversion(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

type Props = {
  filtered: FunnelCounts;
  total: FunnelCounts;
  filteredStatusCounts: Partial<Record<LeadStatus, number>>;
  totalStatusCounts: Partial<Record<LeadStatus, number>>;
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
   *  (exigiria Suspense boundary em toda página que usa o componente). */
  currentParams?: Record<string, string>;
};

export function LeadsFunnel({
  filtered,
  total,
  filteredStatusCounts,
  totalStatusCounts,
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
  const statusCounts = showTotal ? totalStatusCounts : filteredStatusCounts;
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
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="leads-funnel-svg">
          {STAGES.map(({ key, color }) => {
            const { y0, y1 } = STAGE_Y[key];
            const isActive = activeStage === key;
            const tw = widths[key];
            const breakdown = calculateStageBreakdown(key, statusCounts);
            const originX = SHAPE_CX + tw / 2;
            const originY = y0 + 7;

            return (
              <g key={key}>
                <g
                  className={`leads-funnel-shape-group${enableStageFilter ? " clickable" : ""}${isActive ? " active" : ""}`}
                  onClick={() => onStageClick(key)}
                >
                  <path d={frustumPath(y0, y1, tw, bottomWidths[key])} fill={color} className="leads-funnel-shape" />
                  <ellipse cx={SHAPE_CX} cy={y0} rx={tw / 2} ry={ELLIPSE_RY} fill="rgba(255,255,255,.32)" />
                </g>

                {breakdown.map((entry, i) => {
                  const rowY = y0 + 14 + i * 18;
                  return (
                    <g key={entry.status} aria-hidden="true">
                      <line x1={originX} y1={originY} x2={300} y2={rowY} stroke={color} strokeWidth={1.2} />
                      <text x={310} y={rowY + 4} className="leads-funnel-etapa-label" fill="var(--muted)">
                        {LEAD_STATUS_LABELS[entry.status]}
                      </text>
                      <text x={468} y={rowY + 4} textAnchor="end" className="leads-funnel-etapa-percent" fill={color}>
                        {entry.percent}%
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {STAGES.map(({ key }) => {
          const { y0, y1 } = STAGE_Y[key];
          const centerY = y0 + (y1 - y0) / 2;
          return (
            <div
              key={key}
              className="leads-funnel-stage-overlay"
              style={{ left: pctX(SHAPE_CX), top: pctY(centerY) }}
            >
              {counts[key]}
            </div>
          );
        })}

        <div className="leads-funnel-conversion" style={{ left: pctX(SHAPE_CX), top: pctY(GAP_Y.frioToMorno) }}>
          {formatConversion(conversion.frioToMorno)}
        </div>
        <div className="leads-funnel-conversion" style={{ left: pctX(SHAPE_CX), top: pctY(GAP_Y.mornoToQuente) }}>
          {formatConversion(conversion.mornoToQuente)}
        </div>
      </div>

      <p className="leads-funnel-closed-chip">
        {closedOrLost} {closedOrLost === 1 ? "lead fechado/perdido" : "leads fechados/perdidos"} · fora do funil
      </p>
    </div>
  );
}
