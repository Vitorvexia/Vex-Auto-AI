import Link from "next/link";

const VEHICLES = [
  { id: 1, name: "Honda Civic EXL",        detail: "2022 · 28.000 km · Flex",  price: 89000,  cost: 75000,  status: "disponivel", leads: 3, diasEstoque: 5  },
  { id: 2, name: "Toyota Corolla XEi",     detail: "2021 · 41.000 km · Flex",  price: 95000,  cost: 82000,  status: "reservado",  leads: 1, diasEstoque: 12 },
  { id: 3, name: "Jeep Compass Limited",   detail: "2023 · 12.000 km · Diesel",price: 155000, cost: 128000, status: "disponivel", leads: 2, diasEstoque: 28 },
  { id: 4, name: "Volkswagen Polo Highline",detail: "2022 · 19.500 km · Flex", price: 72000,  cost: 62000,  status: "disponivel", leads: 4, diasEstoque: 8  },
  { id: 5, name: "Hyundai HB20 Diamond",   detail: "2023 · 8.200 km · Flex",   price: 65000,  cost: 58000,  status: "disponivel", leads: 1, diasEstoque: 3  },
  { id: 6, name: "Fiat Pulse Impetus",     detail: "2023 · 15.000 km · Turbo", price: 108000, cost: 92000,  status: "vendido",    leads: 0, diasEstoque: 18 },
];

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido",
};

function margin(price: number, cost: number) {
  return (((price - cost) / price) * 100).toFixed(1);
}
function giroClass(dias: number) {
  return dias <= 10 ? "ok" : dias <= 20 ? "mid" : "slow";
}

export default function EstoquePage() {
  const available  = VEHICLES.filter((v) => v.status === "disponivel").length;
  const withLeads  = VEHICLES.filter((v) => v.leads > 0).length;
  const slowMovers = VEHICLES.filter((v) => v.diasEstoque > 20 && v.status !== "vendido").length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Estoque</h1>
          <div className="subtitle">Foco em venda · dados simulados</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card">
          <div className="kpi-label">Disponíveis para Venda</div>
          <div className="kpi-value" style={{ color: "#15803D" }}>{available}</div>
          <div className="kpi-delta">prontos agora</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Com Leads Interessados</div>
          <div className="kpi-value" style={{ color: "#0369A1" }}>{withLeads}</div>
          <div className="kpi-delta">oportunidade ativa</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Giro Lento (&gt;20 dias)</div>
          <div className="kpi-value" style={{ color: slowMovers > 0 ? "#C2410C" : "#15803D" }}>{slowMovers}</div>
          <div className="kpi-delta">{slowMovers > 0 ? "atenção necessária" : "tudo ok"}</div>
        </div>
      </div>

      {slowMovers > 0 && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>
            <strong>{slowMovers} veículo{slowMovers > 1 ? "s" : ""} com giro lento</strong> — acima de 20 dias no estoque.
            Considere ajuste de preço ou promoção ativa para destravar.{" "}
            <Link href="/analytics" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
              Ver análise →
            </Link>
          </span>
        </div>
      )}

      <div className="vehicle-grid">
        {VEHICLES.map((v) => {
          const mg = parseFloat(margin(v.price, v.cost));
          const mgClass = mg < 8 ? "warn" : "ok";
          const gc = giroClass(v.diasEstoque);
          return (
            <div key={v.id} className="vehicle-card">
              <div className="vehicle-thumb">
                <span className={`giro-badge ${gc}`}>{v.diasEstoque}d</span>
                Foto do veículo
              </div>
              <div className="vehicle-info">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "2px" }}>
                  <div className="vehicle-name">{v.name}</div>
                  <span className={`vehicle-status-pill ${v.status}`}>{STATUS_LABEL[v.status]}</span>
                </div>
                <div className="vehicle-detail">{v.detail}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                  <div className="vehicle-price">
                    {v.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </div>
                  <span className={`vehicle-margin ${mgClass}`}>↑ {mg}% margem</span>
                </div>
                <div className="vehicle-cost">
                  Custo: {v.cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </div>

                {v.leads > 0 && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "#0369A1", fontWeight: 600 }}>
                      {v.leads} lead{v.leads > 1 ? "s" : ""} interessado{v.leads > 1 ? "s" : ""}
                    </span>
                    <Link href="/leads" className="card-cta">Conectar →</Link>
                  </div>
                )}

                {v.leads === 0 && v.status === "disponivel" && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Sem leads ativos — considere divulgar</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
