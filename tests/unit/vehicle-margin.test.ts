import { describe, it, expect } from "vitest";
import { marginPercent } from "@/lib/vehicle-margin";

describe("marginPercent", () => {
  it("T1: preco 20000, custo 15000 → 25%", () => {
    expect(marginPercent(20000, 15000)).toBe(25);
  });

  it("T2: custo <= 0 → 0 (custo não informado)", () => {
    expect(marginPercent(20000, 0)).toBe(0);
  });

  it("T3: custo negativo → 0", () => {
    expect(marginPercent(20000, -100)).toBe(0);
  });

  it("T4: preco <= 0 → 0 (nunca Infinity/NaN)", () => {
    expect(marginPercent(0, 15000)).toBe(0);
    expect(Number.isFinite(marginPercent(0, 15000))).toBe(true);
  });

  it("T5: custo igual ao preco → margem 0%", () => {
    expect(marginPercent(20000, 20000)).toBe(0);
  });

  it("T6: custo maior que preco → margem negativa", () => {
    expect(marginPercent(20000, 24000)).toBe(-20);
  });
});
