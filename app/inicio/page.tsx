import Link from "next/link";

const ACTIVITIES = [
  { text: "IA iniciou abordagem com Carlos Mendes — Honda Civic 2022", time: "2 min", color: "#0EA5E9" },
  { text: "Lead João Silva avançou para Negociação", time: "8 min", color: "#22C55E" },
  { text: "Follow-up automático enviado para Ana Pereira", time: "15 min", color: "#0EA5E9" },
  { text: "Lead Roberto Costa classificado como Quente (score 82)", time: "32 min", color: "#F97316" },
  { text: "Proposta enviada para Marina Lima — Toyota Corolla", time: "1h", color: "#8B5CF6" },
  { text: "Novo lead via WhatsApp — Lucas Rocha", time: "1h 20min", color: "#0EA5E9" },
];

const ALERTS = [
  { type: "hot",  icon: "⚠", text: "3 leads sem resposta há mais de 24h — intervenção recomendada" },
  { type: "warn", icon: "⏱", text: "1 conversa aguardando vendedor há mais de 40 minutos" },
  { type: "info", icon: "↓",  text: "2 veículos com margem abaixo de 5% no estoque" },
];

const HOT_LEADS = [
  { name: "Carlos Mendes", score: 87, vehicle: "Honda Civic 2022",     time: "2 min" },
  { name: "Roberto Costa", score: 82, vehicle: "Toyota Corolla 2021",  time: "32 min" },
  { name: "Ana Pereira",   score: 75, vehicle: "Jeep Compass 2023",    time: "1h" },
];

const CHECKLIST = [
  { done: true,  text: "WhatsApp Business conectado" },
  { done: true,  text: "Equipe cadastrada (3 vendedores)" },
  { done: true,  text: "Estoque configurado (6 veículos)" },
  { done: false, text: "Integração com portais (OLX / Webmotors)" },
  { done: false, text: "Mensagens da IA personalizadas" },
];

export default function InicioPage() {
  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Central de Operações</h1>
          <div className="subtitle">Dados simulados · conecte o backend para dados reais</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Leads Hoje</div>
          <div className="kpi-value">8</div>
          <div className="kpi-delta up">↑ +3 vs ontem</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Leads Quentes</div>
          <div className="kpi-value" style={{ color: "#F97316" }}>3</div>
          <div className="kpi-delta">score acima de 70</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Em Negociação</div>
          <div className="kpi-value">5</div>
          <div className="kpi-delta">2 aguardando proposta</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fechamentos / Mês</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>12</div>
          <div className="kpi-delta up">↑ R$ 148k em vendas</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Atividade Recente da IA</span>
              <span className="pill" data-conv-status="ATIVA">Ao vivo</span>
            </div>
            <div>
              {ACTIVITIES.map((a, i) => (
                <div key={i} className="activity-item" style={{ padding: "9px 16px" }}>
                  <span className="activity-dot" style={{ background: a.color }} />
                  <span className="activity-text">{a.text}</span>
                  <span className="activity-time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Leads Quentes</span>
              <Link href="/leads" style={{ fontSize: "11.5px", color: "var(--accent)" }}>ver todos →</Link>
            </div>
            <div>
              {HOT_LEADS.map((l, i) => (
                <div key={i} className="activity-item" style={{ padding: "10px 16px", alignItems: "center" }}>
                  <span className="score-badge s-hot">{l.score}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>{l.name}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>{l.vehicle}</div>
                  </div>
                  <span className="activity-time">{l.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dash-col">
          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Alertas</span>
              <span className="kpi-delta">{ALERTS.length} pendentes</span>
            </div>
            <div className="section-card-body">
              {ALERTS.map((a, i) => (
                <div key={i} className={`alert-item ${a.type}`}>
                  <span className="alert-icon">{a.icon}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Setup Inicial</span>
              <span className="kpi-delta up">3 / 5 concluídos</span>
            </div>
            <div style={{ padding: "4px 16px 10px" }}>
              {CHECKLIST.map((c, i) => (
                <div key={i} className="checklist-item">
                  <span className={`checklist-check${c.done ? " done" : ""}`}>
                    {c.done ? "✓" : ""}
                  </span>
                  <span style={{
                    textDecoration: c.done ? "line-through" : "none",
                    color: c.done ? "var(--muted)" : "var(--text)",
                  }}>
                    {c.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Acesso Rápido</span>
            </div>
            <div className="section-card-body" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Link href="/leads" className="quick-link">→ Pipeline de Leads</Link>
              <Link href="/conversations" className="quick-link">→ WhatsApp / Conversas</Link>
              <Link href="/estoque" className="quick-link">→ Gerenciar Estoque</Link>
              <Link href="/analytics" className="quick-link">→ Ver Analytics</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
