import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hasSupabase,
  db,
  createTestStore,
  deleteStoreDeep,
  makePhone,
} from "./helpers";
import {
  transitionLeadStatus,
  transitionConversationStatus,
  InvalidTransitionError,
  ConcurrentTransitionError,
} from "@/lib/status";

const describeIf = hasSupabase ? describe : describe.skip;

describeIf("transitionLeadStatus / transitionConversationStatus", () => {
  let storeId: string;

  beforeAll(async () => {
    const store = await createTestStore("status");
    storeId = store.id;
  });

  afterAll(async () => {
    await deleteStoreDeep(storeId);
  });

  async function mkLead(): Promise<string> {
    const { data } = await db
      .from("leads")
      .insert({
        store_id: storeId,
        phone_normalized: makePhone(),
        origem: "whatsapp",
      })
      .select("id")
      .single();
    return data!.id as string;
  }

  async function mkConv(leadId: string): Promise<string> {
    const { data } = await db
      .from("conversations")
      .insert({ store_id: storeId, lead_id: leadId, canal: "whatsapp" })
      .select("id")
      .single();
    return data!.id as string;
  }

  it("lead: transicao valida grava o novo status", async () => {
    const id = await mkLead();
    const r = await transitionLeadStatus(id, "ENGAJADO");
    expect(r).toEqual({ from: "NOVO", to: "ENGAJADO", changed: true });

    const { data } = await db
      .from("leads")
      .select("lead_status")
      .eq("id", id)
      .single();
    expect(data!.lead_status).toBe("ENGAJADO");
  });

  it("lead: rejeita transicao invalida com InvalidTransitionError", async () => {
    const id = await mkLead();
    await expect(transitionLeadStatus(id, "FECHADO")).rejects.toBeInstanceOf(
      InvalidTransitionError
    );
  });

  it("lead: from==to eh no-op (changed=false)", async () => {
    const id = await mkLead();
    const r = await transitionLeadStatus(id, "NOVO");
    expect(r.changed).toBe(false);
  });

  it("conv: ENCERRADA seta encerrada_em automaticamente", async () => {
    const leadId = await mkLead();
    const convId = await mkConv(leadId);
    await transitionConversationStatus(convId, "ENCERRADA");
    const { data } = await db
      .from("conversations")
      .select("conversation_status, encerrada_em")
      .eq("id", convId)
      .single();
    expect(data!.conversation_status).toBe("ENCERRADA");
    expect(data!.encerrada_em).toBeTruthy();
  });

  it("conv: ENCERRADA eh terminal (bloqueia volta)", async () => {
    const leadId = await mkLead();
    const convId = await mkConv(leadId);
    await transitionConversationStatus(convId, "ENCERRADA");
    await expect(
      transitionConversationStatus(convId, "ATIVA")
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("conv: atualiza handoff_to no mesmo passo", async () => {
    const leadId = await mkLead();
    const convId = await mkConv(leadId);
    await transitionConversationStatus(convId, "AGUARDANDO_HUMANO", {
      handoff_to: "HUMANO",
    });
    const { data } = await db
      .from("conversations")
      .select("conversation_status, handoff_to")
      .eq("id", convId)
      .single();
    expect(data!.conversation_status).toBe("AGUARDANDO_HUMANO");
    expect(data!.handoff_to).toBe("HUMANO");
  });

  it("concorrencia: 2 transicoes paralelas a partir de NOVO => 1 ok, 1 falha", async () => {
    const id = await mkLead();
    const results = await Promise.allSettled([
      transitionLeadStatus(id, "ENGAJADO"),
      transitionLeadStatus(id, "PERDIDO"),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);

    // A falha deve ser ConcurrentTransitionError (quem perdeu a corrida)
    const rejected = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    expect(rejected?.reason).toBeInstanceOf(ConcurrentTransitionError);
  });
});
