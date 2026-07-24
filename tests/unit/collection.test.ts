import { describe, it, expect } from "vitest";
import { applyCollectionUpdate } from "@/lib/collection";
import type { CollectionState } from "@/lib/guardrails";
import type { LeadContexto } from "@/lib/agent-context";

function collectionState(overrides: Partial<CollectionState> = {}): CollectionState {
  return { ask: [], collect: [], missingTrocaFields: [], ...overrides };
}

describe("applyCollectionUpdate — fase ask", () => {
  it("adiciona tópico novo a pending_topics, sem forçar handoff", () => {
    const result = applyCollectionUpdate({}, collectionState({ ask: ["financiamento"] }), undefined);
    expect(result.contexto.pending_topics).toEqual(["financiamento"]);
    expect(result.forceHandoff).toBe(false);
    expect(result.agendamento).toBeNull();
  });

  it("ask com dois tópicos simultâneos — ambos entram em pending_topics", () => {
    const result = applyCollectionUpdate({}, collectionState({ ask: ["financiamento", "troca"] }), undefined);
    expect(result.contexto.pending_topics).toEqual(["financiamento", "troca"]);
  });
});

describe("applyCollectionUpdate — financiamento (single-shot)", () => {
  it("collect de financiamento persiste dados e força handoff, mesmo parcial", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      { financiamento: { nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null } }
    );
    expect(result.contexto.financiamento).toEqual({
      nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null,
    });
    expect(result.contexto.pending_topics).toEqual([]);
    expect(result.forceHandoff).toBe(true);
  });

  it("collect de financiamento sem collected_data ainda assim força handoff (resposta veio, mesmo vazia)", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["financiamento"] }), undefined);
    expect(result.forceHandoff).toBe(true);
    expect(result.contexto.pending_topics).toEqual([]);
  });
});

describe("applyCollectionUpdate — troca (incremental)", () => {
  it("merge parcial: campo null da LLM não sobrescreve valor já conhecido no draft", () => {
    const contexto: LeadContexto = {
      pending_topics: ["troca"],
      troca_draft: { modelo: "Bros 160", ano: 2019 },
    };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["troca"] }),
      { troca: { modelo: null, ano: null, km: 32000, servico_recente: null, agendamento_data: null, agendamento_horario: null } }
    );
    expect(result.contexto.troca_draft).toMatchObject({ modelo: "Bros 160", ano: 2019, km: 32000 });
    expect(result.forceHandoff).toBe(false);
  });

  it("troca incompleta não finaliza nem força handoff", () => {
    const contexto: LeadContexto = { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160" } };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["troca"] }), undefined);
    expect(result.contexto.troca).toBeUndefined();
    expect(result.contexto.pending_topics).toEqual(["troca"]);
    expect(result.forceHandoff).toBe(false);
    expect(result.agendamento).toBeNull();
  });

  it("troca completa (5 campos) finaliza, limpa draft, remove de pending, força handoff e retorna agendamento", () => {
    const contexto: LeadContexto = { pending_topics: ["troca"], troca_draft: { modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não" } };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["troca"] }),
      { troca: { modelo: null, ano: null, km: null, servico_recente: null, agendamento_data: "2026-07-28", agendamento_horario: "tarde" } }
    );
    expect(result.contexto.troca).toEqual({
      modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não",
      agendamento_data: "2026-07-28", agendamento_horario: "tarde",
    });
    expect(result.contexto.troca_draft).toBeNull();
    expect(result.contexto.pending_topics).toEqual([]);
    expect(result.forceHandoff).toBe(true);
    expect(result.agendamento).toEqual({ data: "2026-07-28", horario: "tarde" });
  });

  it("troca completa sem agendamento_data (só horário) ainda finaliza — data é opcional", () => {
    const contexto: LeadContexto = {
      pending_topics: ["troca"],
      troca_draft: { modelo: "Bros 160", ano: 2019, km: 32000, servico_recente: "não", agendamento_horario: "sábado de manhã" },
    };
    const result = applyCollectionUpdate(contexto, collectionState({ collect: ["troca"] }), undefined);
    expect(result.contexto.troca).not.toBeNull();
    expect(result.agendamento).toEqual({ data: null, horario: "sábado de manhã" });
  });
});

describe("applyCollectionUpdate — financiamento e troca simultâneos", () => {
  it("processa collect de financiamento e ask de troca no mesmo turno sem interferência", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ ask: ["troca"], collect: ["financiamento"] }),
      { financiamento: { nome_completo: "Maria", cpf: "111", renda_aproximada: "4000", entrada_disposta: "3000" } }
    );
    expect(result.contexto.financiamento?.nome_completo).toBe("Maria");
    expect(result.contexto.pending_topics).toEqual(["troca"]);
    expect(result.forceHandoff).toBe(true);
  });
});
