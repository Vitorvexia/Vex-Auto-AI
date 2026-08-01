import { describe, it, expect } from "vitest";
import {
  RENAVE_STAGES,
  RENAVE_STAGE_LABELS,
  nextRenaveStage,
  renaveStageRequiresNfeKey,
  checkRenaveStageAdvance,
  daysStalled,
  isRenaveStalled,
} from "@/lib/renave";

describe("nextRenaveStage — avanço sequencial", () => {
  it("entrada_registrada -> chave_nfe_vinculada", () => {
    expect(nextRenaveStage("entrada_registrada")).toBe("chave_nfe_vinculada");
  });

  it("chave_nfe_vinculada -> documentos_protocolados", () => {
    expect(nextRenaveStage("chave_nfe_vinculada")).toBe("documentos_protocolados");
  });

  it("documentos_protocolados -> saida_registrada", () => {
    expect(nextRenaveStage("documentos_protocolados")).toBe("saida_registrada");
  });

  it("saida_registrada não tem próxima etapa (null)", () => {
    expect(nextRenaveStage("saida_registrada")).toBeNull();
  });

  it("nunca pula etapa — sempre retorna o próximo imediato, nunca dois passos à frente", () => {
    for (let i = 0; i < RENAVE_STAGES.length - 1; i++) {
      const current = RENAVE_STAGES[i];
      const expected = RENAVE_STAGES[i + 1];
      expect(nextRenaveStage(current)).toBe(expected);
    }
  });
});

describe("renaveStageRequiresNfeKey", () => {
  it("entrada_registrada não exige nfe_key", () => {
    expect(renaveStageRequiresNfeKey("entrada_registrada")).toBe(false);
  });

  it("chave_nfe_vinculada em diante exige nfe_key", () => {
    expect(renaveStageRequiresNfeKey("chave_nfe_vinculada")).toBe(true);
    expect(renaveStageRequiresNfeKey("documentos_protocolados")).toBe(true);
    expect(renaveStageRequiresNfeKey("saida_registrada")).toBe(true);
  });
});

describe("checkRenaveStageAdvance", () => {
  it("bloqueia avanço a partir da última etapa (saida_registrada)", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "saida_registrada",
      existingNfeKey: "35260600000000000000550010000000011000000010",
    });
    expect(result.ok).toBe(false);
    expect(result.nextStage).toBeNull();
  });

  it("bloqueia 1->2 sem nfe_key (nem nova, nem existente)", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "entrada_registrada",
      existingNfeKey: null,
      newNfeKey: null,
    });
    expect(result.ok).toBe(false);
    expect(result.nextStage).toBe("chave_nfe_vinculada");
    expect(result.error).toMatch(/nf-e/i);
  });

  it("bloqueia 1->2 com nfe_key só espaços em branco", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "entrada_registrada",
      existingNfeKey: null,
      newNfeKey: "   ",
    });
    expect(result.ok).toBe(false);
  });

  it("permite 1->2 com nfe_key nova preenchida", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "entrada_registrada",
      existingNfeKey: null,
      newNfeKey: "35260600000000000000550010000000011000000010",
    });
    expect(result.ok).toBe(true);
    expect(result.nextStage).toBe("chave_nfe_vinculada");
  });

  it("permite 2->3 reaproveitando nfe_key já persistida, sem precisar reenviar", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "chave_nfe_vinculada",
      existingNfeKey: "35260600000000000000550010000000011000000010",
    });
    expect(result.ok).toBe(true);
    expect(result.nextStage).toBe("documentos_protocolados");
  });

  it("permite 3->4 (documentos_protocolados -> saida_registrada) com nfe_key já persistida", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "documentos_protocolados",
      existingNfeKey: "35260600000000000000550010000000011000000010",
    });
    expect(result.ok).toBe(true);
    expect(result.nextStage).toBe("saida_registrada");
  });

  it("nunca pula etapa — resultado ok sempre aponta pro próximo estágio da sequência, nunca além", () => {
    const result = checkRenaveStageAdvance({
      currentStage: "entrada_registrada",
      existingNfeKey: null,
      newNfeKey: "35260600000000000000550010000000011000000010",
    });
    expect(result.nextStage).not.toBe("documentos_protocolados");
    expect(result.nextStage).not.toBe("saida_registrada");
  });
});

describe("daysStalled / isRenaveStalled", () => {
  it("calcula dias parado corretamente", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const updatedAt = "2026-08-01T12:00:00.000Z";
    expect(daysStalled(updatedAt, now)).toBe(9);
  });

  it("nunca retorna negativo (timestamp no futuro por clock skew)", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    const updatedAt = "2026-08-05T00:00:00.000Z";
    expect(daysStalled(updatedAt, now)).toBe(0);
  });

  it("isRenaveStalled false com <= 7 dias parado", () => {
    const now = new Date("2026-08-08T00:00:00.000Z");
    const updatedAt = "2026-08-01T00:00:00.000Z";
    expect(isRenaveStalled(updatedAt, now)).toBe(false);
  });

  it("isRenaveStalled true com > 7 dias parado", () => {
    const now = new Date("2026-08-09T00:00:01.000Z");
    const updatedAt = "2026-08-01T00:00:00.000Z";
    expect(isRenaveStalled(updatedAt, now)).toBe(true);
  });
});

describe("RENAVE_STAGE_LABELS", () => {
  it("tem label pra cada estágio", () => {
    for (const stage of RENAVE_STAGES) {
      expect(RENAVE_STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});
