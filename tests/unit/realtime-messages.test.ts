import { describe, it, expect, vi } from "vitest";
import {
  appendIncomingMessage,
  subscribeToConversationMessages,
  type ConversationMessage,
} from "@/lib/realtime-messages";

// ---------------------------------------------------------------------------
// Mock de SupabaseClient — só a superfície usada por subscribeToConversationMessages
// (channel/on/subscribe/removeChannel). Cada canal simulado expõe helpers pra
// disparar os callbacks registrados (_emitInsert/_emitStatus), simulando eventos
// reais do Realtime sem precisar de rede.
// ---------------------------------------------------------------------------

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "msg-1",
    autor: "lead",
    mensagem: "oi",
    created_at: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

function createMockSupabase() {
  const removeChannel = vi.fn();
  const channels: any[] = [];

  const channel = vi.fn((name: string) => {
    let insertHandler: ((payload: { new: ConversationMessage }) => void) | null = null;
    let statusHandler: ((status: string) => void) | null = null;
    let lastFilter: any = null;

    const channelObj: any = {
      name,
      on: vi.fn((event: string, filter: any, cb: any) => {
        lastFilter = filter;
        if (event === "postgres_changes") insertHandler = cb;
        return channelObj;
      }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        statusHandler = cb;
        return channelObj;
      }),
      get filter() {
        return lastFilter;
      },
      _emitInsert: (message: ConversationMessage) => insertHandler?.({ new: message }),
      _emitStatus: (status: string) => statusHandler?.(status),
    };
    channels.push(channelObj);
    return channelObj;
  });

  const supabase = { channel, removeChannel } as any;
  return { supabase, channel, removeChannel, channels };
}

// ---------------------------------------------------------------------------
// appendIncomingMessage — dedupe + ordem
// ---------------------------------------------------------------------------

describe("appendIncomingMessage", () => {
  it("adiciona mensagem nova ao final (ordenada por created_at)", () => {
    const current = [makeMsg({ id: "a", created_at: "2026-07-27T10:00:00.000Z" })];
    const result = appendIncomingMessage(
      current,
      makeMsg({ id: "b", created_at: "2026-07-27T10:05:00.000Z" })
    );

    expect(result.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("reordena se a mensagem chega fora de ordem cronológica", () => {
    const current = [makeMsg({ id: "a", created_at: "2026-07-27T10:05:00.000Z" })];
    const result = appendIncomingMessage(
      current,
      makeMsg({ id: "b", created_at: "2026-07-27T10:00:00.000Z" })
    );

    expect(result.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("dedupe: mensagem com id já existente não duplica", () => {
    const current = [makeMsg({ id: "a" })];
    const result = appendIncomingMessage(current, makeMsg({ id: "a" }));

    expect(result).toHaveLength(1);
  });

  it("não muta o array original (imutabilidade)", () => {
    const current = [makeMsg({ id: "a" })];
    const result = appendIncomingMessage(current, makeMsg({ id: "b" }));

    expect(current).toHaveLength(1);
    expect(result).not.toBe(current);
  });
});

// ---------------------------------------------------------------------------
// subscribeToConversationMessages — wiring do canal
// ---------------------------------------------------------------------------

describe("subscribeToConversationMessages", () => {
  it("assina INSERT em messages filtrado por conversation_id", () => {
    const { supabase, channel, channels } = createMockSupabase();

    subscribeToConversationMessages(supabase, "conv-123", {
      onInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(channel).toHaveBeenCalledWith("messages:conv-123");
    expect(channels[0].filter).toEqual(
      expect.objectContaining({
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: "conversation_id=eq.conv-123",
      })
    );
  });

  it("mensagem inserida no banco chega no onInsert sem re-fetch", () => {
    const { supabase, channels } = createMockSupabase();
    const onInsert = vi.fn();

    subscribeToConversationMessages(supabase, "conv-123", {
      onInsert,
      onStatusChange: vi.fn(),
    });

    const incoming = makeMsg({ id: "new-msg" });
    channels[0]._emitInsert(incoming);

    expect(onInsert).toHaveBeenCalledWith(incoming);
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it("propaga status do canal (SUBSCRIBED, CHANNEL_ERROR, etc)", () => {
    const { supabase, channels } = createMockSupabase();
    const onStatusChange = vi.fn();

    subscribeToConversationMessages(supabase, "conv-123", {
      onInsert: vi.fn(),
      onStatusChange,
    });

    channels[0]._emitStatus("SUBSCRIBED");
    channels[0]._emitStatus("CHANNEL_ERROR");

    expect(onStatusChange).toHaveBeenNthCalledWith(1, "SUBSCRIBED");
    expect(onStatusChange).toHaveBeenNthCalledWith(2, "CHANNEL_ERROR");
  });

  it("cleanup (unsubscribe) remove o canal — sem vazar conexão", () => {
    const { supabase, removeChannel, channels } = createMockSupabase();

    const unsubscribe = subscribeToConversationMessages(supabase, "conv-123", {
      onInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(removeChannel).not.toHaveBeenCalled();
    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channels[0]);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("trocar de conversa encerra o canal antigo antes de abrir o novo — não duplica assinatura", () => {
    const { supabase, channel, removeChannel, channels } = createMockSupabase();

    const unsubscribeA = subscribeToConversationMessages(supabase, "conv-A", {
      onInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    // Simula o useEffect cleanup do React ao trocar conversationId.
    unsubscribeA();
    const unsubscribeB = subscribeToConversationMessages(supabase, "conv-B", {
      onInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(channel).toHaveBeenCalledTimes(2);
    expect(channel).toHaveBeenNthCalledWith(1, "messages:conv-A");
    expect(channel).toHaveBeenNthCalledWith(2, "messages:conv-B");
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channels[0]);

    // Não deve haver assinatura pendente pra conv-A: só o canal B segue vivo.
    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenLastCalledWith(channels[1]);
  });
});
