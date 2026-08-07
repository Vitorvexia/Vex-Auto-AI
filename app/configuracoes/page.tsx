import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError, getServerUserRole } from "@/lib/auth";
import { updateStoreSettings, uploadStoreLogo } from "@/lib/store-actions";
import { StoreColorPicker } from "@/app/components/StoreColorPicker";
import { StoreLogoUpload } from "@/app/components/StoreLogoUpload";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StoreRow = {
  id: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
  telefone_publico: string | null;
  endereco: string | null;
  sobre: string | null;
};

async function handleUpdateSettings(formData: FormData) {
  "use server";
  await updateStoreSettings(formData);
  redirect("/configuracoes");
}

async function handleUploadLogo(formData: FormData) {
  "use server";
  await uploadStoreLogo(formData);
  redirect("/configuracoes");
}

// Config visual por loja (roadmap 1.5) — logo, cor primária, telefone,
// endereço, "sobre". Leitura via cliente de sessão (RLS "stores_own",
// migration 005) — mesmo padrão de /equipe e /agenda, sem getServerStoreId()
// explícito. Escrita passa pelas Server Actions de lib/store-actions.ts, que
// fazem o guard de role de verdade (dono_loja/super_admin) — o gate aqui na
// UI é só pra não mostrar formulário editável a quem não pode editar.
export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const role = await getServerUserRole();
  const canEdit = role !== "vendedor";

  const { data: store, error } = await supabase
    .from("stores")
    .select("id, nome, logo_url, cor_primaria, telefone_publico, endereco, sobre")
    .single();

  if (error || !store) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar configurações da loja.</div>
      </main>
    );
  }

  const s = store as StoreRow;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações da Loja</h1>
          <div className="subtitle">{s.nome}</div>
        </div>
      </div>

      {!canEdit && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Apenas o dono da loja pode editar estas configurações. Exibindo somente leitura.</span>
        </div>
      )}

      <div className="vehicle-form-card" style={{ marginBottom: "24px" }}>
        <h2 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>Logo</h2>

        {s.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente
          <img
            src={s.logo_url}
            alt={`Logo de ${s.nome}`}
            style={{
              width: "96px", height: "96px", objectFit: "contain", borderRadius: "8px",
              border: "1px solid var(--border)", marginBottom: "12px", background: "var(--panel-2)",
            }}
          />
        ) : (
          <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
            Nenhum logo cadastrado ainda.
          </div>
        )}

        {canEdit && <StoreLogoUpload action={handleUploadLogo} />}
      </div>

      <div className="vehicle-form-card">
        <h2 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
          Identidade Visual e Contato
        </h2>

        {canEdit ? (
          <form action={handleUpdateSettings}>
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Cor primária
                </label>
                <StoreColorPicker defaultValue={s.cor_primaria ?? ""} />
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  Usada como cor de destaque no site público (CTA, links, preços).
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Telefone público
                </label>
                <input
                  type="text"
                  name="telefone_publico"
                  defaultValue={s.telefone_publico ?? ""}
                  className="input"
                  placeholder="+55 11 99999-0000"
                  maxLength={30}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Endereço
                </label>
                <input
                  type="text"
                  name="endereco"
                  defaultValue={s.endereco ?? ""}
                  className="input"
                  placeholder="Rua Exemplo, 123 — Cidade/UF"
                  maxLength={300}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Sobre a loja
                </label>
                <textarea
                  name="sobre"
                  defaultValue={s.sobre ?? ""}
                  className="input"
                  rows={4}
                  maxLength={1000}
                  placeholder="Conte um pouco sobre a loja para quem visita o site público."
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: "16px" }}>
              Salvar
            </button>
          </form>
        ) : (
          <div style={{ display: "grid", gap: "10px", fontSize: "13px" }}>
            <div><strong>Cor primária:</strong> {s.cor_primaria ?? "—"}</div>
            <div><strong>Telefone público:</strong> {s.telefone_publico ?? "—"}</div>
            <div><strong>Endereço:</strong> {s.endereco ?? "—"}</div>
            <div><strong>Sobre:</strong> {s.sobre ?? "—"}</div>
          </div>
        )}
      </div>
    </main>
  );
}
