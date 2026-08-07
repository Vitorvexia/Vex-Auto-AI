import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";

type AgendaLead = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  agendamento_data: string | null;
  agendamento_horario: string | null;
  contexto: { troca?: { modelo: string | null; ano: number | null } | null } | null;
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function formatDiaLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

type PageProps = {
  searchParams?: { dia?: string };
};

export default async function AgendaPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const hoje = toISODate(new Date());
  const dia = searchParams?.dia && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia) ? searchParams.dia : hoje;

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, phone_normalized, agendamento_data, agendamento_horario, contexto")
    .eq("agendamento_data", dia)
    .order("agendamento_horario", { ascending: true });

  const leads = (data ?? []) as AgendaLead[];

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agenda</h1>
          <div className="subtitle">Motos de troca agendadas para trazer na loja</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <Link href={`/agenda?dia=${addDays(dia, -1)}`} className="header-nav-link">← Dia anterior</Link>
        <strong style={{ textTransform: "capitalize" }}>{formatDiaLabel(dia)}</strong>
        <Link href={`/agenda?dia=${addDays(dia, 1)}`} className="header-nav-link">Próximo dia →</Link>
      </div>

      {error && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Erro ao carregar agenda: {error.message}</span>
        </div>
      )}

      {!error && leads.length === 0 ? (
        <div className="alert-item info">
          <span className="alert-icon">ℹ</span>
          <span>Nenhum agendamento para este dia.</span>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Horário</th>
              <th>Lead</th>
              <th>Telefone</th>
              <th>Moto de troca</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.agendamento_horario ?? "—"}</td>
                <td>{l.nome ?? "não informado"}</td>
                <td>{l.phone_normalized}</td>
                <td>
                  {l.contexto?.troca?.modelo
                    ? `${l.contexto.troca.modelo}${l.contexto.troca.ano ? " " + l.contexto.troca.ano : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
