import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabase,
  db,
  createTestStore,
  deleteStoreDeep,
  createTestUser,
  deleteTestUser,
  makeExternalId,
  makePhone,
} from "./helpers";

const describeIf = hasSupabase ? describe : describe.skip;

describeIf("RPC webhook_ingest_message", () => {
  let storeId: string;

  beforeAll(async () => {
    const store = await createTestStore("rpc");
    storeId = store.id;
  });

  afterAll(async () => {
    await deleteStoreDeep(storeId);
  });

  async function rpc(args: Record<string, unknown>) {
    return db.rpc("webhook_ingest_message", args);
  }

  it("primeira chamada: cria lead + conversation + message", async () => {
    const { data, error } = await rpc({
      p_store_id: storeId,
      p_phone_normalized: makePhone(),
      p_contact_name: "Joao",
      p_message_external_id: makeExternalId("first"),
      p_mensagem: "oi",
      p_received_at: new Date().toISOString(),
    });
    expect(error).toBeNull();
    expect(data.is_new_lead).toBe(true);
    expect(data.is_new_conversation).toBe(true);
    expect(data.duplicate).toBe(false);
    expect(data.lead_id).toBeTruthy();
    expect(data.conversation_id).toBeTruthy();
    expect(data.message_id).toBeTruthy();
  });

  it("segunda mensagem do mesmo phone reutiliza lead e conversation", async () => {
    const phone = makePhone();
    const first = await rpc({
      p_store_id: storeId,
      p_phone_normalized: phone,
      p_contact_name: null,
      p_message_external_id: makeExternalId("a"),
      p_mensagem: "A",
      p_received_at: new Date().toISOString(),
    });
    const second = await rpc({
      p_store_id: storeId,
      p_phone_normalized: phone,
      p_contact_name: null,
      p_message_external_id: makeExternalId("b"),
      p_mensagem: "B",
      p_received_at: new Date().toISOString(),
    });
    expect(second.data.is_new_lead).toBe(false);
    expect(second.data.is_new_conversation).toBe(false);
    expect(second.data.lead_id).toBe(first.data.lead_id);
    expect(second.data.conversation_id).toBe(first.data.conversation_id);
  });

  it("idempotencia: mesma external_id retorna duplicate=true sem gravar", async () => {
    const extId = makeExternalId("dup");
    const args = {
      p_store_id: storeId,
      p_phone_normalized: makePhone(),
      p_contact_name: null,
      p_message_external_id: extId,
      p_mensagem: "idempotente",
      p_received_at: new Date().toISOString(),
    };
    const first = await rpc(args);
    const second = await rpc(args);
    expect(first.data.duplicate).toBe(false);
    expect(second.data.duplicate).toBe(true);
    expect(second.data.message_id).toBeNull();

    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("message_external_id", extId);
    expect(count).toBe(1);
  });

  it("race-safe: 10 chamadas concorrentes com phone novo => 1 lead, 1 conversation", async () => {
    const phone = makePhone();
    const calls = Array.from({ length: 10 }, (_, i) =>
      rpc({
        p_store_id: storeId,
        p_phone_normalized: phone,
        p_contact_name: null,
        p_message_external_id: makeExternalId(`race-${i}`),
        p_mensagem: `msg ${i}`,
        p_received_at: new Date().toISOString(),
      })
    );
    const results = await Promise.all(calls);
    for (const r of results) expect(r.error).toBeNull();

    const leadIds = new Set(results.map((r) => r.data.lead_id));
    const convIds = new Set(results.map((r) => r.data.conversation_id));
    expect(leadIds.size).toBe(1);
    expect(convIds.size).toBe(1);

    // exatamente uma chamada ganha o "is_new_*"
    expect(results.filter((r) => r.data.is_new_lead).length).toBe(1);
    expect(results.filter((r) => r.data.is_new_conversation).length).toBe(1);

    const { count } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", [...leadIds][0]);
    expect(count).toBe(10);
  });

  it("persiste received_at corretamente (timestamp Meta)", async () => {
    const extId = makeExternalId("ts");
    const ts = "2025-01-15T10:00:00.000Z";
    await rpc({
      p_store_id: storeId,
      p_phone_normalized: makePhone(),
      p_contact_name: null,
      p_message_external_id: extId,
      p_mensagem: "ts test",
      p_received_at: ts,
    });
    const { data } = await db
      .from("messages")
      .select("received_at")
      .eq("message_external_id", extId)
      .single();
    expect(new Date(data!.received_at).toISOString()).toBe(ts);
  });

  it("CHECK messages_direcao_autor_chk bloqueia combinacoes invalidas", async () => {
    // Cria lead + conv para poder tentar inserir message invalida
    const { data: lead } = await db
      .from("leads")
      .insert({
        store_id: storeId,
        phone_normalized: makePhone(),
        origem: "whatsapp",
      })
      .select("id")
      .single();
    const { data: conv } = await db
      .from("conversations")
      .insert({ store_id: storeId, lead_id: lead!.id, canal: "whatsapp" })
      .select("id")
      .single();

    const cases: Array<{ direcao: string; autor: string }> = [
      { direcao: "saida", autor: "lead" },
      { direcao: "entrada", autor: "ia" },
      { direcao: "entrada", autor: "humano" },
      { direcao: "entrada", autor: "sistema" },
    ];
    for (const c of cases) {
      const { error } = await db.from("messages").insert({
        store_id: storeId,
        conversation_id: conv!.id,
        lead_id: lead!.id,
        direcao: c.direcao,
        autor: c.autor,
        mensagem: "invalida",
      });
      expect(error, `deveria falhar: ${c.direcao}/${c.autor}`).toBeTruthy();
    }
  });

  it("CHECK conversations_encerrada_consistency_chk amarra status x data", async () => {
    const { data: lead } = await db
      .from("leads")
      .insert({
        store_id: storeId,
        phone_normalized: makePhone(),
        origem: "whatsapp",
      })
      .select("id")
      .single();

    // ENCERRADA sem encerrada_em => falha
    const r1 = await db.from("conversations").insert({
      store_id: storeId,
      lead_id: lead!.id,
      canal: "whatsapp",
      conversation_status: "ENCERRADA",
    });
    expect(r1.error).toBeTruthy();

    // ATIVA com encerrada_em preenchido => falha
    const r2 = await db.from("conversations").insert({
      store_id: storeId,
      lead_id: lead!.id,
      canal: "whatsapp",
      conversation_status: "ATIVA",
      encerrada_em: new Date().toISOString(),
    });
    expect(r2.error).toBeTruthy();
  });

  it("trigger multi-tenant: assigned_to de outra store eh rejeitado", async () => {
    const other = await createTestStore("mt-other");
    const otherUserId = await createTestUser(other.id, "Outra Loja");
    try {
      const { data: lead } = await db
        .from("leads")
        .insert({
          store_id: storeId,
          phone_normalized: makePhone(),
          origem: "whatsapp",
        })
        .select("id")
        .single();
      const { error } = await db.from("conversations").insert({
        store_id: storeId,
        lead_id: lead!.id,
        canal: "whatsapp",
        assigned_to: otherUserId,
      });
      expect(error).toBeTruthy();
      expect(error!.message.toLowerCase()).toMatch(/multi-tenant|store/);
    } finally {
      await deleteTestUser(otherUserId);
      await deleteStoreDeep(other.id);
    }
  });

  it("trigger multi-tenant: assigned_to da mesma store eh aceito", async () => {
    const userId = await createTestUser(storeId, "Mesma Loja");
    try {
      const { data: lead } = await db
        .from("leads")
        .insert({
          store_id: storeId,
          phone_normalized: makePhone(),
          origem: "whatsapp",
        })
        .select("id")
        .single();
      const { error } = await db.from("conversations").insert({
        store_id: storeId,
        lead_id: lead!.id,
        canal: "whatsapp",
        assigned_to: userId,
      });
      expect(error).toBeNull();
    } finally {
      await deleteTestUser(userId);
    }
  });
});
