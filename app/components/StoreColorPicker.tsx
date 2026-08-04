"use client";

import { useState } from "react";

const FALLBACK_COLOR = "#2563EB";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

type Props = {
  defaultValue: string;
};

export function StoreColorPicker({ defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue);
  const swatchColor = HEX_RE.test(value) ? value : FALLBACK_COLOR;

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <input
        type="color"
        value={swatchColor}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Escolher cor primária"
        style={{
          width: "40px",
          height: "36px",
          padding: 0,
          border: "1px solid var(--border)",
          borderRadius: "6px",
          cursor: "pointer",
          background: "none",
        }}
      />
      <input
        type="text"
        name="cor_primaria"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input"
        placeholder="#2563EB"
        maxLength={7}
        style={{ maxWidth: "120px" }}
      />
    </div>
  );
}
