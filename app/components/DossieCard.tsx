import type { DossierResult } from "@/lib/lead-dossier";

export function DossieCard({
  dossier,
  score,
}: {
  dossier: DossierResult;
  score?: number;
}) {
  return (
    <details className="dossie-card" open>
      <summary className="dossie-summary">
        <span className="dossie-title">Dossiê do Lead</span>
        <div className="dossie-badges">
          <span className={`priority-badge ${dossier.priority}`}>
            {dossier.priority_label}
          </span>
          {score != null && <span className="dossie-score">{score}</span>}
        </div>
      </summary>

      <div className="dossie-body">
        <section className="dossie-section">
          <div className="dossie-label">Contexto</div>
          <div className="dossie-text">{dossier.summary}</div>
          <div className="dossie-meta">Última atividade: {dossier.recent_activity}</div>
        </section>

        {dossier.intent_signals.length > 0 && (
          <section className="dossie-section">
            <div className="dossie-label">Intenções identificadas</div>
            <ul className="dossie-intent-signals">
              {dossier.intent_signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {dossier.warnings.length > 0 && (
          <section className="dossie-section">
            <div className={`dossie-warnings ${dossier.warningSeverity}`}>
              <div className="dossie-label">⚠ Alertas</div>
              <ul>
                {dossier.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="dossie-action">→ Ação: {dossier.recommended_action}</div>
      </div>
    </details>
  );
}
