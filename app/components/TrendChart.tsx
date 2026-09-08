import type { DailyTrendPoint } from "@/lib/metrics";

type Series = { key: "novos" | "followups" | "reativacoes"; label: string; color: string };

const SERIES: Series[] = [
  { key: "novos", label: "Leads Novos", color: "var(--accent)" },
  { key: "followups", label: "Follow-ups Enviados", color: "#14B8A6" },
  { key: "reativacoes", label: "Reativações Enviadas", color: "#F59E0B" },
];

const W = 640;
const H = 220;
const PAD_X = 34;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Escolhe um step "redondo" (1/2/5 × 10^n) pra que as linhas de grade caiam
// em valores limpos (0, 5, 10…) em vez de frações arbitrárias de `max`.
function niceStep(max: number, targetRows: number): number {
  const rough = Math.max(max, 1) / targetRows;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return Math.max(1, step * mag);
}

export function TrendChart({ data }: { data: DailyTrendPoint[] }) {
  const rawMax = Math.max(1, ...data.flatMap((p) => [p.novos, p.followups, p.reativacoes]));
  const step = niceStep(rawMax, 4);
  const niceMax = Math.ceil(rawMax / step) * step;
  const gridValues = [];
  for (let v = 0; v <= niceMax; v += step) gridValues.push(v);

  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? (W - PAD_X - 8) / (data.length - 1) : 0;

  const yFor = (v: number) => PAD_TOP + plotH * (1 - v / niceMax);
  const xFor = (i: number) => PAD_X + i * stepX;

  // Suavização por curva quadrática passando pelos pontos médios entre
  // vizinhos — ao contrário de Catmull-Rom, nunca ultrapassa o intervalo dos
  // pontos adjacentes, então não "sobe"/"desce" além dos vizinhos em dados
  // esparsos (dias zerados intercalados com picos isolados).
  const smoothPath = (points: Array<[number, number]>): string => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
    let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      d += ` Q ${x0.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    const [lx, ly] = points[points.length - 1];
    d += ` T ${lx.toFixed(1)},${ly.toFixed(1)}`;
    return d;
  };

  const pointsFor = (key: Series["key"]): Array<[number, number]> =>
    data.map((p, i) => [xFor(i), yFor(p[key])]);

  const toLine = (key: Series["key"]) => smoothPath(pointsFor(key));

  const toArea = (key: Series["key"]) => {
    const baseY = PAD_TOP + plotH;
    const x0 = xFor(0);
    const xLast = xFor(data.length - 1);
    return `M ${x0.toFixed(1)},${baseY} L ${smoothPath(pointsFor(key)).slice(2)} L ${xLast.toFixed(1)},${baseY} Z`;
  };

  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const lastIndex = data.length - 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Tendência diária de leads novos, follow-ups e reativações">
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.14" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD_X} y1={yFor(v)} x2={W - 8} y2={yFor(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_X - 8} y={yFor(v) + 3} fontSize="9.5" fill="var(--muted)" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {SERIES.map((s) => (
          <path key={`area-${s.key}`} d={toArea(s.key)} fill={`url(#grad-${s.key})`} stroke="none" />
        ))}
        {SERIES.map((s) => (
          <path
            key={s.key}
            d={toLine(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Marcador + valor só no último ponto de cada série — rótulo seletivo, não em todo ponto */}
        {SERIES.map((s) => {
          const last = data[lastIndex];
          if (!last) return null;
          const x = xFor(lastIndex);
          const y = yFor(last[s.key]);
          return (
            <g key={`end-${s.key}`}>
              <circle cx={x} cy={y} r={4} fill={s.color} stroke="var(--panel)" strokeWidth={2} />
              <text x={x} y={y - 9} fontSize="10.5" fontWeight={700} fill="var(--text-strong)" textAnchor="middle">
                {last[s.key]}
              </text>
            </g>
          );
        })}

        {data.map((p, i) =>
          i % labelEvery === 0 || i === lastIndex ? (
            <text key={p.date} x={xFor(i)} y={H - 8} fontSize="9.5" fill="var(--muted)" textAnchor="middle">
              {formatDayMonth(p.date)}
            </text>
          ) : null
        )}
      </svg>

      <div style={{ display: "flex", gap: "16px", marginTop: "4px", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
        {SERIES.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--muted)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color, display: "inline-block" }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
