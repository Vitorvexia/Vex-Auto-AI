import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — variáveis usadas nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { WhatsAppSendError } from "@/lib/whatsapp-send";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockStoreQuery(result: { data: { whatsapp_phone_number_id: string | null } | null; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const STORE_ID = "store-uuid-001";
const PHONE_ID_DB = "111222333";
const PHONE_ID_ENV = "999888777";

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStoreWhatsAppPhoneId", () => {
  it("retorna phone_number_id do banco quando presente", async () => {
    mockStoreQuery({ data: { whatsapp_phone_number_id: PHONE_ID_DB }, error: null });

    const result = await getStoreWhatsAppPhoneId(STORE_ID);

    expect(result).toBe(PHONE_ID_DB);
    expect(mockFrom).toHaveBeenCalledWith("stores");
  });

  it("faz fallback para env var quando DB retorna null", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_ID_ENV;
    mockStoreQuery({ data: { whatsapp_phone_number_id: null }, error: null });

    const result = await getStoreWhatsAppPhoneId(STORE_ID);

    expect(result).toBe(PHONE_ID_ENV);
  });

  it("faz fallback para env var quando store não encontrado (data null)", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_ID_ENV;
    mockStoreQuery({ data: null, error: null });

    const result = await getStoreWhatsAppPhoneId(STORE_ID);

    expect(result).toBe(PHONE_ID_ENV);
  });

  it("lança WhatsAppSendError(auth_error, permanent) quando DB null e env ausente", async () => {
    mockStoreQuery({ data: { whatsapp_phone_number_id: null }, error: null });
    // env var não definida

    await expect(getStoreWhatsAppPhoneId(STORE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      category: "auth_error",
      isRetryable: false,
    });
  });

  it("lança WhatsAppSendError(auth_error, permanent) quando data null e env ausente", async () => {
    mockStoreQuery({ data: null, error: null });

    await expect(getStoreWhatsAppPhoneId(STORE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      category: "auth_error",
      isRetryable: false,
    });
  });

  it("lança WhatsAppSendError(service_error, retryable) quando query do banco falha", async () => {
    mockStoreQuery({ data: null, error: { message: "connection timeout" } });

    await expect(getStoreWhatsAppPhoneId(STORE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      category: "service_error",
      isRetryable: true,
    });
  });

  it("DB error tem precedência sobre env var (não tenta fallback)", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_ID_ENV;
    mockStoreQuery({ data: null, error: { message: "connection timeout" } });

    // Mesmo com env var, DB error deve lançar service_error
    await expect(getStoreWhatsAppPhoneId(STORE_ID)).rejects.toMatchObject({
      category: "service_error",
    });
  });

  it("prefere valor do banco sobre env var quando ambos presentes", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_ID_ENV;
    mockStoreQuery({ data: { whatsapp_phone_number_id: PHONE_ID_DB }, error: null });

    const result = await getStoreWhatsAppPhoneId(STORE_ID);

    expect(result).toBe(PHONE_ID_DB); // banco tem precedência
    expect(result).not.toBe(PHONE_ID_ENV);
  });

  it("string vazia no banco ('') lança auth_error — empty string é tratado como ausente", async () => {
    mockStoreQuery({ data: { whatsapp_phone_number_id: "" }, error: null });

    await expect(getStoreWhatsAppPhoneId(STORE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      category: "auth_error",
      isRetryable: false,
    });
  });
});
