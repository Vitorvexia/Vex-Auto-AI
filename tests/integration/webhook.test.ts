import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import {
  hasSupabase,
  db,
  createTestStore,
  deleteStoreDeep,
  hmacSign,
  makeExternalId,
  makePhone,
} from "./helpers";

const describeIf = hasSupabase ? describe : describe.skip;

const APP_SECRET = "test-webhook-secret-xyz";

type Msg = { from: string; id: string; text: string; ts?: number };

function payloadFor(
  dest: string,
  msgs: Msg[],
  contacts?: Array<{ wa_id: string; name: string }>
) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                display_phone_number: dest,
                phone_number_id: "PNID",
              },
              contacts: contacts?.map((c) => ({
                wa_id: c.wa_id,
                profile: { name: c.name },
              })),
              messages: msgs.map((m) => ({
                from: m.from.replace(/\D/g, ""),
                id: m.id,
                timestamp: String(m.ts ?? Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: m.text },
              })),
            },
          },
        ],
      },
    ],
  };
}

describeIf("webhook POST (hardened)", () => {
  let storeId: string;
  let storeNumero: string;
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    vi.stubEnv("WHATSAPP_ALLOW_UNSIGNED", "false");
    const store = await createTestStore("webhook");
    storeId = store.id;
    storeNumero = store.whatsapp_numero;
    // dynamic import para garantir env ja estar setado
    const mod = await import("@/app/api/whatsapp/webhook/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await deleteStoreDeep(storeId);
  });

  async function post(body: unknown, signature?: string) {
    const raw = JSON.stringify(body);
    const sig = signature ?? hmacSign(raw, APP_SECRET);
    const req = new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sig,
      },
      body: raw,
    });
    const res = await POST(req);
    const json = (await res.json()) as any;
    return { status: res.status, json };
  }

  it("rejeita POST com HMAC invalido (403)", async () => {
    const p = payloadFor(storeNumero, [
      { from: "+5511900000001", id: makeExternalId("hmac"), text: "oi" },
    ]);
    const { status } = await post(p, "sha256=deadbeef");
    expect(status).toBe(403);
  });

  it("aceita POST com HMAC valido e processa mensagem", async () => {
    const phone = makePhone();
    const p = payloadFor(
      storeNumero,
      [
        {
          from: phone,
          id: makeExternalId("ok"),
          text: "oi",
          ts: 1700000000,
        },
      ],
      [{ wa_id: phone.replace(/\D/g, ""), name: "Teste" }]
    );
    const { status, json } = await post(p);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results[0].status).toBe("ok");
    expect(json.results[0].lead_id).toBeTruthy();
  });

  it("idempotencia: mesma external_id duas vezes => duplicate", async () => {
    const phone = makePhone();
    const extId = makeExternalId("idemp");
    const p = payloadFor(storeNumero, [
      { from: phone, id: extId, text: "primeira" },
    ]);
    const first = await post(p);
    const second = await post(p);
    expect(first.json.results[0].status).toBe("ok");
    expect(second.json.results[0].status).toBe("duplicate");

    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("message_external_id", extId);
    expect(count).toBe(1);
  });

  it("itera TODAS as mensagens do batch (messages[])", async () => {
    const phone1 = makePhone();
    const phone2 = makePhone();
    const p = payloadFor(storeNumero, [
      { from: phone1, id: makeExternalId("batch-1"), text: "A" },
      { from: phone2, id: makeExternalId("batch-2"), text: "B" },
      { from: phone1, id: makeExternalId("batch-3"), text: "C" },
    ]);
    const { status, json } = await post(p);
    expect(status).toBe(200);
    expect(json.results).toHaveLength(3);
    expect(json.results.every((r: any) => r.status === "ok")).toBe(true);
  });

  it("persiste received_at da Meta (timestamp epoch)", async () => {
    const phone = makePhone();
    const extId = makeExternalId("ts");
    const epoch = 1704067200; // 2024-01-01T00:00:00Z
    const p = payloadFor(storeNumero, [
      { from: phone, id: extId, text: "ts", ts: epoch },
    ]);
    await post(p);
    const { data } = await db
      .from("messages")
      .select("received_at")
      .eq("message_external_id", extId)
      .single();
    expect(new Date(data!.received_at).getTime()).toBe(epoch * 1000);
  });

  it("skip silencioso para destino desconhecido (status=skipped)", async () => {
    const p = payloadFor("+19999999999", [
      {
        from: "+5511900009999",
        id: makeExternalId("unknown"),
        text: "oi",
      },
    ]);
    const { status, json } = await post(p);
    expect(status).toBe(200);
    expect(json.results[0].status).toBe("skipped");
  });

  it("ignora tipos nao-text e processa text no mesmo batch", async () => {
    const phone = makePhone();
    const okId = makeExternalId("mixed-ok");
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { display_phone_number: storeNumero },
                messages: [
                  {
                    from: phone.replace(/\D/g, ""),
                    id: makeExternalId("mixed-img"),
                    type: "image",
                    image: { id: "x" },
                    timestamp: "1700000000",
                  },
                  {
                    from: phone.replace(/\D/g, ""),
                    id: okId,
                    type: "text",
                    text: { body: "ok" },
                    timestamp: "1700000001",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const { status, json } = await post(body);
    expect(status).toBe(200);
    expect(json.results).toHaveLength(2);
    expect(json.results[0].status).toBe("skipped");
    expect(json.results[1].status).toBe("ok");
  });
});
