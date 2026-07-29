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
      { financiamento: { nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null, data_nascimento: null } }
    );
    expect(result.contexto.financiamento).toEqual({
      nome_completo: "João", cpf: null, renda_aproximada: null, entrada_disposta: null, data_nascimento: null,
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
    expect(result.contexto.troca?.agendamento_data).toBeNull();
    expect(result.agendamento).toEqual({ data: null, horario: "sábado de manhã" });
  });
});

describe("applyCollectionUpdate — guarda de idade (financiamento)", () => {
  const NOW = new Date("2026-07-29T12:00:00Z");

  it("menor de idade: não persiste financiamento, sinaliza bloqueio, remove pending, força handoff", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "João Menor",
          cpf: "111.111.111-11",
          renda_aproximada: "1000",
          entrada_disposta: "500",
          data_nascimento: "2010-01-01", // 16 anos em 2026-07-29
        },
      },
      NOW
    );
    expect(result.contexto.financiamento).toBeUndefined();
    expect(result.contexto.financiamento_bloqueio).toBe("financiamento_menor_idade");
    expect(result.contexto.pending_topics).toEqual([]);
    expect(result.forceHandoff).toBe(true);
  });

  it("maior de idade: persiste normalmente, sem bloqueio", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Maria Maior",
          cpf: "222.222.222-22",
          renda_aproximada: "4000",
          entrada_disposta: "3000",
          data_nascimento: "1990-01-01",
        },
      },
      NOW
    );
    expect(result.contexto.financiamento?.cpf).toBe("222.222.222-22");
    expect(result.contexto.financiamento_bloqueio).toBeUndefined();
    expect(result.contexto.titular_diferente_do_lead).toBeUndefined();
    expect(result.forceHandoff).toBe(true);
  });

  it("sem data_nascimento: comportamento anterior preservado, sem bloqueio", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Sem Data",
          cpf: "333.333.333-33",
          renda_aproximada: null,
          entrada_disposta: null,
          data_nascimento: null,
        },
      },
      NOW
    );
    expect(result.contexto.financiamento?.cpf).toBe("333.333.333-33");
    expect(result.contexto.financiamento_bloqueio).toBeUndefined();
  });

  it("troca de titular: responsável maior de idade após bloqueio anterior marca titular_diferente_do_lead e limpa bloqueio", () => {
    const contexto: LeadContexto = {
      pending_topics: ["financiamento"],
      financiamento_bloqueio: "financiamento_menor_idade",
    };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Mãe Responsável",
          cpf: "444.444.444-44",
          renda_aproximada: "5000",
          entrada_disposta: "2000",
          data_nascimento: "1975-03-10",
        },
      },
      NOW
    );
    expect(result.contexto.financiamento?.nome_completo).toBe("Mãe Responsável");
    expect(result.contexto.titular_diferente_do_lead).toBe(true);
    expect(result.contexto.financiamento_bloqueio).toBeUndefined();
    expect(result.forceHandoff).toBe(true);
  });

  it("responsável indicado também é menor: bloqueio se repete, titular_diferente_do_lead não é marcado", () => {
    const contexto: LeadContexto = {
      pending_topics: ["financiamento"],
      financiamento_bloqueio: "financiamento_menor_idade",
    };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Irmão Menor",
          cpf: "555.555.555-55",
          renda_aproximada: null,
          entrada_disposta: null,
          data_nascimento: "2012-06-15", // 14 anos em 2026-07-29
        },
      },
      NOW
    );
    expect(result.contexto.financiamento).toBeUndefined();
    expect(result.contexto.financiamento_bloqueio).toBe("financiamento_menor_idade");
    expect(result.contexto.titular_diferente_do_lead).toBeUndefined();
  });

  it("faz aniversário de 18 exatamente na data de referência: já é maior (limite inclusivo)", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Fez 18 Hoje",
          cpf: "666.666.666-66",
          renda_aproximada: "2000",
          entrada_disposta: "1000",
          data_nascimento: "2008-07-29", // exatamente 18 anos em 2026-07-29
        },
      },
      NOW
    );
    expect(result.contexto.financiamento?.cpf).toBe("666.666.666-66");
    expect(result.contexto.financiamento_bloqueio).toBeUndefined();
  });

  it("faltam 1 dia pra completar 18: ainda menor", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ collect: ["financiamento"] }),
      {
        financiamento: {
          nome_completo: "Quase 18",
          cpf: "777.777.777-77",
          renda_aproximada: null,
          entrada_disposta: null,
          data_nascimento: "2008-07-30", // 18 anos só amanhã
        },
      },
      NOW
    );
    expect(result.contexto.financiamento).toBeUndefined();
    expect(result.contexto.financiamento_bloqueio).toBe("financiamento_menor_idade");
  });
});

describe("applyCollectionUpdate — financiamento e troca simultâneos", () => {
  it("processa collect de financiamento e ask de troca no mesmo turno sem interferência", () => {
    const contexto: LeadContexto = { pending_topics: ["financiamento"] };
    const result = applyCollectionUpdate(
      contexto,
      collectionState({ ask: ["troca"], collect: ["financiamento"] }),
      { financiamento: { nome_completo: "Maria", cpf: "111", renda_aproximada: "4000", entrada_disposta: "3000", data_nascimento: "1990-01-01" } }
    );
    expect(result.contexto.financiamento?.nome_completo).toBe("Maria");
    expect(result.contexto.pending_topics).toEqual(["troca"]);
    expect(result.forceHandoff).toBe(true);
  });
});
