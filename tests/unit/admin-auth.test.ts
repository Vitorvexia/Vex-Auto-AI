import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockCreateClient, mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  // redirect() em Next.js lança internamente — mock deve fazer o mesmo
  mockRedirect: vi.fn().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: mockCreateClient,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { assertSuperAdmin } from "@/lib/admin-auth";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const USER_ID = "user-super-admin-id";
const ADMIN_EMAIL = "vlinceira@gmail.com";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  });
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: ADMIN_EMAIL } },
    error: null,
  });
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAILS;
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("assertSuperAdmin", () => {
  it("email na ADMIN_EMAILS → autorizado, retorna user.id", async () => {
    const result = await assertSuperAdmin();

    expect(result).toBe(USER_ID);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("email NOT na ADMIN_EMAILS → redirect('/leads')", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: "intruso@x.com" } },
      error: null,
    });

    await expect(assertSuperAdmin()).rejects.toThrow("redirect:/leads");
    expect(mockRedirect).toHaveBeenCalledWith("/leads");
  });

  it("ADMIN_EMAILS vazia → todos bloqueados", async () => {
    process.env.ADMIN_EMAILS = "";

    await expect(assertSuperAdmin()).rejects.toThrow("redirect:/leads");
    expect(mockRedirect).toHaveBeenCalledWith("/leads");
  });

  it("ADMIN_EMAILS com espaços extras → trim, autoriza", async () => {
    process.env.ADMIN_EMAILS = `  ${ADMIN_EMAIL}  `;

    const result = await assertSuperAdmin();

    expect(result).toBe(USER_ID);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("getUser retorna error → redirect('/login')", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("session expired"),
    });

    await expect(assertSuperAdmin()).rejects.toThrow("redirect:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("getUser retorna user null → redirect('/login')", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(assertSuperAdmin()).rejects.toThrow("redirect:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
