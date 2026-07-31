import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockFrom, mockGetServerUserRole, mockCaptureException } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetServerUserRole: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/auth", () => ({
  getServerUserRole: mockGetServerUserRole,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

import { logAudit } from "@/lib/audit";

function mockInsert(result: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(result);
  mockFrom.mockReturnValue({ insert });
  return insert;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerUserRole.mockResolvedValue("dono_loja");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("logAudit", () => {
  it("A1: insere em audit_logs com store_id/user_id/actor_role/action/resource_type/resource_id/metadata corretos", async () => {
    const insert = mockInsert();

    await logAudit({
      storeId: "store-1",
      userId: "user-1",
      action: "lead.reassigned",
      resourceType: "lead",
      resourceId: "lead-1",
      metadata: { previous_assigned_to: null, new_assigned_to: "user-2" },
    });

    expect(mockFrom).toHaveBeenCalledWith("audit_logs");
    expect(insert).toHaveBeenCalledWith({
      store_id: "store-1",
      user_id: "user-1",
      actor_role: "dono_loja",
      action: "lead.reassigned",
      resource_type: "lead",
      resource_id: "lead-1",
      metadata: { previous_assigned_to: null, new_assigned_to: "user-2" },
    });
  });

  it("A2: userId null → actor_role null, getServerUserRole NÃO é chamado", async () => {
    const insert = mockInsert();

    await logAudit({
      storeId: "store-1",
      userId: null,
      action: "lead.closed",
      resourceType: "lead",
      resourceId: "lead-1",
    });

    expect(mockGetServerUserRole).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, actor_role: null })
    );
  });

  it("A3: metadata omitido → grava null", async () => {
    const insert = mockInsert();

    await logAudit({
      storeId: "store-1",
      userId: "user-1",
      action: "user.created",
      resourceType: "user",
      resourceId: "user-2",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: null })
    );
  });

  it("A4: insert falha → não lança, chama Sentry.captureException", async () => {
    mockInsert({ error: { message: "insert failed" } });

    await expect(
      logAudit({
        storeId: "store-1",
        userId: "user-1",
        action: "lead.reassigned",
        resourceType: "lead",
        resourceId: "lead-1",
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, ctx] = mockCaptureException.mock.calls[0] as [unknown, { tags: { pipeline_stage: string } }];
    expect(ctx.tags.pipeline_stage).toBe("audit_log");
  });

  it("A5: getServerUserRole lança (ex: usuário órfão) → não propaga, chama Sentry.captureException", async () => {
    mockGetServerUserRole.mockRejectedValue(new Error("StoreNotFoundError"));
    mockInsert();

    await expect(
      logAudit({
        storeId: "store-1",
        userId: "user-orphan",
        action: "lead.reassigned",
        resourceType: "lead",
        resourceId: "lead-1",
      })
    ).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
