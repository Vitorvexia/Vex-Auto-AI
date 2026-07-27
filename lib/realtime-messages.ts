import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Autor } from "@/types/domain";

export type ConversationMessage = {
  id: string;
  autor: Autor;
  mensagem: string;
  created_at: string;
};

export type RealtimeChannelStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

export type SubscribeCallbacks = {
  onInsert: (message: ConversationMessage) => void;
  onStatusChange: (status: RealtimeChannelStatus) => void;
};

/** Adiciona mensagem recebida via Realtime — dedupe por id, mantém ordem cronológica. */
export function appendIncomingMessage(
  current: ConversationMessage[],
  incoming: ConversationMessage
): ConversationMessage[] {
  if (current.some((m) => m.id === incoming.id)) return current;
  return [...current, incoming].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Assina INSERTs em `messages` filtrados por conversation_id.
 * Isolamento multi-tenant é garantido pela RLS (messages_own_store_select) aplicada
 * pelo Realtime — o filtro abaixo é otimização client-side, não é a fronteira de segurança
 * (ver migration 023 + tests/integration/realtime-isolation.test.ts).
 * Retorna função de cleanup que remove o canal — chamar no unmount / troca de conversa.
 */
export function subscribeToConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  callbacks: SubscribeCallbacks
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new: ConversationMessage }) => {
        callbacks.onInsert(payload.new);
      }
    )
    .subscribe((status: string) => {
      callbacks.onStatusChange(status as RealtimeChannelStatus);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
