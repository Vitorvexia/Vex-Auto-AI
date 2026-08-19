import { describe, it, expect } from "vitest";
import { getFunnelStage, calculateFunnelCounts } from "@/lib/lead-funnel";

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
