import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { relativeTime, scoreClass } from "@/lib/format";
import {
  OPEN_CONVERSATION_STATUSES,
  type LeadStatus,
} from "@/types/domain";

// Sempre buscar dados frescos do banco
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLUMNS: LeadStatus[] = [
  "NOVO",
  "ENGAJADO",
  "INTERESSADO",
  "QUENTE",
  "NEGOCIACAO",
];

type Enriched = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  score: number;
  lead_status: LeadStatus;
  conversation_id?: string;
  ultima_atividade: string;
};

export default async function LeadsPage() {
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select(
      `id, nome, phone_normalized, score, lead_status, updated_at,
       conversations ( id, ultima_mensagem_em, conversation_status )`
    )
    .in("lead_status", COLUMNS);

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar leads: {error.message}</div>
      </main>
    );
  }

  // Achata conversation aberta + define ultima atividade
  const enriched: Enriched[] = (leads ?? []).map((l: any) => {
    const openConv = (l.conversations ?? []).find((c: any) =>
      OPEN_CONVERSATION_STATUSES.includes(c.conversation_status)
    );
    return {
      id: l.id,
      nome: l.nome,
      phone_normalized: l.phone_normalized,
      score: l.score,
      lead_status: l.lead_status as LeadStatus,
      conversation_id: openConv?.id,
      ultima_atividade: openConv?.ultima_mensagem_em ?? l.updated_at,
    };
  });

  // Ordem por ultima interacao (mais recente primeiro)
  enriched.sort(
    (a, b) =>
      new Date(b.ultima_atividade).getTime() -
      new Date(a.ultima_atividade).getTime()
  );

  const byStatus: Record<LeadStatus, Enriched[]> = {
    NOVO: [],
    ENGAJADO: [],
    INTERESSADO: [],
    QUENTE: [],
    NEGOCIACAO: [],
    FECHADO: [],
    PERDIDO: [],
  };
  enriched.forEach((l) => byStatus[l.lead_status].push(l));

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <div className="subtitle">
            {enriched.length} {enriched.length === 1 ? "lead" : "leads"} em atendimento
          </div>
        </div>
      </div>

      <div className="kanban">
        {COLUMNS.map((status) => {
          const items = byStatus[status];
          return (
            <div key={status} className="column" data-status={status}>
              <div className="column-header">
                <div className="column-title">{status}</div>
                <div className="column-count">{items.length}</div>
              </div>

              {items.length === 0 && <div className="empty">Nenhum lead</div>}

              {items.map((l) => {
                const href = l.conversation_id
                  ? `/conversations/${l.conversation_id}`
                  : "#";
                return (
                  <Link key={l.id} href={href} className="card">
                    <div className="card-top">
                      <div className="card-name">{l.nome ?? "Sem nome"}</div>
                      <div className={`score-badge ${scoreClass(l.score)}`}>
                        {l.score}
                      </div>
                    </div>
                    <div className="card-phone">{l.phone_normalized}</div>
                    <div className="card-time">
                      {relativeTime(l.ultima_atividade)}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </main>
  );
}
