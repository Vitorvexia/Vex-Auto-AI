import { describe, it, expect } from "vitest";
import { validateOutput } from "@/lib/ai";

const LEAD_SCORE = 30;

describe("validateOutput — guardrails de saída da IA", () => {
  // Casos base já cobertos em ai-validation.test.ts — aqui focamos nos novos guards

  it("strip de control chars em reply_text", () => {
    const raw = { reply_text: "Olá!\x00 Como\x07 posso\x1F ajudar?", should_handoff: false, score: 30, intent_tags: [], summary: "" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.reply_text).not.toMatch(/[\x00-\x08\x0E-\x1F]/);
    expect(result.reply_text).toContain("Olá!");
  });

  it("reply_text truncado ao limite de 4096 chars em validateOutput", () => {
    const raw = { reply_text: "A".repeat(5000), should_handoff: false, score: 30, intent_tags: [], summary: "" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.reply_text.length).toBeLessThanOrEqual(4096);
    expect(result.reply_text.endsWith("...")).toBe(true);
  });

  it("intent_tags limitadas a 10 itens", () => {
    const raw = {
      reply_text: "ok",
      should_handoff: false,
      score: 30,
      intent_tags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
      summary: "",
    };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.intent_tags.length).toBeLessThanOrEqual(10);
  });

  it("cada intent_tag truncada a 50 chars", () => {
    const raw = {
      reply_text: "ok",
      should_handoff: false,
      score: 30,
      intent_tags: ["A".repeat(100)],
      summary: "",
    };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.intent_tags[0].length).toBeLessThanOrEqual(50);
  });

  it("summary truncado a 1000 chars", () => {
    const raw = { reply_text: "ok", should_handoff: false, score: 30, intent_tags: [], summary: "X".repeat(2000) };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.summary.length).toBeLessThanOrEqual(1000);
  });

  it("summary recebe strip de control chars", () => {
    const raw = { reply_text: "ok", should_handoff: false, score: 30, intent_tags: [], summary: "Lead interessada\x00\x1F em SUV" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.summary).not.toMatch(/[\x00-\x08\x0E-\x1F]/);
    expect(result.summary).toContain("Lead interessada");
  });

  it("should_handoff sem boolean retorna false (fallback seguro)", () => {
    const raw = { reply_text: "ok", should_handoff: "yes", score: 30, intent_tags: [], summary: "" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.should_handoff).toBe(false);
  });

  it("score inválido (fora de 0-100) cai back para leadScore", () => {
    const raw = { reply_text: "ok", should_handoff: false, score: 150, intent_tags: [], summary: "" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.score).toBe(LEAD_SCORE);
  });

  it("score NaN cai back para leadScore", () => {
    const raw = { reply_text: "ok", should_handoff: false, score: NaN, intent_tags: [], summary: "" };
    const result = validateOutput(raw, LEAD_SCORE);
    expect(result.score).toBe(LEAD_SCORE);
  });
});

describe("validateOutput — replay guard (lib/replay-guard)", () => {
  it("primeiro WAMID não é considerado replay", async () => {
    const { isReplayedMessage } = await import("@/lib/replay-guard");
    // Usar ID único para não colidir com outros testes
    expect(isReplayedMessage("wamid-test-unique-001")).toBe(false);
  });

  it("mesmo WAMID na segunda chamada é replay", async () => {
    const { isReplayedMessage } = await import("@/lib/replay-guard");
    isReplayedMessage("wamid-test-unique-002");
    expect(isReplayedMessage("wamid-test-unique-002")).toBe(true);
  });

  it("WAMIDs diferentes não se interferem", async () => {
    const { isReplayedMessage } = await import("@/lib/replay-guard");
    isReplayedMessage("wamid-test-unique-003");
    expect(isReplayedMessage("wamid-test-unique-004")).toBe(false);
  });
});
