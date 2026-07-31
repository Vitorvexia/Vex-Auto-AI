import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockClaim, mockRelease, mockRunAiPipeline } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockClaim: vi.fn(),
  mockRelease: vi.fn(),
  mockRunAiPipeline: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/pipeline-lock", () => ({
  claimConversationPipelineLock: mockClaim,
  releaseConversationPipelineLock: mockRelease,
  PIPELINE_LOCK_TTL_SECONDS: 20,
}));

vi.mock("@/lib/ai-pipeline", () => ({
  runAiPipeline: mockRunAiPipeline,
}));

import { dispatchAiPipeline } from "@/lib/pipeline-dispatch";

// ---------------------------------------------------------------------------
// Helpers de mock — cadeia do supabase pra cada uma das 2 sub-queries de
// getUnansweredIncomingText (última saida via maybeSingle, pendentes via array)
// ---------------------------------------------------------------------------

function lastSaidaChain(createdAt: string | null) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue({
    data: createdAt ? { created_at: createdAt } : null,
    error: null,
  });
  return c;
}

function pendingChain(rows: { mensagem: string; created_at: string }[]) {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.gt = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.then = (resolve: any, reject?: any) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return c;
}

const BASE_PARAMS = {
  storeId: "store-1",
  leadId: "lead-1",
  conversationId: "conv-1",
  isNewConversation: false,
};

beforeEach(() => {
  mockFrom.mockReset();
  mockClaim.mockReset();
  mockRelease.mockReset().mockResolvedValue(undefined);
  mockRunAiPipeline.mockReset();
});

describe("dispatchAiPipeline — claim negado", () => {
  it("claim falhou → retorna ran:false, runAiPipeline nunca é chamado", async () => {
    mockClaim.mockResolvedValue(false);

    const result = await dispatchAiPipeline(BASE_PARAMS);

    expect(result.ran).toBe(false);
    expect(result.results).toEqual([]);
    expect(mockRunAiPipeline).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

describe("dispatchAiPipeline — claim ganhou, 1 mensagem pendente", () => {
  it("roda pipeline 1x com o texto pendente e libera o lock", async () => {
    mockClaim.mockResolvedValue(true);
    mockFrom
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(pendingChain([{ mensagem: "Olá", created_at: "2026-07-30T10:00:00Z" }]))
      .mockReturnValueOnce(lastSaidaChain("2026-07-30T10:00:05Z"))
      .mockReturnValueOnce(pendingChain([]));
    mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

    const result = await dispatchAiPipeline(BASE_PARAMS);

    expect(mockRunAiPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunAiPipeline).toHaveBeenCalledWith({
      storeId: "store-1",
      leadId: "lead-1",
      conversationId: "conv-1",
      incomingText: "Olá",
      isNewConversation: false,
    });
    expect(result.ran).toBe(true);
    expect(result.results).toEqual([{ agent_status: "ok" }]);
    expect(mockRelease).toHaveBeenCalledWith("conv-1");
  });

  it("isNewConversation=true é propagado só na 1ª iteração", async () => {
    mockClaim.mockResolvedValue(true);
    mockFrom
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(pendingChain([{ mensagem: "Oi", created_at: "t1" }]))
      .mockReturnValueOnce(lastSaidaChain("t2"))
      .mockReturnValueOnce(pendingChain([]));
    mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

    await dispatchAiPipeline({ ...BASE_PARAMS, isNewConversation: true });

    expect(mockRunAiPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ isNewConversation: true })
    );
  });
});

describe("dispatchAiPipeline — concatenação de mensagens simultâneas", () => {
  it("2 mensagens não respondidas na mesma checagem viram 1 incoming_text só, 1 chamada de pipeline", async () => {
    mockClaim.mockResolvedValue(true);
    mockFrom
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(
        pendingChain([
          { mensagem: "Olá", created_at: "2026-07-30T10:00:00Z" },
          { mensagem: "boa noite", created_at: "2026-07-30T10:00:02Z" },
        ])
      )
      .mockReturnValueOnce(lastSaidaChain("2026-07-30T10:00:05Z"))
      .mockReturnValueOnce(pendingChain([]));
    mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

    const result = await dispatchAiPipeline(BASE_PARAMS);

    expect(mockRunAiPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunAiPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ incomingText: "Olá\nboa noite" })
    );
    expect(result.results).toEqual([{ agent_status: "ok" }]);
  });
});

