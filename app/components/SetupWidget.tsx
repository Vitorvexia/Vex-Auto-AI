"use client";

import { useState } from "react";

type ChecklistItem = { done: boolean; text: string };

function TasksIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

export function SetupWidget({ checklist }: { checklist: ChecklistItem[] }) {
  const [open, setOpen] = useState(false);
  const done = checklist.filter((c) => c.done).length;
  const complete = done === checklist.length;

  return (
    <div>
      {open ? (
        <div
          style={{
            width: "260px",
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
              Tasks · {done}/{checklist.length}
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
          <div className="setup-progress-track" style={{ margin: "10px 12px 0" }}>
            <div className="setup-progress-fill" style={{ transform: `scaleX(${done / checklist.length})` }} />
          </div>
          <div style={{ padding: "8px 12px 10px" }}>
            {checklist.map((c, i) => (
              <div key={i} className="checklist-item">
                <span className={`checklist-check${c.done ? " done" : ""}`}>{c.done ? "✓" : ""}</span>
                <span
                  style={{
                    textDecoration: c.done ? "line-through" : "none",
                    color: c.done ? "var(--muted)" : "var(--text)",
                  }}
                >
                  {c.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={`Tasks · ${done}/${checklist.length} concluídas`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "50%",
            color: complete ? "var(--muted)" : "var(--accent)",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)",
          }}
        >
          <TasksIcon />
        </button>
      )}
    </div>
  );
}
