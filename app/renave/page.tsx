import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { advanceRenaveStage } from "@/lib/renave-actions";
import {
  RENAVE_STAGES,
  RENAVE_STAGE_LABELS,
  nextRenaveStage,
  renaveStageRequiresNfeKey,
  daysStalled,
  isRenaveStalled,
  type RenaveStage,
} from "@/lib/renave";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PendingVehicle = {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  renave_stage: RenaveStage;
  renave_nfe_key: string | null;
  renave_stage_updated_at: string;
};

export default async function RenavePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const { data, error } = await supabase
    .from("vehicles")
    .select("id, marca, modelo, ano, renave_stage, renave_nfe_key, renave_stage_updated_at")
    .neq("renave_stage", "saida_registrada")
    .order("renave_stage_updated_at", { ascending: true });

  const pending = (data ?? []) as PendingVehicle[];
  const stalledCount = pending.filter((v) => isRenaveStalled(v.renave_stage_updated_at)).length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>RENAVE — Pendências</h1>
          <div className="subtitle">
            Controle interno de status por veículo · o VEX organiza, valida e cobra prazo —
            não registra no RENAVE
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Erro ao carregar pendências de RENAVE: {error.message}</span>
        </div>
      )}

      {!error && stalledCount > 0 && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⏱</span>
          <span>
            <strong>
              {stalledCount} veículo{stalledCount > 1 ? "s" : ""} parado
              {stalledCount > 1 ? "s" : ""} há mais de 7 dias
            </strong>{" "}
            no mesmo estágio — risco de atraso no prazo do RENAVE (setembro/2026).
          </span>
        </div>
      )}

      {!error && pending.length === 0 ? (
        <div className="alert-item ok">
          <span className="alert-icon">✓</span>
          <span>Nenhum veículo pendente — todos com saída registrada no RENAVE.</span>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Estágio atual</th>
              <th>Chave NF-e</th>
              <th>Parado há</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((v) => {
              const dias = daysStalled(v.renave_stage_updated_at);
              const stalled = isRenaveStalled(v.renave_stage_updated_at);
              const next = nextRenaveStage(v.renave_stage);
              const needsNfeKeyInput =
                next !== null && renaveStageRequiresNfeKey(next) && !v.renave_nfe_key;
              return (
                <tr key={v.id}>
                  <td>{v.marca} {v.modelo} {v.ano}</td>
                  <td>{RENAVE_STAGE_LABELS[v.renave_stage]}</td>
                  <td>{v.renave_nfe_key ? "vinculada" : "—"}</td>
                  <td>
                    <span className={`op-badge ${stalled ? "parado" : "disponivel"}`}>
                      {dias} dia{dias === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td>
                    {next && (
                      <form
                        action={advanceRenaveStage.bind(null, v.id)}
                        style={{ display: "flex", gap: "6px", alignItems: "center" }}
                      >
                        {needsNfeKeyInput && (
                          <input
                            type="text"
                            name="nfe_key"
                            required
                            placeholder="Chave da NF-e (44 dígitos)"
                            className="input"
                            style={{ fontSize: "12px", padding: "4px 8px", width: "220px" }}
                          />
                        )}
                        <button type="submit" className="btn-secondary" style={{ fontSize: "12px" }}>
                          Avançar para {RENAVE_STAGE_LABELS[next]}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "20px", fontSize: "11.5px", color: "var(--muted)" }}>
        Sequência: {RENAVE_STAGES.map((s) => RENAVE_STAGE_LABELS[s]).join(" → ")}
      </div>
    </main>
  );
}
