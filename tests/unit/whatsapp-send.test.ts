import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppMessage, WhatsAppSendError, PERMANENT_CATEGORIES } from "@/lib/whatsapp-send";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk() {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ messages: [{ id: "wamid.abc123" }] }), {
      status: 200,
    })
  );
}

function mockFetchError(status: number, message?: string) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: { message: message ?? "error" } }),
      { status }
    )
  );
}

function mockFetchNetworkError() {
  return vi
    .spyOn(global, "fetch")
    .mockRejectedValueOnce(new TypeError("fetch failed"));
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const ENV_VARS = {
  WHATSAPP_ACCESS_TOKEN: "test-token",
};

const TEST_PHONE_ID = "123456789";

beforeEach(() => {
  Object.entries(ENV_VARS).forEach(([k, v]) => (process.env[k] = v));
});

afterEach(() => {
  Object.keys(ENV_VARS).forEach((k) => delete process.env[k]);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendWhatsAppMessage", () => {
  it("chama WA API com payload correto e resolve sem erro", async () => {
    const spy = mockFetchOk();

    await sendWhatsAppMessage("+5511999990000", "Olá, tudo bem?", TEST_PHONE_ID);

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("/123456789/messages");
    expect(url).toContain("v21.0");

    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("5511999990000"); // + removido
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Olá, tudo bem?");
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.recipient_type).toBe("individual");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("strip '+' do número antes de enviar", async () => {
    const spy = mockFetchOk();
    await sendWhatsAppMessage("+5511987654321", "oi", TEST_PHONE_ID);
    const body = JSON.parse((spy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.to).toBe("5511987654321");
  });

  it("número sem '+' passa sem modificação", async () => {
    const spy = mockFetchOk();
    await sendWhatsAppMessage("5511987654321", "oi", TEST_PHONE_ID);
    const body = JSON.parse((spy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.to).toBe("5511987654321");
  });

  it("lança WhatsAppSendError com statusCode em resposta HTTP não-2xx", async () => {
    mockFetchError(400, "invalid phone number");

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 400,
      message: expect.stringContaining("400"),
    });
  });

  it("lança WhatsAppSendError em 401 (token inválido)", async () => {
    mockFetchError(401, "Invalid OAuth access token");

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 401,
    });
  });

  it("propaga erro de rede como exceção não-WhatsAppSendError", async () => {
    mockFetchNetworkError();

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toThrow(TypeError);
  });

  it("lança WhatsAppSendError quando WHATSAPP_ACCESS_TOKEN ausente", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
    });
  });

  it("lança WhatsAppSendError quando phoneNumberId é string vazia", async () => {
    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", "")
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
    });
  });

  it("trunca texto em 4096 chars com reticências", async () => {
    const spy = mockFetchOk();
    const longText = "a".repeat(5000);
    await sendWhatsAppMessage("+5511999990000", longText, TEST_PHONE_ID);
    const body = JSON.parse((spy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text.body).toHaveLength(4096);
    expect(body.text.body.endsWith("...")).toBe(true);
    expect(body.text.body.startsWith("a")).toBe(true);
  });

  it("texto com exatamente 4096 chars não é truncado", async () => {
    const spy = mockFetchOk();
    const exactText = "b".repeat(4096);
    await sendWhatsAppMessage("+5511999990000", exactText, TEST_PHONE_ID);
    const body = JSON.parse((spy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text.body).toHaveLength(4096);
    expect(body.text.body.endsWith("...")).toBe(false);
  });

  it("usa WHATSAPP_API_VERSION env var quando definida", async () => {
    process.env.WHATSAPP_API_VERSION = "v22.0";
    const spy = mockFetchOk();
    await sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID);
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("v22.0");
    expect(url).not.toContain("v21.0");
    delete process.env.WHATSAPP_API_VERSION;
  });

  it("usa v21.0 como padrão quando WHATSAPP_API_VERSION não definida", async () => {
    delete process.env.WHATSAPP_API_VERSION;
    const spy = mockFetchOk();
    await sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID);
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("v21.0");
  });

  it("lança WhatsAppSendError sem detalhe quando corpo do erro não é JSON válido", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 500,
      message: expect.stringContaining("500"),
    });
  });

  it("lança WhatsAppSendError quando resposta de erro não tem campo error.message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 190 }), { status: 401 })
    );

    await expect(
      sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)
    ).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 401,
      message: "WhatsApp API retornou 401",
    });
  });
});

// ---------------------------------------------------------------------------
// Error classification — category + isRetryable
// ---------------------------------------------------------------------------

describe("sendWhatsAppMessage — error classification", () => {
  it("HTTP 429 → category=rate_limited, isRetryable=true", async () => {
    mockFetchError(429, "rate limit exceeded");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 429,
      category: "rate_limited",
      isRetryable: true,
    });
  });

  it("HTTP 400 → category=invalid_recipient, isRetryable=false", async () => {
    mockFetchError(400, "invalid phone number");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 400,
      category: "invalid_recipient",
      isRetryable: false,
    });
  });

  it("HTTP 500 → category=service_error, isRetryable=true", async () => {
    mockFetchError(500, "internal server error");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 500,
      category: "service_error",
      isRetryable: true,
    });
  });

  it("HTTP 503 → category=service_error, isRetryable=true", async () => {
    mockFetchError(503, "service unavailable");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 503,
      category: "service_error",
      isRetryable: true,
    });
  });

  it("HTTP 401 → category=auth_error, isRetryable=false", async () => {
    mockFetchError(401, "Invalid OAuth access token");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 401,
      category: "auth_error",
      isRetryable: false,
    });
  });

  it("HTTP 403 → category=auth_error, isRetryable=false", async () => {
    mockFetchError(403, "forbidden");
    await expect(sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID)).rejects.toMatchObject({
      name: "WhatsAppSendError",
      statusCode: 403,
      category: "auth_error",
      isRetryable: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Sanitização — token e phone nunca vazam no erro
// ---------------------------------------------------------------------------

describe("sendWhatsAppMessage — sanitização de logs", () => {
  it("mensagem de erro não contém o access token", async () => {
    mockFetchError(401, "bad token");
    let caughtErr: WhatsAppSendError | null = null;
    try {
      await sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID);
    } catch (e) {
      if (e instanceof WhatsAppSendError) caughtErr = e;
    }
    expect(caughtErr).not.toBeNull();
    expect(caughtErr!.message).not.toContain("test-token");
  });

  it("mensagem de erro não contém dígitos do número de telefone do destinatário", async () => {
    mockFetchError(400, "number 5511999990000 not valid");
    let caughtErr: WhatsAppSendError | null = null;
    try {
      await sendWhatsAppMessage("+5511999990000", "oi", TEST_PHONE_ID);
    } catch (e) {
      if (e instanceof WhatsAppSendError) caughtErr = e;
    }
    expect(caughtErr).not.toBeNull();
    expect(caughtErr!.message).not.toContain("5511999990000");
  });
});

// ---------------------------------------------------------------------------
// PERMANENT_CATEGORIES export
// ---------------------------------------------------------------------------

describe("PERMANENT_CATEGORIES", () => {
  it("contém invalid_recipient e auth_error", () => {
    expect(PERMANENT_CATEGORIES).toContain("invalid_recipient");
    expect(PERMANENT_CATEGORIES).toContain("auth_error");
  });

  it("não contém categorias retryable (rate_limited, service_error, unknown)", () => {
    expect(PERMANENT_CATEGORIES).not.toContain("rate_limited");
    expect(PERMANENT_CATEGORIES).not.toContain("service_error");
    expect(PERMANENT_CATEGORIES).not.toContain("unknown");
  });
});
