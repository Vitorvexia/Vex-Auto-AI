import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { createVehicle, updateVehicle, archiveVehicle, unarchiveVehicle } from "@/lib/vehicle-actions";
import { uploadVehiclePhotos } from "@/lib/vehicle-photo-actions";
import { MAX_PHOTOS_PER_VEHICLE } from "@/lib/vehicle-photos";
import { VehiclePhotoUpload } from "@/app/components/VehiclePhotoUpload";

type Vehicle = {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  preco: number;
  custo: number;
  margem_minima: number;
  disponivel: boolean;
  created_at: string;
  photo_url: string[];
};

function margin(preco: number, custo: number) {
  if (custo <= 0) return 0;
  return ((preco - custo) / preco) * 100;
}

function diasEstoque(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function giroClass(dias: number) {
  return dias <= 10 ? "ok" : dias <= 20 ? "mid" : "slow";
}

type PageProps = {
  searchParams?: { novo?: string; edit?: string };
};

// ---------------------------------------------------------------------------
// Inline Server Actions com redirect
// ---------------------------------------------------------------------------

async function handleCreate(formData: FormData) {
  "use server";
  await createVehicle(formData);
  redirect("/estoque");
}

async function handleUpdate(formData: FormData) {
  "use server";
  const vehicleId = formData.get("__vehicleId") as string;
  await updateVehicle(vehicleId, formData);
  redirect("/estoque");
}

async function handleArchive(formData: FormData) {
  "use server";
  const vehicleId = formData.get("__vehicleId") as string;
  await archiveVehicle(vehicleId);
  redirect("/estoque");
}

async function handleUnarchive(formData: FormData) {
  "use server";
  const vehicleId = formData.get("__vehicleId") as string;
  await unarchiveVehicle(vehicleId);
  redirect("/estoque");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function EstoquePage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, marca, modelo, ano, preco, custo, margem_minima, disponivel, created_at, photo_url")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar estoque: {error.message}</div>
      </main>
    );
  }

  const all = (vehicles ?? []) as Vehicle[];
  const available = all.filter((v) => v.disponivel);
  const archived = all.filter((v) => !v.disponivel);
  const slowMovers = available.filter((v) => diasEstoque(v.created_at) > 20);

  const showNovo = searchParams?.novo === "1";
  const editId = searchParams?.edit;
  const vehicleToEdit = editId ? all.find((v) => v.id === editId) : undefined;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Estoque</h1>
          <div className="subtitle">
            {available.length} disponíve{available.length === 1 ? "l" : "is"}
            {archived.length > 0 && ` · ${archived.length} arquivado${archived.length > 1 ? "s" : ""}`}
          </div>
        </div>
        {!showNovo && !editId && (
          <Link href="/estoque?novo=1" className="btn-primary" style={{ alignSelf: "center" }}>
            + Novo Veículo
          </Link>
        )}
      </div>

      {/* ── Create form ── */}
      {showNovo && (
        <div className="vehicle-form-card" style={{ marginBottom: "24px" }}>
          <h2 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
            Cadastrar Veículo
          </h2>
          <form action={handleCreate}>
            <VehicleFormFields />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button type="submit" className="btn-primary">Salvar</button>
              <Link href="/estoque" className="btn-secondary">Cancelar</Link>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit form ── */}
      {editId && vehicleToEdit && (
        <div className="vehicle-form-card" style={{ marginBottom: "24px" }}>
          <h2 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
            Editar Veículo
          </h2>
          <form action={handleUpdate}>
            <input type="hidden" name="__vehicleId" value={editId} />
            <VehicleFormFields vehicle={vehicleToEdit} />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button type="submit" className="btn-primary">Salvar alterações</button>
              <Link href="/estoque" className="btn-secondary">Cancelar</Link>
            </div>
          </form>

          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Fotos</h3>

            {vehicleToEdit.photo_url.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                {vehicleToEdit.photo_url.map((url, i) => (
                  <div key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente */}
                    <img
                      src={url}
                      alt={`Foto ${i + 1} de ${vehicleToEdit.marca} ${vehicleToEdit.modelo}`}
                      style={{ width: "72px", height: "72px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--border)" }}
                    />
                    {i === 0 && (
                      <span
                        style={{
                          position: "absolute", top: "2px", left: "2px",
                          fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "999px",
                          background: "rgba(34,197,94,.85)", color: "#fff",
                        }}
                      >
                        Capa
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <VehiclePhotoUpload
              action={uploadVehiclePhotos.bind(null, editId)}
              remainingSlots={MAX_PHOTOS_PER_VEHICLE - vehicleToEdit.photo_url.length}
            />
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      {!showNovo && !editId && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi-card">
              <div className="kpi-label">Disponíveis para Venda</div>
              <div className="kpi-value" style={{ color: "#15803D" }}>{available.length}</div>
              <div className="kpi-delta">prontos agora</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Arquivados</div>
              <div className="kpi-value" style={{ color: "#6B7280" }}>{archived.length}</div>
              <div className="kpi-delta">fora de linha</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Giro Lento (&gt;20 dias)</div>
              <div className="kpi-value" style={{ color: slowMovers.length > 0 ? "#C2410C" : "#15803D" }}>
                {slowMovers.length}
              </div>
              <div className="kpi-delta">{slowMovers.length > 0 ? "atenção necessária" : "tudo ok"}</div>
            </div>
          </div>

          {slowMovers.length > 0 && (
            <div className="alert-item warn" style={{ marginBottom: "16px" }}>
              <span className="alert-icon">⚠</span>
              <span>
                <strong>{slowMovers.length} veículo{slowMovers.length > 1 ? "s" : ""} com giro lento</strong>
                {" "}— acima de 20 dias no estoque. Considere ajuste de preço ou promoção.{" "}
                <Link href="/analytics" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
                  Ver análise →
                </Link>
              </span>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {all.length === 0 && !showNovo && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚗</div>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>Nenhum veículo cadastrado</div>
          <div style={{ fontSize: "13px", marginBottom: "16px" }}>
            Cadastre veículos para que a IA possa apresentá-los aos leads.
          </div>
          <Link href="/estoque?novo=1" className="btn-primary">+ Cadastrar primeiro veículo</Link>
        </div>
      )}

      {/* ── Vehicle grid ── */}
      {all.length > 0 && !showNovo && !editId && (
        <div className="vehicle-grid">
          {all.map((v) => {
            const mg = margin(v.preco, v.custo);
            const mgClass = mg < 8 ? "warn" : "ok";
            const dias = diasEstoque(v.created_at);
            const gc = giroClass(dias);
            return (
              <div key={v.id} className={`vehicle-card${!v.disponivel ? " vehicle-card-archived" : ""}`}>
                <div className="vehicle-thumb">
                  {v.disponivel ? (
                    <span className={`giro-badge ${gc}`}>{dias}d</span>
                  ) : (
                    <span className="giro-badge slow">arquivado</span>
                  )}
                  {v.photo_url.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente
                    <img
                      src={v.photo_url[0]}
                      alt={`${v.marca} ${v.modelo}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "12px" }}>Sem foto</span>
                  )}
                </div>
                <div className="vehicle-info">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "2px" }}>
                    <div className="vehicle-name">{v.marca} {v.modelo}</div>
                    <span className={`vehicle-status-pill ${v.disponivel ? "disponivel" : "arquivado"}`}>
                      {v.disponivel ? "Disponível" : "Arquivado"}
                    </span>
                  </div>
                  <div className="vehicle-detail">{v.ano}</div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                    <div className="vehicle-price">
                      {v.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </div>
                    <span className={`vehicle-margin ${mgClass}`}>↑ {mg.toFixed(1)}% margem</span>
                  </div>
                  <div className="vehicle-cost">
                    Custo: {v.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </div>
                  {v.margem_minima > 0 && (
                    <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                      Margem mín: {v.margem_minima.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </div>
                  )}

                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                    <Link
                      href={`/estoque?edit=${v.id}`}
                      style={{ fontSize: "12px", fontWeight: 600, color: "#0369A1" }}
                    >
                      Editar
                    </Link>
                    {v.disponivel ? (
                      <form action={handleArchive} style={{ display: "inline" }}>
                        <input type="hidden" name="__vehicleId" value={v.id} />
                        <button
                          type="submit"
                          style={{ fontSize: "12px", fontWeight: 600, color: "#C2410C", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Arquivar
                        </button>
                      </form>
                    ) : (
                      <form action={handleUnarchive} style={{ display: "inline" }}>
                        <input type="hidden" name="__vehicleId" value={v.id} />
                        <button
                          type="submit"
                          style={{ fontSize: "12px", fontWeight: 600, color: "#15803D", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Desarquivar
                        </button>
                      </form>
                    )}
                    <Link href="/leads" style={{ fontSize: "12px", fontWeight: 600, color: "#15803D", marginLeft: "auto" }}>
                      Ver leads →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Form fields component
// ---------------------------------------------------------------------------

function VehicleFormFields({ vehicle }: { vehicle?: Vehicle }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Marca *
        </label>
        <input
          type="text"
          name="marca"
          required
          defaultValue={vehicle?.marca ?? ""}
          className="input"
          placeholder="Ex: Honda"
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Modelo *
        </label>
        <input
          type="text"
          name="modelo"
          required
          defaultValue={vehicle?.modelo ?? ""}
          className="input"
          placeholder="Ex: Civic"
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Ano *
        </label>
        <input
          type="number"
          name="ano"
          required
          min={1900}
          max={2100}
          defaultValue={vehicle?.ano ?? new Date().getFullYear()}
          className="input"
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Preço de Venda (R$) *
        </label>
        <input
          type="number"
          name="preco"
          required
          min={0}
          step="0.01"
          defaultValue={vehicle?.preco ?? ""}
          className="input"
          placeholder="Ex: 89000"
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Custo (R$) *
        </label>
        <input
          type="number"
          name="custo"
          required
          min={0}
          step="0.01"
          defaultValue={vehicle?.custo ?? ""}
          className="input"
          placeholder="Ex: 75000"
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
          Margem Mínima (R$)
        </label>
        <input
          type="number"
          name="margem_minima"
          min={0}
          step="0.01"
          defaultValue={vehicle?.margem_minima ?? 0}
          className="input"
          placeholder="Ex: 3000"
        />
      </div>
    </div>
  );
}
