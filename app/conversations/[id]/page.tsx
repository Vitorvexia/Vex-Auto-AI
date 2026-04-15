import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import type { Autor } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorLabel(autor: Autor): string {
  switch (autor) {
    case "lead":
      return "Lead";
    case "ia":
      return "IA";
    case "humano":
      return "Vendedor";
    case "sistema":
      return "Sistema";
  }
}

function rowSide(autor: Autor): "left" | "right" | "center" {
  if (autor === "lead") return "left";
  if (autor === "sistema") return "center";
  return "right";
}

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: conv, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `id, conversation_status, handoff_to, summary, iniciada_em, ultima_mensagem_em,
       leads ( id, nome, phone_normalized, lead_status, score ),
       messages ( id, direcao, autor, mensagem, created_at )`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar conversa: {error.message}</div>
      </main>
    );
  }

  if (!conv) notFound();

  const lead = Array.isArray(conv.leads) ? conv.leads[0] : (conv.leads as any);
  const messages = (conv.messages ?? []).slice().sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <main className="container">
      <Link href="/leads" className="back-link">
        ← voltar para leads
      </Link>

      <div className="inbox-header">
        <div className="inbox-lead-name">{lead?.nome ?? "Sem nome"}</div>
        <div className="inbox-lead-meta">
          <span>{lead?.phone_normalized}</span>
          <span>·</span>
          <span className="pill">{lead?.lead_status}</span>
          <span className="pill">score {lead?.score}</span>
          <span>·</span>
          <span>
            conversa {conv.conversation_status} · atendida por {conv.handoff_to}
          </span>
        </div>
      </div>

      <div className="chat">
        {messages.length === 0 && (
          <div className="empty">Nenhuma mensagem ainda</div>
        )}

        {messages.map((m: any) => {
          const autor = m.autor as Autor;
          const side = rowSide(autor);
          return (
            <div key={m.id} className={`msg-row ${side}`}>
              <div className="msg-author">{authorLabel(autor)}</div>
              <div className={`msg-bubble ${autor}`}>{m.mensagem}</div>
              <div className="msg-time">{formatDateTime(m.created_at)}</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
