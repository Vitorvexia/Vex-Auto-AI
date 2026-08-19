import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { buildMonthGrid, addMonths, monthRange } from "@/lib/agenda-calendar";

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

function formatDiaLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function formatMesLabel(monthISO: string): string {
  const d = new Date(`${monthISO}-01T00:00:00.000Z`);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type PageProps = {
  searchParams?: { mes?: string; dia?: string };
};

export default async function AgendaPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const hoje = toISODate(new Date());
  const mes = searchParams?.mes && /^\d{4}-\d{2}$/.test(searchParams.mes) ? searchParams.mes : hoje.slice(0, 7);
  const dia = searchParams?.dia && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia) ? searchParams.dia : hoje;

  const { start, end } = monthRange(mes);

  const [monthRes, dayRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, nome, agendamento_data, agendamento_horario")
      .gte("agendamento_data", start)
      .lte("agendamento_data", end)
      .order("agendamento_horario", { ascending: true }),
    supabase
      .from("leads")
      .select("id, nome, phone_normalized, agendamento_data, agendamento_horario, contexto")
      .eq("agendamento_data", dia)
      .order("agendamento_horario", { ascending: true }),
  ]);

  const monthLeads = (monthRes.data ?? []) as Pick<AgendaLead, "id" | "nome" | "agendamento_data" | "agendamento_horario">[];
  const dayLeads = (dayRes.data ?? []) as AgendaLead[];

  const leadsByDay = new Map<string, typeof monthLeads>();
  for (const l of monthLeads) {
    if (!l.agendamento_data) continue;
    const list = leadsByDay.get(l.agendamento_data) ?? [];
    list.push(l);
    leadsByDay.set(l.agendamento_data, list);
  }

  const grid = buildMonthGrid(mes, hoje);
  const error = monthRes.error ?? dayRes.error;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agenda</h1>
          <div className="subtitle">Motos de troca agendadas para trazer na loja</div>
        </div>
      </div>

      {error && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Erro ao carregar agenda: {error.message}</span>
        </div>
      )}

      <div className="agenda-cal">
        <div className="agenda-cal-head">
          <Link href={`/agenda?mes=${addMonths(mes, -1)}&dia=${dia}`} className="agenda-cal-nav">←</Link>
          <strong className="agenda-cal-title">{formatMesLabel(mes)}</strong>
          <Link href={`/agenda?mes=${addMonths(mes, 1)}&dia=${dia}`} className="agenda-cal-nav">→</Link>
        </div>

        <div className="agenda-cal-weekdays">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="agenda-cal-weekday">{d}</div>
          ))}
        </div>

        <div className="agenda-cal-grid">
          {grid.flat().map((cell) => {
            const cellLeads = leadsByDay.get(cell.date) ?? [];
            const isSelected = cell.date === dia;
            return (
              <Link
                key={cell.date}
                href={`/agenda?mes=${mes}&dia=${cell.date}`}
                className={`agenda-cal-day${cell.inMonth ? "" : " outside"}${cell.isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              >
                <span className="agenda-cal-day-num">{Number(cell.date.slice(8, 10))}</span>
                {cellLeads.length > 0 && (
                  <div className="agenda-cal-chips">
                    {cellLeads.slice(0, 2).map((l) => (
                      <span key={l.id} className="agenda-cal-chip">
                        {l.agendamento_horario ? `${l.agendamento_horario} ` : ""}{l.nome ?? "lead"}
                      </span>
                    ))}
                    {cellLeads.length > 2 && (
                      <span className="agenda-cal-chip-more">+{cellLeads.length - 2}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ margin: "20px 0 12px" }}>
        <strong style={{ textTransform: "capitalize" }}>{formatDiaLabel(dia)}</strong>
      </div>

      {!error && dayLeads.length === 0 ? (
        <div className="alert-item info">
          <span className="alert-icon">ℹ</span>
          <span>Nenhum agendamento para este dia.</span>
        </div>
      ) : (
        <div className="section-card">
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
            {dayLeads.map((l) => (
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
        </div>
      )}
    </main>
  );
}
