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

describeIf("assign_lead_to_least_loaded_vendedor (migration 042)", () => {
  let storeId: string;

  beforeAll(async () => {
    const store = await createTestStore("distribution");
    storeId = store.id;
  });

  afterAll(async () => {
    await deleteStoreDeep(storeId);
  });

  async function insertLead(overrides: Record<string, unknown> = {}) {
    const { data, error } = await db
      .from("leads")
      .insert({
        store_id: storeId,
        phone_normalized: makePhone(),
        origem: "whatsapp",
        ...overrides,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  async function assign(leadId: string) {
    return db.rpc("assign_lead_to_least_loaded_vendedor", {
      p_lead_id: leadId,
      p_store_id: storeId,
    });
  }

  it("AD1: loja sem vendedor nenhum — no-op, assigned_to permanece NULL", async () => {
    const emptyStore = await createTestStore("no-vendedor");
    try {
      const leadId = await insertLeadFor(emptyStore.id);
      const { data, error } = await db.rpc("assign_lead_to_least_loaded_vendedor", {
        p_lead_id: leadId,
        p_store_id: emptyStore.id,
      });
      expect(error).toBeNull();
      expect(data).toBeNull();

      const { data: lead } = await db
        .from("leads")
        .select("assigned_to")
        .eq("id", leadId)
        .single();
      expect(lead!.assigned_to).toBeNull();
    } finally {
      await deleteStoreDeep(emptyStore.id);
    }
  });

  it("AD2: 1 vendedor só — lead novo recebe esse vendedor", async () => {
    const userId = await createTestUser(storeId, "Vendedor Solo");
    try {
      const leadId = await insertLead();
      const { data, error } = await assign(leadId);
      expect(error).toBeNull();
      expect(data).toBe(userId);

      const { data: lead } = await db
        .from("leads")
        .select("assigned_to")
        .eq("id", leadId)
        .single();
      expect(lead!.assigned_to).toBe(userId);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("AD3: menor carga vence — vendedor com leads abertos existentes é preterido", async () => {
    const userLoaded = await createTestUser(storeId, "Vendedor Carregado");
    const userFree = await createTestUser(storeId, "Vendedor Livre");
    try {
      // 3 leads abertos já atribuídos ao "carregado"
      for (let i = 0; i < 3; i++) {
        await insertLead({ assigned_to: userLoaded, lead_status: "NOVO" });
      }

      const newLeadId = await insertLead();
      const { data } = await assign(newLeadId);
      expect(data).toBe(userFree);
    } finally {
      await deleteTestUser(userLoaded);
      await deleteTestUser(userFree);
    }
  });

  it("AD4: leads FECHADO/PERDIDO não contam como carga aberta", async () => {
    const userA = await createTestUser(storeId, "Vendedor A");
    const userB = await createTestUser(storeId, "Vendedor B");
    try {
      // userA tem 2 leads mas ambos terminais — carga aberta real = 0
      await insertLead({ assigned_to: userA, lead_status: "FECHADO" });
      await insertLead({ assigned_to: userA, lead_status: "PERDIDO" });
      // userB tem 1 lead aberto
      await insertLead({ assigned_to: userB, lead_status: "NOVO" });

      const newLeadId = await insertLead();
      const { data } = await assign(newLeadId);
      // userA tem carga aberta 0 (menor que userB=1) — vence mesmo tendo mais linhas na tabela
      expect(data).toBe(userA);
    } finally {
      await deleteTestUser(userA);
      await deleteTestUser(userB);
    }
  });

  it("AD5: lead já atribuído não é redistribuído — RPC não sobrescreve assigned_to existente ao ser chamada de novo indevidamente é responsabilidade do caller, mas confirma que reassign explícito funciona", async () => {
    // Este teste documenta o comportamento da função pura: ela SEMPRE atribui
    // ao vencedor calculado quando chamada. Quem garante "não redistribuir
    // lead existente" é o caller (webhook_ingest_message só chama quando
    // is_new_lead) — coberto no describe de webhook_ingest_message abaixo.
    const userId = await createTestUser(storeId, "Vendedor Único");
    try {
      const leadId = await insertLead({ assigned_to: userId });
      const { data } = await assign(leadId);
      expect(data).toBe(userId);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("AD6: race de 2 chamadas concorrentes na mesma loja — 2 leads novos, sem duplicar no mesmo vendedor", async () => {
    const userA = await createTestUser(storeId, "Vendedor Race A");
    const userB = await createTestUser(storeId, "Vendedor Race B");
    try {
      const leadX = await insertLead();
      const leadY = await insertLead();

      const [rx, ry] = await Promise.all([assign(leadX), assign(leadY)]);
      expect(rx.error).toBeNull();
      expect(ry.error).toBeNull();

      const chosen = new Set([rx.data, ry.data]);
      // advisory lock serializa: a 2a chamada enxerga a carga já persistida
      // pela 1a — os 2 leads não podem cair no mesmo vendedor.
      expect(chosen.size).toBe(2);
      expect(chosen.has(userA)).toBe(true);
      expect(chosen.has(userB)).toBe(true);
    } finally {
      await deleteTestUser(userA);
      await deleteTestUser(userB);
    }
  });

  async function insertLeadFor(sid: string) {
    const { data, error } = await db
      .from("leads")
      .insert({ store_id: sid, phone_normalized: makePhone(), origem: "whatsapp" })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }
});

describeIf("webhook_ingest_message + distribuição automática (migration 042)", () => {
  let storeId: string;

  beforeAll(async () => {
    const store = await createTestStore("webhook-distribution");
    storeId = store.id;
  });

  afterAll(async () => {
    await deleteStoreDeep(storeId);
  });

  async function rpc(args: Record<string, unknown>) {
    return db.rpc("webhook_ingest_message", args);
  }

  it("WD1: lead novo via webhook recebe vendedor automaticamente", async () => {
    const userId = await createTestUser(storeId, "Vendedor Webhook");
    try {
      const { data, error } = await rpc({
        p_store_id: storeId,
        p_phone_normalized: makePhone(),
        p_contact_name: "Cliente Novo",
        p_message_external_id: makeExternalId("wd1"),
        p_mensagem: "oi",
        p_received_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data.is_new_lead).toBe(true);

      const { data: lead } = await db
        .from("leads")
        .select("assigned_to")
        .eq("id", data.lead_id)
        .single();
      expect(lead!.assigned_to).toBe(userId);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("WD2: 2a mensagem do mesmo lead (não-novo) não redistribui", async () => {
    const userA = await createTestUser(storeId, "Vendedor WD2 A");
    const phone = makePhone();
    try {
      const first = await rpc({
        p_store_id: storeId,
        p_phone_normalized: phone,
        p_contact_name: null,
        p_message_external_id: makeExternalId("wd2-a"),
        p_mensagem: "primeira",
        p_received_at: new Date().toISOString(),
      });
      const { data: leadAfterFirst } = await db
        .from("leads")
        .select("assigned_to")
        .eq("id", first.data.lead_id)
        .single();
      const originalOwner = leadAfterFirst!.assigned_to;
      expect(originalOwner).toBe(userA);

      // Segundo vendedor criado DEPOIS da primeira mensagem — se a 2a
      // mensagem redistribuísse, poderia trocar de dono. Não deve.
      const userB = await createTestUser(storeId, "Vendedor WD2 B");
      try {
        const second = await rpc({
          p_store_id: storeId,
          p_phone_normalized: phone,
          p_contact_name: null,
          p_message_external_id: makeExternalId("wd2-b"),
          p_mensagem: "segunda",
          p_received_at: new Date().toISOString(),
        });
        expect(second.data.is_new_lead).toBe(false);

        const { data: leadAfterSecond } = await db
          .from("leads")
          .select("assigned_to")
          .eq("id", first.data.lead_id)
          .single();
        expect(leadAfterSecond!.assigned_to).toBe(originalOwner);
      } finally {
        await deleteTestUser(userB);
      }
    } finally {
      await deleteTestUser(userA);
    }
  });

  it("WD3: loja sem vendedor — webhook não quebra, assigned_to fica NULL", async () => {
    const { data, error } = await rpc({
      p_store_id: storeId,
      p_phone_normalized: makePhone(),
      p_contact_name: null,
      p_message_external_id: makeExternalId("wd3"),
      p_mensagem: "oi sem vendedor",
      p_received_at: new Date().toISOString(),
    });
    expect(error).toBeNull();
    const { data: lead } = await db
      .from("leads")
      .select("assigned_to")
      .eq("id", data.lead_id)
      .single();
    expect(lead!.assigned_to).toBeNull();
  });
});
