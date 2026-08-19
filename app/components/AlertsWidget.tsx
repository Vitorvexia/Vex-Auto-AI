"use client";

import { useState } from "react";

type Alert = { type: "hot" | "warn" | "info"; icon: string; text: string };

function AlertsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function AlertsWidget({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const hasAlerts = alerts.length > 0;

  return (
    <div>
      {open ? (
        <div
          style={{
            width: "300px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            boxShadow: "0 4px 16px rgba(0,0,0,.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-strong)" }}>
              Alertas · {alerts.length} pendente{alerts.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimizar"
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "14px",
                lineHeight: 1,
                padding: "2px",
              }}
            >
              ✕
            </button>
          </div>
          <div className="alert-rail-body" style={{ padding: "10px 12px" }}>
            {alerts.length === 0 ? (
              <div>Nenhum alerta no momento.</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} className={`alert-item ${a.type}`}>
                  <span className="alert-icon">{a.icon}</span>
                  <span>{a.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Alertas · ${alerts.length} pendentes`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "50%",
            color: hasAlerts ? "#F87171" : "var(--muted)",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)",
          }}
        >
          <AlertsIcon />
        </button>
      )}
    </div>
  );
}
