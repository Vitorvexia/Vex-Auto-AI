function AlertTriangleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Badge flutuante fixo (mesmo padrão visual de AlertsWidget em /inicio) —
 * aqui é link direto pro filtro "Atrasados", não painel colapsável.
 */
export function DelayedLeadsBadge({ count, href }: { count: number; href: string }) {
  const hasDelayed = count > 0;
  return (
    <a
      href={href}
      aria-label={`Lead Atrasado — ${count} pendente${count === 1 ? "" : "s"}`}
      className={`delayed-leads-badge${hasDelayed ? " has-delayed" : ""}`}
    >
      <AlertTriangleIcon />
      {hasDelayed && <span className="delayed-leads-badge-count">{count}</span>}
    </a>
  );
}
