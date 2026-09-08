import { describe, it, expect } from "vitest";
import { getFunnelStage, calculateFunnelCounts, calculateFunnelConversion, calculateConversionRate, calculateStageBreakdown } from "@/lib/lead-funnel";

describe("getFunnelStage", () => {
  it("NOVO e ENGAJADO mapeiam pra frio", () => {
    expect(getFunnelStage("NOVO")).toBe("frio");
    expect(getFunnelStage("ENGAJADO")).toBe("frio");
  });

  it("INTERESSADO mapeia pra morno", () => {
    expect(getFunnelStage("INTERESSADO")).toBe("morno");
  });

  it("QUENTE e NEGOCIACAO mapeiam pra quente", () => {
    expect(getFunnelStage("QUENTE")).toBe("quente");
    expect(getFunnelStage("NEGOCIACAO")).toBe("quente");
  });

  it("FECHADO e PERDIDO ficam fora do funil (null)", () => {
    expect(getFunnelStage("FECHADO")).toBeNull();
    expect(getFunnelStage("PERDIDO")).toBeNull();
  });
});

describe("calculateFunnelCounts", () => {
  it("agrupa contagem por camada, fechado/perdido separados", () => {
    const statuses: Parameters<typeof calculateFunnelCounts>[0] = [
      "NOVO", "NOVO", "ENGAJADO",
      "INTERESSADO",
      "QUENTE", "NEGOCIACAO", "QUENTE",
      "FECHADO", "FECHADO", "PERDIDO",
    ];
    expect(calculateFunnelCounts(statuses)).toEqual({
      frio: 3,
      morno: 1,
      quente: 3,
      fechado: 2,
      perdido: 1,
    });
  });

  it("lista vazia retorna tudo zerado", () => {
    expect(calculateFunnelCounts([])).toEqual({
      frio: 0, morno: 0, quente: 0, fechado: 0, perdido: 0,
    });
  });
});

describe("calculateFunnelConversion", () => {
  it("calcula fração da camada anterior que avançou pra próxima", () => {
    const conversion = calculateFunnelConversion({ frio: 10, morno: 4, quente: 2, fechado: 0, perdido: 0 });
    expect(conversion.frioToMorno).toBeCloseTo(0.4);
    expect(conversion.mornoToQuente).toBeCloseTo(0.5);
  });

  it("camada anterior zerada retorna null (não 0%) — sem base pra medir taxa", () => {
    const conversion = calculateFunnelConversion({ frio: 0, morno: 0, quente: 3, fechado: 0, perdido: 0 });
    expect(conversion.frioToMorno).toBeNull();
    expect(conversion.mornoToQuente).toBeNull();
  });

  it("100% quando toda a camada anterior avançou", () => {
    const conversion = calculateFunnelConversion({ frio: 5, morno: 5, quente: 5, fechado: 0, perdido: 0 });
    expect(conversion.frioToMorno).toBe(1);
    expect(conversion.mornoToQuente).toBe(1);
  });
});

describe("calculateStageBreakdown", () => {
  it("frio: Novo 30 / Engajado 40 → 43%/57% (soma 100, maior resto arredonda pra cima) + quantidade", () => {
    const breakdown = calculateStageBreakdown("frio", { NOVO: 30, ENGAJADO: 40 });
    expect(breakdown).toEqual([
      { status: "NOVO", count: 30, percent: 43 },
      { status: "ENGAJADO", count: 40, percent: 57 },
    ]);
    expect(breakdown.reduce((sum, b) => sum + b.percent, 0)).toBe(100);
  });

  it("quente: Quente 8 / Negociação 3 → 73%/27%", () => {
    const breakdown = calculateStageBreakdown("quente", { QUENTE: 8, NEGOCIACAO: 3 });
    expect(breakdown).toEqual([
      { status: "QUENTE", count: 8, percent: 73 },
      { status: "NEGOCIACAO", count: 3, percent: 27 },
    ]);
    expect(breakdown.reduce((sum, b) => sum + b.percent, 0)).toBe(100);
  });

  it("morno: único status da camada — sempre 100% quando há pelo menos 1 lead", () => {
    expect(calculateStageBreakdown("morno", { INTERESSADO: 12 })).toEqual([
      { status: "INTERESSADO", count: 12, percent: 100 },
    ]);
  });

  it("camada sem leads retorna 0% pra cada status (não divide por zero)", () => {
    expect(calculateStageBreakdown("frio", {})).toEqual([
      { status: "NOVO", count: 0, percent: 0 },
      { status: "ENGAJADO", count: 0, percent: 0 },
    ]);
    expect(calculateStageBreakdown("morno", { INTERESSADO: 0 })).toEqual([
      { status: "INTERESSADO", count: 0, percent: 0 },
    ]);
  });

  it("empate exato sem resto — não sobra nem falta ponto percentual", () => {
    const breakdown = calculateStageBreakdown("frio", { NOVO: 5, ENGAJADO: 5 });
    expect(breakdown).toEqual([
      { status: "NOVO", count: 5, percent: 50 },
      { status: "ENGAJADO", count: 5, percent: 50 },
    ]);
  });
});

describe("calculateConversionRate", () => {
  it("fechados sobre todo o volume do período (inclui perdidos no denominador)", () => {
    // 10 fechados de 100 leads no período (30 frio + 20 morno + 15 quente + 10 fechado + 25 perdido)
    const rate = calculateConversionRate({ frio: 30, morno: 20, quente: 15, fechado: 10, perdido: 25 });
    expect(rate).toBeCloseTo(0.1);
  });

  it("sem nenhum lead no período retorna null (não 0%)", () => {
    expect(calculateConversionRate({ frio: 0, morno: 0, quente: 0, fechado: 0, perdido: 0 })).toBeNull();
  });

  it("100% quando todos os leads do período fecharam", () => {
    expect(calculateConversionRate({ frio: 0, morno: 0, quente: 0, fechado: 5, perdido: 0 })).toBe(1);
  });

  it("0% quando ninguém fechou (mas há leads no período)", () => {
    expect(calculateConversionRate({ frio: 3, morno: 2, quente: 1, fechado: 0, perdido: 4 })).toBe(0);
  });
});
