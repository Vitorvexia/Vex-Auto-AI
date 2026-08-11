import type { Step } from "./steps";

// Ilustrações leves em CSS/HTML — não são screenshots reais do produto.
// Comunicam a ideia de cada etapa sem fingir ser a UI exata do app.
export function StepMedia({ icon }: { icon: Step["icon"] }) {
  switch (icon) {
    case "chat":
      return (
        <div className="mkt-media mkt-media-chat" aria-hidden="true">
          <div className="mkt-mini-bubble mkt-mini-bubble-lead">O Compass 2022 ainda tá disponível?</div>
          <div className="mkt-mini-bubble mkt-mini-bubble-ia">Está sim! Financiado ou à vista?</div>
        </div>
      );
    case "score":
      return (
        <div className="mkt-media mkt-media-score" aria-hidden="true">
          <div className="mkt-score-ring">
            <span className="mkt-score-value">82</span>
          </div>
          <div className="mkt-score-label">
            <span className="mkt-score-pill">QUENTE</span>
            <span>financiamento + troca detectados</span>
          </div>
        </div>
      );
    case "loop":
      return (
        <div className="mkt-media mkt-media-loop" aria-hidden="true">
          <div className="mkt-loop-track">
            <div className="mkt-loop-dot" />
            <div className="mkt-loop-dot" />
            <div className="mkt-loop-dot" />
          </div>
          <div className="mkt-loop-labels">
            <span>2h</span>
            <span>24h</span>
            <span>72h</span>
          </div>
        </div>
      );
    case "handoff":
      return (
        <div className="mkt-media mkt-media-handoff" aria-hidden="true">
          <div className="mkt-handoff-card">
            <span className="mkt-handoff-tag">Aguardando Humano</span>
            <strong>Rafael M.</strong>
            <span>Jeep Compass · Score 82</span>
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="mkt-media mkt-media-chart" aria-hidden="true">
          <div className="mkt-bars">
            <span style={{ height: "38%" }} />
            <span style={{ height: "64%" }} />
            <span style={{ height: "50%" }} />
            <span style={{ height: "82%" }} />
            <span style={{ height: "70%" }} />
          </div>
        </div>
      );
    default:
      return null;
  }
}
