import Link from "next/link";

const TEAM = [
  {
    id: 1,
    name: "Pedro Alves",
    initials: "PA",
    role: "Vendedor Sênior",
    phone: "+55 11 99001-0001",
    statusOp: "quente",
    statusLabel: "Lead Quente Ativo",
    atendendo: "Carlos Mendes",
    ultimaAtividade: "2 min",
    leads: 14,
    fechamentos: 4,
    conversion: "28%",
  },
  {
    id: 2,
    name: "Julia Santos",
    initials: "JS",
    role: "Vendedora",
    phone: "+55 11 99001-0002",
    statusOp: "atendendo",
    statusLabel: "Em Atendimento",
    atendendo: "Ana Pereira",
    ultimaAtividade: "5 min",
    leads: 9,
    fechamentos: 2,
    conversion: "22%",
  },
  {
    id: 3,
    name: "Rafael Moura",
    initials: "RM",
    role: "Vendedor",
    phone: "+55 11 99001-0003",
    statusOp: "parado",
    statusLabel: "Parado há 2h",
    atendendo: null,
    ultimaAtividade: "2h",
    leads: 6,
    fechamentos: 1,
    conversion: "17%",
  },
  {
    id: 4,
    name: "IA Vex Auto",
    initials: "IA",
    role: "Assistente Virtual",
    phone: "Automático",
    statusOp: "atendendo",
    statusLabel: "6 Conversas Ativas",
    atendendo: null,
    ultimaAtividade: "agora",
    leads: 47,
    fechamentos: 5,
    conversion: "11%",
  },
];

export default function EquipePage() {
  const parados  = TEAM.filter((m) => m.statusOp === "parado").length;
  const quentes  = TEAM.filter((m) => m.statusOp === "quente").length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Equipe</h1>
          <div className="subtitle">Operação em tempo real · dados simulados</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card">
          <div className="kpi-label">Com Lead Quente Agora</div>
          <div className="kpi-value" style={{ color: "#B91C1C" }}>{quentes}</div>
          <div className="kpi-delta">requer atenção</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Parados</div>
          <div className="kpi-value" style={{ color: parados > 0 ? "#C2410C" : "#15803D" }}>{parados}</div>
          <div className="kpi-delta">{parados > 0 ? "sem atividade recente" : "todos ativos"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fechamentos / Mês</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>7</div>
          <div className="kpi-delta up">↑ +2 vs mês anterior</div>
        </div>
      </div>

      {parados > 0 && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⏱</span>
          <span>
            <strong>Rafael Moura parado há 2h</strong> — tem 1 lead quente não atendido.{" "}
            <Link href="/conversations" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
              Ver conversas →
            </Link>
          </span>
        </div>
      )}

      <div className="team-grid">
        {TEAM.map((m) => (
          <div key={m.id} className="team-card">
            <div className="team-avatar">{m.initials}</div>
            <div className="team-name">{m.name}</div>
            <div className="team-role" style={{ marginBottom: "6px" }}>{m.role}</div>

            <div className={`op-badge ${m.statusOp}`}>{m.statusLabel}</div>

            {m.atendendo && (
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: "10px" }}>
                Atendendo: <strong style={{ color: "var(--text)" }}>{m.atendendo}</strong>
              </div>
            )}

            {!m.atendendo && m.statusOp !== "parado" && (
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: "10px" }}>
                Última atividade: {m.ultimaAtividade}
              </div>
            )}

            {m.statusOp === "parado" && (
              <div style={{ fontSize: "11.5px", color: "#9F1239", marginBottom: "10px", fontWeight: 600 }}>
                Sem atividade há {m.ultimaAtividade}
              </div>
            )}

            <div className="team-stats">
              <div>
                <div className="team-stat-value">{m.leads}</div>
                <div className="team-stat-label">Leads</div>
              </div>
              <div>
                <div className="team-stat-value">{m.fechamentos}</div>
                <div className="team-stat-label">Fechados</div>
              </div>
              <div>
                <div className="team-stat-value">{m.conversion}</div>
                <div className="team-stat-label">Conversão</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
