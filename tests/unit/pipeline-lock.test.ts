import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));

import {
  claimConversationPipelineLock,
  releaseConversationPipelineLock,
  PIPELINE_LOCK_TTL_SECONDS,
} from "@/lib/pipeline-lock";

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe("claimConversationPipelineLock", () => {
  it("retorna true quando o RPC confirma claim (lock livre ou expirado)", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await claimConversationPipelineLock("conv-1");

    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("claim_conversation_pipeline_lock", {
      p_conversation_id: "conv-1",
      p_ttl_seconds: PIPELINE_LOCK_TTL_SECONDS,
    });
  });

  it("retorna false quando o RPC nega claim (outro processo já detém o lock)", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await claimConversationPipelineLock("conv-1");

    expect(result).toBe(false);
  });

  it("aceita TTL customizado explícito", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await claimConversationPipelineLock("conv-1", 5);

    expect(mockRpc).toHaveBeenCalledWith("claim_conversation_pipeline_lock", {
      p_conversation_id: "conv-1",
      p_ttl_seconds: 5,
    });
  });

  it("propaga erro do RPC (falha de infra não deve ser silenciosamente tratada como claim negado)", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB offline" } });

    await expect(claimConversationPipelineLock("conv-1")).rejects.toThrow();
  });
});

describe("releaseConversationPipelineLock", () => {
  it("faz UPDATE setando pipeline_locked_at para null filtrado pelo conversation_id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    await releaseConversationPipelineLock("conv-1");

    expect(mockFrom).toHaveBeenCalledWith("conversations");
    expect(updateMock).toHaveBeenCalledWith({ pipeline_locked_at: null });
    expect(eqMock).toHaveBeenCalledWith("id", "conv-1");
  });

  it("não lança mesmo se o UPDATE falhar (release é best-effort — TTL recupera lock órfão)", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: { message: "DB offline" } });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ update: updateMock });

    await expect(releaseConversationPipelineLock("conv-1")).resolves.not.toThrow();
  });
});
