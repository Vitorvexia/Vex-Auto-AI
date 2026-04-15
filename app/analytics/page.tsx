import Link from "next/link";

const INSIGHTS = [
  {
    type: "hot",
    title: "7 leads travados em Negociação",
    desc: "Sem movimentação há 3+ dias. Risco alto de perda — intervenção humana urgente.",
    href: "/leads",
    hrefLabel: "Ver leads em negociação →",
  },
  {
    type: "warn",
    title: "Jeep Compass: 28 dias parado no estoque",
    desc: "Giro médio do estoque é 15 dias. Considere redução de preço ou promoção ativa para destravar.",
    href: "/estoque",
    hrefLabel: "Ver no estoque →",
  },
  {
    type: "warn",
    title: "Conversão caindo no WhatsApp Direto",
    desc: "Taxa: 18% → 11% nos últimos 15 dias. Leads chegam mas não avançam. Revise o script inicial da IA.",
    href: null,
    hrefLabel: null,
  },
  {
    type: "ok",
    title: "Indicações com maior ROI do sistema",
    desc: "50% de conversão vs 9% da média geral. Ative pedido ativo de indicações aos clientes fechados.",
    href: null,
    hrefLabel: null,
  },
];

const RECS = [
  "Contate manualmente os 7 leads em Negociação — risco de abandono hoje",
  "Crie oferta ou reduza o preço do Jeep Compass (28 dias sem girar)",
  "Revise a primeira mensagem da IA no canal WhatsApp Direto",
  "Peça indicações aos 4 clientes fechados este mês — melhor canal por ROI",
];

const MONTHLY = [
  { label: "Jan", value: 82000,  height: 55 },
  { label: "Fev", value: 95000,  height: 64 },
  { label: "Mar", value: 118000, height: 80 },
  { label: "Abr", value: 148000, height: 100 },
];

const FUNNEL = [
  { label: "Novo",        count: 47, pct: 100, color: "#94A3B8" },
  { label: "Engajado",    count: 31, pct: 66,  color: "#0EA5E9" },
  { label: "Interessado", count: 19, pct: 40,  color: "#8B5CF6" },
  { label: "Quente",      count: 12, pct: 26,  color: "#F97316" },
  { label: "Negociação",  count: 7,  pct: 15,  color: "#22C55E" },
  { label: "Fechado",     count: 4,  pct:  9,  color: "#10B981" },
];

const ROI = [
  { channel: "WhatsApp",  leads: 28, pct: 100, value: "R$ 148k", conv: "18%" },
  { channel: "OLX",       leads: 12, pct: 43,  value: "R$ 54k",  conv: "12%" },
  { channel: "Webmotors", leads: 5,  pct: 18,  value: "R$ 22k",  conv: "11%" },
  { channel: "Indicação", leads: 2,  pct: 7,   value: "R$ 38k",  conv: "50%" },
];

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function AnalyticsPage() {
  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <div className="subtitle">Painel de decisão · dados simulados</div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Faturamento / Mês</div>
          <div className="kpi-value">R$ 148k</div>
          <div className="kpi-delta up">↑ +25% vs março</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Veículos Vendidos</div>
          <div className="kpi-value">4</div>
          <div className="kpi-delta">ticket médio R$ 37k</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Conversão</div>
          <div className="kpi-value">8,5%</div>
          <div className="kpi-delta">47 leads → 4 fechados</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Leads / Mês</div>
          <div className="kpi-value">47</div>
          <div className="kpi-delta up">↑ +12 vs março</div>
        </div>
      </div>

      {/* ── Insights + Recomendações (PRIMARY) ── */}
      <div className="dash-grid" style={{ marginBottom: "16px" }}>
        <div className="section-card">
          <div className="section-card-head">
            <span className="section-card-title">Insights & Alertas</span>
            <span className="pill" data-conv-status="ATIVA">Ao vivo</span>
          </div>
          <div className="section-card-body">
            {INSIGHTS.map((ins, i) => (
              <div key={i} className={`insight-card ${ins.type}`}>
                <div className="insight-title">{ins.title}</div>
                <div className="insight-desc">{ins.desc}</div>
                {ins.href && (
                  <Link href={ins.href} className="insight-link">{ins.hrefLabel}</Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-head">
            <span className="section-card-title">O que fazer agora</span>
            <span className="kpi-delta">{RECS.length} ações</span>
          </div>
          <div className="section-card-body">
            <div className="rec-list">
              {RECS.map((r, i) => (
                <div key={i} className="rec-item">
                  <span className="rec-num">{i + 1}</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts (SUPPORTING) ── */}
      <div className="analytics-grid">
        <div className="chart-wrap">
          <div className="chart-title">
            Faturamento Mensal
            <span className="chart-subtitle">últimos 4 meses</span>
          </div>
          <div className="bar-chart">
            {MONTHLY.map((m) => (
              <div key={m.label} className="bar-col">
                <div className="bar-value">{fmt(m.value)}</div>
                <div className="bar-fill" style={{ height: `${m.height}%` }} />
                <div className="bar-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-wrap">
          <div className="chart-title">
            ROI por Canal
            <span className="chart-subtitle">leads e conversão</span>
          </div>
          {ROI.map((r) => (
            <div key={r.channel} className="roi-row">
              <span className="roi-channel">{r.channel}</span>
              <div className="roi-track">
                <div className="roi-fill" style={{ width: `${r.pct}%` }} />
              </div>
              <span style={{ fontSize: "10.5px", color: "#15803D", fontWeight: 700, width: "34px", textAlign: "right", flexShrink: 0 }}>
                {r.conv}
              </span>
              <span className="roi-value">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="chart-wrap full">
          <div className="chart-title">
            Funil de Conversão
            <span className="chart-subtitle">mês atual · gargalo em Negociação</span>
          </div>
          {FUNNEL.map((f) => (
            <div key={f.label} className="funnel-row">
              <span className="funnel-label">{f.label}</span>
              <div className="funnel-track">
                <div className="funnel-fill" style={{ width: `${f.pct}%`, background: f.color }}>
                  {f.pct > 18 ? f.label : ""}
                </div>
              </div>
              <span className="funnel-count">{f.count}</span>
              <span className="funnel-pct">{f.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