describe("dispatchAiPipeline — dreno (mensagem chega durante o processamento)", () => {
  it("nova entrada aparece após a 1ª resposta → roda pipeline de novo (2x total), depois libera", async () => {
    mockClaim.mockResolvedValue(true);
    mockFrom
      // iteração 1
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(pendingChain([{ mensagem: "Olá", created_at: "t1" }]))
      // recheck pós-iteração 1: achou mensagem nova → dispara iteração 2
      .mockReturnValueOnce(lastSaidaChain("t-reply-1"))
      .mockReturnValueOnce(pendingChain([{ mensagem: "boa noite", created_at: "t2" }]))
      // recheck pós-iteração 2: nada mais pendente → para
      .mockReturnValueOnce(lastSaidaChain("t-reply-2"))
      .mockReturnValueOnce(pendingChain([]));
    mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

    const result = await dispatchAiPipeline(BASE_PARAMS);

    expect(mockRunAiPipeline).toHaveBeenCalledTimes(2);
    expect(mockRunAiPipeline).toHaveBeenNthCalledWith(1, expect.objectContaining({ incomingText: "Olá" }));
    expect(mockRunAiPipeline).toHaveBeenNthCalledWith(2, expect.objectContaining({ incomingText: "boa noite" }));
    expect(result.results).toHaveLength(2);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchAiPipeline — guarda contra loop apertado quando pipeline falha sem gerar resposta", () => {
  it("status sem reply produzida (timeout) não repete a mesma mensagem em loop — roda 1x e para", async () => {
    mockClaim.mockResolvedValue(true);
    // Só 1 par de chains: se o dispatch tentasse checar de novo com a MESMA
    // mensagem ainda pendente (nenhuma saida nova foi inserida no timeout),
    // um 3º mockFrom não configurado quebraria o teste — prova que não houve 2ª iteração.
    mockFrom
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(pendingChain([{ mensagem: "Olá", created_at: "t1" }]));
    mockRunAiPipeline.mockResolvedValue({ agent_status: "timeout", error: "runAgent: timeout excedido" });

    const result = await dispatchAiPipeline(BASE_PARAMS);

    expect(mockRunAiPipeline).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual([{ agent_status: "timeout", error: "runAgent: timeout excedido" }]);
    expect(mockRelease).toHaveBeenCalledWith("conv-1");
  });

  it.each(["parse_error", "output_error", "error", "skipped_handoff"] as const)(
    "status %s também não continua o dreno",
    async (status) => {
      mockClaim.mockResolvedValue(true);
      mockFrom
        .mockReturnValueOnce(lastSaidaChain(null))
        .mockReturnValueOnce(pendingChain([{ mensagem: "Olá", created_at: "t1" }]));
      mockRunAiPipeline.mockResolvedValue({ agent_status: status });

      await dispatchAiPipeline(BASE_PARAMS);

      expect(mockRunAiPipeline).toHaveBeenCalledTimes(1);
    }
  );
});

describe("dispatchAiPipeline — cap de iterações (defesa contra loop infinito)", () => {
  it("nunca ultrapassa o teto de iterações mesmo se sempre houver mensagem nova e status ok", async () => {
    mockClaim.mockResolvedValue(true);
    // Sempre retorna lastSaida + 1 pendente novo — simula fluxo interminável
    mockFrom.mockImplementation(() => {
      throw new Error("nunca deveria chamar .from diretamente neste mock");
    });
    let call = 0;
    mockFrom.mockImplementation((_table: string) => {
      call++;
      // alterna entre lastSaidaChain e pendingChain a cada chamada
      return call % 2 === 1 ? lastSaidaChain(`t${call}`) : pendingChain([{ mensagem: `msg${call}`, created_at: `t${call}` }]);
    });
    mockRunAiPipeline.mockResolvedValue({ agent_status: "ok" });

    await dispatchAiPipeline(BASE_PARAMS);

    // teto razoável — não pode rodar infinitamente dentro de 1 request
    expect(mockRunAiPipeline.mock.calls.length).toBeLessThanOrEqual(10);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchAiPipeline — lock sempre liberado", () => {
  it("libera o lock mesmo se runAiPipeline lançar exceção inesperada", async () => {
    mockClaim.mockResolvedValue(true);
    mockFrom
      .mockReturnValueOnce(lastSaidaChain(null))
      .mockReturnValueOnce(pendingChain([{ mensagem: "Olá", created_at: "t1" }]));
    mockRunAiPipeline.mockRejectedValue(new Error("erro inesperado"));

    await expect(dispatchAiPipeline(BASE_PARAMS)).rejects.toThrow("erro inesperado");
    expect(mockRelease).toHaveBeenCalledWith("conv-1");
  });
});
