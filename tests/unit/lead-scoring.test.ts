import { describe, it, expect } from "vitest";
import { calculateLeadScore, clampScore, detectSignals } from "@/lib/lead-scoring";
import type { ScoreInput } from "@/lib/lead-scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    currentScore: 0,
    leadStatus: "NOVO",
    messageText: "",
    source: "message",
    isFirstScore: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1 — Clamp: score nunca sai de 0-100
// ---------------------------------------------------------------------------

describe("clampScore", () => {
  it("clamp positivo: score acima de 100 vira 100", () => {
    const r = calculateLeadScore(input({ currentScore: 95, messageText: "quero comprar" }));
    expect(r.newScore).toBe(100);
  });

  it("clamp negativo: score abaixo de 0 vira 0", () => {
    const r = calculateLeadScore(input({ currentScore: 5, daysSinceLastReply: 14 }));
    expect(r.newScore).toBe(0);
  });

  it("clampScore standalone: valores extremos", () => {
    expect(clampScore(-50)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(50)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Pergunta de preço → +15
// ---------------------------------------------------------------------------

describe("sinal: preço", () => {
  it("+15 para 'qual o preço'", () => {
    const r = calculateLeadScore(input({ messageText: "qual o preço desse carro" }));
    expect(r.delta).toBeGreaterThanOrEqual(15);
    expect(r.reasons).toContain("preco");
  });

  it("+15 para 'valor'", () => {
    const r = calculateLeadScore(input({ messageText: "qual o valor" }));
    expect(r.reasons).toContain("preco");
  });

  it("+15 para 'quanto custa'", () => {
    const r = calculateLeadScore(input({ messageText: "quanto custa" }));
    expect(r.reasons).toContain("preco");
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Financiamento/parcela/entrada → +20
// ---------------------------------------------------------------------------

describe("sinal: financiamento", () => {
  it("+20 para 'financiamento'", () => {
    const r = calculateLeadScore(input({ messageText: "tem financiamento?" }));
    expect(r.delta).toBeGreaterThanOrEqual(20);
    expect(r.reasons).toContain("financiamento");
  });

  it("+20 para 'parcela'", () => {
    const r = calculateLeadScore(input({ messageText: "qual a parcela?" }));
    expect(r.reasons).toContain("financiamento");
  });

  it("+20 para 'entrada'", () => {
    const r = calculateLeadScore(input({ messageText: "quanto é a entrada?" }));
    expect(r.reasons).toContain("financiamento");
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Intenção forte de compra → +30
// ---------------------------------------------------------------------------

describe("sinal: intenção forte", () => {
  it("+30 para 'quero comprar'", () => {
    const r = calculateLeadScore(input({ messageText: "quero comprar" }));
    expect(r.delta).toBeGreaterThanOrEqual(30);
    expect(r.reasons).toContain("intencao_forte");
  });

  it("+30 para 'quero fechar'", () => {
    const r = calculateLeadScore(input({ messageText: "quero fechar o negócio" }));
    expect(r.reasons).toContain("intencao_forte");
  });

  it("+30 para 'vou fechar'", () => {
    const r = calculateLeadScore(input({ messageText: "vou fechar sim" }));
    expect(r.reasons).toContain("intencao_forte");
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Veículo específico → +10
// ---------------------------------------------------------------------------

describe("sinal: veículo específico", () => {
  it("+10 para marca honda", () => {
    const r = calculateLeadScore(input({ messageText: "gosto de honda" }));
    expect(r.delta).toBeGreaterThanOrEqual(10);
    expect(r.reasons).toContain("veiculo_especifico");
  });

  it("+10 para marca toyota", () => {
    const r = calculateLeadScore(input({ messageText: "tem toyota?" }));
    expect(r.reasons).toContain("veiculo_especifico");
  });

  it("+10 para 'volkswagen'", () => {
    const r = calculateLeadScore(input({ messageText: "prefiro volkswagen" }));
    expect(r.reasons).toContain("veiculo_especifico");
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Resposta após follow-up → +15
// ---------------------------------------------------------------------------

describe("sinal: source=follow_up", () => {
  it("+15 quando source='follow_up'", () => {
    const base = calculateLeadScore(input({ messageText: "oi" }));
    const withFollowUp = calculateLeadScore(
      input({ source: "follow_up", messageText: "oi" })
    );
    expect(withFollowUp.delta - base.delta).toBe(15);
    expect(withFollowUp.reasons).toContain("follow_up_response");
  });
});

// ---------------------------------------------------------------------------
// Test 7 — Resposta após reativação → +20
// ---------------------------------------------------------------------------

describe("sinal: source=reactivation", () => {
  it("+20 quando source='reactivation'", () => {
    const base = calculateLeadScore(input({ messageText: "oi" }));
    const withReactivation = calculateLeadScore(
      input({ source: "reactivation", messageText: "oi" })
    );
    expect(withReactivation.delta - base.delta).toBe(20);
    expect(withReactivation.reasons).toContain("reactivation_response");
  });
});

// ---------------------------------------------------------------------------
// Test 8 — Inativo 7-13 dias → -10
// ---------------------------------------------------------------------------

describe("penalidade: inatividade 7-13d", () => {
  it("-10 quando daysSinceLastReply=10", () => {
    const r = calculateLeadScore(
      input({ currentScore: 40, messageText: "", daysSinceLastReply: 10 })
    );
    expect(r.newScore).toBe(35); // 40 + 5(msg) - 10(inatividade) = 35
    expect(r.reasons).toContain("inatividade_7d");
    expect(r.reasons).not.toContain("inatividade_14d");
  });

  it("sem penalidade quando daysSinceLastReply=6 (abaixo do threshold)", () => {
    const r = calculateLeadScore(
      input({ currentScore: 40, messageText: "", daysSinceLastReply: 6 })
    );
    expect(r.reasons).not.toContain("inatividade_7d");
  });
});

// ---------------------------------------------------------------------------
// Test 9 — Inativo 14+ dias → -30 total
// ---------------------------------------------------------------------------

describe("penalidade: inatividade 14+d", () => {
  it("-30 total quando daysSinceLastReply=15", () => {
    const r = calculateLeadScore(
      input({ currentScore: 50, messageText: "", daysSinceLastReply: 15 })
    );
    expect(r.newScore).toBe(25); // 50 + 5(msg) - 30(inatividade_14d) = 25
    expect(r.reasons).toContain("inatividade_14d");
    expect(r.reasons).not.toContain("inatividade_7d");
  });

  it("14d dispara apenas inatividade_14d, não ambos", () => {
    const r = calculateLeadScore(
      input({ currentScore: 40, messageText: "", daysSinceLastReply: 14 })
    );
    expect(r.reasons).toContain("inatividade_14d");
    expect(r.reasons.filter((x) => x.startsWith("inatividade"))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — Status PERDIDO limita score máximo a 20
// ---------------------------------------------------------------------------

describe("penalidade: PERDIDO cap", () => {
  it("score máximo 20 para PERDIDO mesmo que sinais somem > 20", () => {
    const r = calculateLeadScore(
      input({
        currentScore: 10,
        leadStatus: "PERDIDO",
        // +30 intenção + +20 financiamento + +25 visita + +5 msg = 80 → raw 90 → cap 20
        messageText: "quero comprar financiamento endereço",
      })
    );
    expect(r.newScore).toBe(20);
    expect(r.reasons).toContain("perdido_cap");
  });

  it("lead PERDIDO com score já abaixo de 20 não sobe além de 20", () => {
    const r = calculateLeadScore(
      input({
        currentScore: 15,
        leadStatus: "PERDIDO",
        messageText: "quero comprar",
      })
    );
    expect(r.newScore).toBe(20);
  });

  it("lead PERDIDO com score 5 e texto neutro fica em 10 (abaixo do cap)", () => {
    const r = calculateLeadScore(
      input({ currentScore: 5, leadStatus: "PERDIDO", messageText: "oi" })
    );
    expect(r.newScore).toBe(10); // 5 + 5(msg) = 10, abaixo do cap, nenhum perdido_cap
    expect(r.reasons).not.toContain("perdido_cap");
  });
});

// ---------------------------------------------------------------------------
// Test 11 — Negation guard
// ---------------------------------------------------------------------------

describe("negation guard", () => {
  it('"não quero financiamento" NÃO dispara sinal de financiamento', () => {
    const withNeg = calculateLeadScore(input({ messageText: "não quero financiamento" }));
    const withoutNeg = calculateLeadScore(input({ messageText: "quero financiamento" }));
    expect(withNeg.reasons).not.toContain("financiamento");
    expect(withoutNeg.reasons).toContain("financiamento");
  });

  it('"sem financiamento" NÃO dispara sinal', () => {
    const r = calculateLeadScore(input({ messageText: "sem financiamento por favor" }));
    expect(r.reasons).not.toContain("financiamento");
  });

  it('"nunca quero parcela" NÃO dispara sinal', () => {
    const r = calculateLeadScore(input({ messageText: "nunca quero parcela" }));
    expect(r.reasons).not.toContain("financiamento");
  });

  it("negação em cláusula anterior NÃO bloqueia sinal em cláusula seguinte", () => {
    // "não gosto disso. quero financiamento" — duas cláusulas
    const r = calculateLeadScore(
      input({ messageText: "não gosto disso. quero financiamento" })
    );
    expect(r.reasons).toContain("financiamento");
  });
});

// ---------------------------------------------------------------------------
// Test 12 — delta == 0 → sem evento (verificado no retorno)
// ---------------------------------------------------------------------------

describe("delta == 0", () => {
  it("delta é zero quando score já está no limite e não há sinais", () => {
    // Score 100, sem sinais adicionais — clamp mantém em 100
    const r = calculateLeadScore(
      input({ currentScore: 100, messageText: "" })
    );
    // +5(msg) → 105 → clamped 100 → delta = 0
    expect(r.delta).toBe(0);
    expect(r.newScore).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Test 13 — Múltiplos sinais simultâneos não passam de 100
// ---------------------------------------------------------------------------

describe("clamp com múltiplos sinais", () => {
  it("múltiplos sinais simultâneos limitam em 100", () => {
    const r = calculateLeadScore(
      input({
        currentScore: 50,
        // +30 intenção + +20 financiamento + +10 veículo + +25 visita + +5 msg = 90
        messageText: "quero comprar financiamento honda endereço",
      })
    );
    expect(r.newScore).toBe(100);
    expect(r.delta).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Test 14 — Sinal: troca
// ---------------------------------------------------------------------------

describe("sinal: troca", () => {
  it("+15 para 'quero dar minha moto na troca'", () => {
    const r = calculateLeadScore(input({ messageText: "quero dar minha moto na troca" }));
    expect(r.delta).toBeGreaterThanOrEqual(15);
    expect(r.reasons).toContain("troca");
  });

  it("+15 para 'vocês aceitam troca?'", () => {
    const r = calculateLeadScore(input({ messageText: "vocês aceitam troca?" }));
    expect(r.reasons).toContain("troca");
  });

  it("+15 para 'tenho uma moto usada'", () => {
    const r = calculateLeadScore(input({ messageText: "tenho uma moto usada pra dar" }));
    expect(r.reasons).toContain("troca");
  });

  it("negação: 'não quero dar troca' não aciona o sinal", () => {
    const signals = detectSignals("não quero dar troca");
    expect(signals).not.toContain("troca");
  });
});

// ---------------------------------------------------------------------------
// Test 15 — Normalização: case insensitive + sem acento
// ---------------------------------------------------------------------------

describe("normalização de texto (test 15)", () => {
  it("'FINANCIAMENTO' pontua igual a 'financiamento'", () => {
    const upper = calculateLeadScore(input({ messageText: "FINANCIAMENTO" }));
    const lower = calculateLeadScore(input({ messageText: "financiamento" }));
    expect(upper.delta).toBe(lower.delta);
    expect(upper.reasons).toContain("financiamento");
  });

  it("'Quero Comprar' pontua igual a 'quero comprar'", () => {
    const mixed = calculateLeadScore(input({ messageText: "Quero Comprar" }));
    const lower = calculateLeadScore(input({ messageText: "quero comprar" }));
    expect(mixed.delta).toBe(lower.delta);
    expect(mixed.reasons).toContain("intencao_forte");
  });

  it("'NÃO QUERO financiamento' bloqueia igual a 'nao quero financiamento'", () => {
    const withAccent = detectSignals("NÃO QUERO financiamento");
    const withoutAccent = detectSignals("nao quero financiamento");
    expect(withAccent).not.toContain("financiamento");
    expect(withoutAccent).not.toContain("financiamento");
  });

  it("'HONDA' detecta veículo específico", () => {
    const r = calculateLeadScore(input({ messageText: "HONDA" }));
    expect(r.reasons).toContain("veiculo_especifico");
  });
});

// ---------------------------------------------------------------------------
// sinal: preco_negociacao (roadmap 1.11) — classificador determinístico
// pré-LLM pro handoff parcial por assunto. Propósito diferente do sinal
// "preco" (que mede interesse pra scoring): este decide se a mensagem nova
// pertence ao tópico suspenso de um handoff parcial. Não deve alimentar
// calculateLeadScore — só detectSignals é testado aqui.
// ---------------------------------------------------------------------------

describe("sinal: preco_negociacao (roadmap 1.11)", () => {
  it("'tem desconto nela?' aciona preco_negociacao", () => {
    expect(detectSignals("tem desconto nela?")).toContain("preco_negociacao");
  });

  it("'vc abaixa o valor?' aciona preco_negociacao", () => {
    expect(detectSignals("vc abaixa o valor?")).toContain("preco_negociacao");
  });

  it("'consegue diminuir um pouco?' aciona preco_negociacao", () => {
    expect(detectSignals("consegue diminuir um pouco?")).toContain("preco_negociacao");
  });

  it("'qual o menor preço que você faz?' aciona preco_negociacao", () => {
    expect(detectSignals("qual o menor preço que você faz?")).toContain("preco_negociacao");
  });

  it("'consegue baixar mais um pouco?' aciona preco_negociacao", () => {
    expect(detectSignals("consegue baixar mais um pouco?")).toContain("preco_negociacao");
  });

  it("'tem como abaixar o valor?' aciona preco_negociacao", () => {
    expect(detectSignals("tem como abaixar o valor?")).toContain("preco_negociacao");
  });

  it("negação: 'não quero desconto' não aciona o sinal", () => {
    expect(detectSignals("não quero desconto")).not.toContain("preco_negociacao");
  });

  it("'qual o preço da moto?' aciona só 'preco', nunca 'preco_negociacao' (sem overlap)", () => {
    const signals = detectSignals("qual o preço da moto?");
    expect(signals).toContain("preco");
    expect(signals).not.toContain("preco_negociacao");
  });

  it("'tem quantas 160 no momento?' (caso real BL-0011, pergunta de estoque) não aciona preco_negociacao", () => {
    expect(detectSignals("tem quantas 160 no momento?")).not.toContain("preco_negociacao");
  });

  it("'tem desconto nela?' não aciona o sinal 'preco' existente (sem overlap na outra direção)", () => {
    const signals = detectSignals("tem desconto nela?");
    expect(signals).not.toContain("preco");
  });
});
