"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  appendIncomingMessage,
  subscribeToConversationMessages,
  type ConversationMessage,
} from "@/lib/realtime-messages";
import { MessageBubble } from "@/app/components/MessageBubble";

type Props = {
  conversationId: string;
  initialMessages: ConversationMessage[];
};

export function ConversationMessages({ conversationId, initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [reconnecting, setReconnecting] = useState(false);
  const everConnectedRef = useRef(false);

  // Conversa trocou — o Server Component já buscou o histórico novo, sincroniza.
  useEffect(() => {
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    everConnectedRef.current = false;
    setReconnecting(false);

    let cancelled = false;
    let unsubscribeChannel: (() => void) | null = null;

    // O client de Realtime não herda o JWT da sessão automaticamente — sem
    // repassar via setAuth, a policy de RLS nunca resolve auth.uid() e o canal
    // fica mudo pra qualquer store, incluindo a própria (validado em produção,
    // ver tests/integration/realtime-isolation.test.ts). Reaplica a cada refresh
    // de token pra não morrer silenciosamente em conversas abertas por mais de 1h.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      unsubscribeChannel = subscribeToConversationMessages(supabase, conversationId, {
        onInsert: (message) => setMessages((prev) => appendIncomingMessage(prev, message)),
        onStatusChange: (status) => {
          if (status === "SUBSCRIBED") {
            everConnectedRef.current = true;
            setReconnecting(false);
          } else if (everConnectedRef.current) {
            setReconnecting(true);
          }
        },
      });
    });

    return () => {
      cancelled = true;
      unsubscribeChannel?.();
      authListener.subscription.unsubscribe();
    };
  }, [conversationId]);

  return (
    <div className="chat">
      {reconnecting && <div className="chat-reconnecting">Reconectando…</div>}
      {messages.length === 0 && <div className="empty">Nenhuma mensagem ainda</div>}
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          id={m.id}
          autor={m.autor}
          mensagem={m.mensagem}
          created_at={m.created_at}
        />
      ))}
    </div>
  );
}
