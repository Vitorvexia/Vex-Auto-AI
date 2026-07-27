// @vitest-environment jsdom
/**
 * Investigação: flakiness residual de RT-2a (tests/integration/realtime-isolation.test.ts)
 * levantou a hipótese de que trocar de conversa no browser (unsubscribe canal A →
 * subscribe canal B em sequência rápida) poderia reproduzir a mesma race —
 * canal novo mudo intermitente.
 *
 * Achado da investigação (ver DL-0005 em docs/vex/29_DECISIONS_LOG.md): a hipótese
 * NÃO se confirma. `ConversationMessages` cria um `createSupabaseBrowserClient()`
 * NOVO dentro do efeito a cada troca de `conversationId` — cada conversa tem seu
 * próprio client/socket isolado. RT-2a reusava o MESMO client (`userA.client`)
 * entre dois `it()` sequenciais, o que o componente de produção nunca faz.
 *
 * Este teste trava esse invariante: cada troca de conversationId usa um client
 * (logo um socket) diferente do anterior, o canal antigo é encerrado, e nada
 * vaza — nem durante a troca, nem no unmount final.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, act } from "@testing-library/react";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}));

vi.mock("@/lib/supabase-browser", () => ({
  createSupabaseBrowserClient: mockCreateClient,
}));

import { ConversationMessages } from "@/app/components/ConversationMessages";

type MockChannel = {
  name: string;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

type MockClient = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
  };
  realtime: { setAuth: ReturnType<typeof vi.fn> };
  channel: ReturnType<typeof vi.fn>;
  removeChannel: ReturnType<typeof vi.fn>;
  channels: MockChannel[];
};

function createMockSupabaseClient(): MockClient {
  const channels: MockChannel[] = [];
  const client: MockClient = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    realtime: { setAuth: vi.fn() },
    channel: vi.fn((name: string) => {
      const channelObj: MockChannel = {
        name,
        on: vi.fn(() => channelObj),
        subscribe: vi.fn(() => channelObj),
      };
      channels.push(channelObj);
      return channelObj;
    }),
    removeChannel: vi.fn(),
    channels,
  };
  return client;
}

async function flush() {
  // deixa a cadeia getSession().then(...) (microtasks) assentar antes de assert.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConversationMessages — troca de conversa (client/socket isolado por conversationId)", () => {
  it("cada conversationId novo cria um client (socket) próprio — nunca reaproveita o anterior", async () => {
    const createdClients: MockClient[] = [];
    mockCreateClient.mockImplementation(() => {
      const c = createMockSupabaseClient();
      createdClients.push(c);
      return c;
    });

    const { rerender, unmount } = render(
      createElement(ConversationMessages, { conversationId: "conv-A", initialMessages: [] })
    );
    await flush();

    expect(createdClients).toHaveLength(1);
    expect(createdClients[0].channel).toHaveBeenCalledWith("messages:conv-A");

    rerender(createElement(ConversationMessages, { conversationId: "conv-B", initialMessages: [] }));
    await flush();

    // Client B é uma instância NOVA — não é o mesmo objeto do client A.
    expect(createdClients).toHaveLength(2);
    expect(createdClients[1]).not.toBe(createdClients[0]);
    expect(createdClients[1].channel).toHaveBeenCalledWith("messages:conv-B");

    unmount();
  });

  it("troca de conversa encerra o canal antigo (client A) — não fica pendurado", async () => {
    const createdClients: MockClient[] = [];
    mockCreateClient.mockImplementation(() => {
      const c = createMockSupabaseClient();
      createdClients.push(c);
      return c;
    });

    const { rerender, unmount } = render(
      createElement(ConversationMessages, { conversationId: "conv-A", initialMessages: [] })
    );
    await flush();

    const clientA = createdClients[0];
    expect(clientA.removeChannel).not.toHaveBeenCalled();

    rerender(createElement(ConversationMessages, { conversationId: "conv-B", initialMessages: [] }));
    await flush();

    // Canal de conv-A foi removido no client A — isolado, não afeta o client B.
    expect(clientA.removeChannel).toHaveBeenCalledTimes(1);
    expect(clientA.removeChannel).toHaveBeenCalledWith(clientA.channels[0]);

    unmount();
  });

  it("unmount final também encerra o canal ativo — sem vazar assinatura", async () => {
    const createdClients: MockClient[] = [];
    mockCreateClient.mockImplementation(() => {
      const c = createMockSupabaseClient();
      createdClients.push(c);
      return c;
    });

    const { unmount } = render(
      createElement(ConversationMessages, { conversationId: "conv-A", initialMessages: [] })
    );
    await flush();

    const clientA = createdClients[0];
    expect(clientA.removeChannel).not.toHaveBeenCalled();

    unmount();

    expect(clientA.removeChannel).toHaveBeenCalledTimes(1);
    expect(clientA.removeChannel).toHaveBeenCalledWith(clientA.channels[0]);
  });

  it("troca rápida (3 conversas em sequência, um clique por vez) não deixa client velho subscrito por engano", async () => {
    const createdClients: MockClient[] = [];
    mockCreateClient.mockImplementation(() => {
      const c = createMockSupabaseClient();
      createdClients.push(c);
      return c;
    });

    // Cada rerender aqui simula um clique real (evento separado, sempre há
    // yield de task entre um clique e outro) — troca A -> B -> C.
    const { rerender, unmount } = render(
      createElement(ConversationMessages, { conversationId: "conv-A", initialMessages: [] })
    );
    await flush();

    rerender(createElement(ConversationMessages, { conversationId: "conv-B", initialMessages: [] }));
    await flush();

    rerender(createElement(ConversationMessages, { conversationId: "conv-C", initialMessages: [] }));
    await flush();

    expect(createdClients).toHaveLength(3);
    expect(createdClients[0].removeChannel).toHaveBeenCalledTimes(1);
    expect(createdClients[1].removeChannel).toHaveBeenCalledTimes(1);
    expect(createdClients[2].removeChannel).not.toHaveBeenCalled();
    expect(createdClients[2].channel).toHaveBeenCalledWith("messages:conv-C");

    unmount();
    expect(createdClients[2].removeChannel).toHaveBeenCalledTimes(1);
  });

  it("troca no MESMO task (zero yield) — guard `cancelled` evita client intermediário abrir canal à toa (nada pra vazar)", async () => {
    const createdClients: MockClient[] = [];
    mockCreateClient.mockImplementation(() => {
      const c = createMockSupabaseClient();
      createdClients.push(c);
      return c;
    });

    const { rerender, unmount } = render(
      createElement(ConversationMessages, { conversationId: "conv-A", initialMessages: [] })
    );
    // Sem await entre as trocas — cenário mais agressivo que qualquer clique
    // real (que sempre tem um turno de evento próprio) pode produzir.
    rerender(createElement(ConversationMessages, { conversationId: "conv-B", initialMessages: [] }));
    rerender(createElement(ConversationMessages, { conversationId: "conv-C", initialMessages: [] }));
    await flush();

    // Client final (C) sempre fica ativo e sem removeChannel chamado.
    const last = createdClients[createdClients.length - 1];
    expect(last.channel).toHaveBeenCalledWith("messages:conv-C");
    expect(last.removeChannel).not.toHaveBeenCalled();

    // Invariante real (não "cada client removeu 1x"): nenhum client que
    // chegou a assinar (channel() chamado) fica sem cleanup, exceto o último.
    for (const c of createdClients.slice(0, -1)) {
      if (c.channel.mock.calls.length > 0) {
        expect(c.removeChannel).toHaveBeenCalledTimes(1);
      }
    }

    unmount();
    expect(last.removeChannel).toHaveBeenCalledTimes(1);
  });
});
