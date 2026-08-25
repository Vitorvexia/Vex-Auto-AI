type DonutSegment = { id?: string; label: string; value: number; percent?: number; color: string };

const RADIUS = 40;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  segments,
  emptyLabel = "Sem dados no período",
}: {
  segments: DonutSegment[];
  emptyLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="donut-chart">
      <div className="donut-chart-ring">
        <svg viewBox="0 0 100 100" className="donut-chart-svg">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--panel-2)" strokeWidth={STROKE} />
          {total > 0 &&
            segments.map((s) => {
              const dash = (s.value / total) * CIRCUMFERENCE;
              const el = (
                <circle
                  key={s.id ?? s.label}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        <div className="donut-chart-total">{total}</div>
      </div>
      <ul className="donut-chart-legend">
        {segments.length === 0 && <li className="donut-chart-empty">{emptyLabel}</li>}
        {segments.map((s) => (
          <li key={s.id ?? s.label}>
            <span className="donut-chart-swatch" style={{ background: s.color }} />
            <span className="donut-chart-legend-label">{s.label}</span>
            {s.percent !== undefined && <span className="donut-chart-legend-percent">{s.percent}%</span>}
            <span className="donut-chart-legend-count">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
