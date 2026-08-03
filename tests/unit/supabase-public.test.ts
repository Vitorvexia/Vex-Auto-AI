/**
 * lib/supabase-public.ts — cliente da rota pública (site da loja, roadmap 1.3).
 * Decisão fechada nº 5: nunca service_role, sempre anon key. RLS/view-grant é
 * a segunda camada, não a única — a primeira é este cliente nunca ter
 * privilégio de bypass.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-value";
});

describe("createPublicSupabaseClient", () => {
  it("PUB-1: usa a anon key, nunca a service_role key", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-should-never-be-used";
    const { createPublicSupabaseClient } = await import("@/lib/supabase-public");

    createPublicSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key-value",
      expect.anything()
    );
    const usedKey = mockCreateClient.mock.calls[0][1];
    expect(usedKey).not.toBe("service-role-should-never-be-used");
  });

  it("PUB-2: não persiste sessão nem tenta refresh de token — rota é 100% anônima, sem cookie/usuário", async () => {
    const { createPublicSupabaseClient } = await import("@/lib/supabase-public");

    createPublicSupabaseClient();

    const options = mockCreateClient.mock.calls[0][2];
    expect(options.auth.persistSession).toBe(false);
    expect(options.auth.autoRefreshToken).toBe(false);
  });
});
