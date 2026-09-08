type Bar = { label: string; value: number; color: string };

export function BarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {bars.map((b) => (
        <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "104px", fontSize: "11.5px", color: "var(--muted)", flexShrink: 0 }}>
            {b.label}
          </div>
          <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: "0 4px 4px 0", overflow: "hidden", height: "16px" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                background: b.color,
                borderRadius: "0 4px 4px 0",
                transform: `scaleX(${b.value / max})`,
                transformOrigin: "left",
                transition: "transform 0.3s ease",
              }}
            />
          </div>
          <div style={{ width: "32px", fontSize: "12px", fontWeight: 700, color: "var(--text-strong)", textAlign: "right", flexShrink: 0 }}>
            {b.value}
          </div>
        </div>
      ))}
    </div>
  );
}
