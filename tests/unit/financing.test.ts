import { describe, it, expect } from "vitest";
import {
  simulateFinancing,
  DEFAULT_MONTHLY_RATE,
} from "@/lib/financing";

// ---------------------------------------------------------------------------
// F1 — PMT caso base
// Veículo R$50.000, sem entrada, 48 meses, taxa padrão 1.8% a.m.
// ---------------------------------------------------------------------------

describe("simulateFinancing — PMT caso base", () => {
  it("F1: retorna monthly_payment positivo e financed_amount = vehicle_price quando entry = 0", () => {
    const result = simulateFinancing({
      vehicle_price: 50000,
      entry_value: 0,
      term_months: 48,
    });

    expect(result.financed_amount).toBe(50000);
    expect(result.monthly_payment).toBeGreaterThan(1000);
    expect(result.monthly_payment).toBeLessThan(3000);
    expect(result.monthly_rate).toBe(DEFAULT_MONTHLY_RATE);
    expect(result.term_months).toBe(48);
  });

  it("F1b: com entrada reduz financed_amount", () => {
    const result = simulateFinancing({
      vehicle_price: 50000,
      entry_value: 10000,
      term_months: 48,
    });

    expect(result.financed_amount).toBe(40000);
    expect(result.monthly_payment).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// F2 — entry_value >= vehicle_price → throw
// ---------------------------------------------------------------------------

describe("simulateFinancing — validação entry_value", () => {
  it("F2a: entry_value igual ao vehicle_price → lança erro", () => {
    expect(() =>
      simulateFinancing({ vehicle_price: 30000, entry_value: 30000, term_months: 24 })
    ).toThrow();
  });

  it("F2b: entry_value maior que vehicle_price → lança erro", () => {
    expect(() =>
      simulateFinancing({ vehicle_price: 30000, entry_value: 35000, term_months: 24 })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// F3 — vehicle_price <= 0 → throw
// ---------------------------------------------------------------------------

describe("simulateFinancing — validação vehicle_price", () => {
  it("F3a: vehicle_price = 0 → lança erro", () => {
    expect(() =>
      simulateFinancing({ vehicle_price: 0, entry_value: 0, term_months: 24 })
    ).toThrow();
  });

  it("F3b: vehicle_price negativo → lança erro", () => {
    expect(() =>
      simulateFinancing({ vehicle_price: -1000, entry_value: 0, term_months: 24 })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// F4 — monthly_rate omitido → usa DEFAULT_MONTHLY_RATE
// ---------------------------------------------------------------------------

describe("simulateFinancing — monthly_rate opcional", () => {
  it("F4: sem monthly_rate → monthly_rate no resultado = DEFAULT_MONTHLY_RATE", () => {
    const result = simulateFinancing({
      vehicle_price: 40000,
      entry_value: 0,
      term_months: 36,
    });

    expect(result.monthly_rate).toBe(DEFAULT_MONTHLY_RATE);
  });

  it("F4b: com monthly_rate explícito → usa o valor fornecido", () => {
    const result = simulateFinancing({
      vehicle_price: 40000,
      entry_value: 0,
      term_months: 36,
      monthly_rate: 0.02,
    });

    expect(result.monthly_rate).toBe(0.02);
  });
});

// ---------------------------------------------------------------------------
// F5 — monthly_rate = 0 → parcela = principal / prazo (sem juros)
// ---------------------------------------------------------------------------

describe("simulateFinancing — guard clause rate = 0", () => {
  it("F5: monthly_rate = 0 → monthly_payment = financed_amount / term_months", () => {
    const result = simulateFinancing({
      vehicle_price: 48000,
      entry_value: 0,
      term_months: 48,
      monthly_rate: 0,
    });

    expect(result.monthly_payment).toBe(1000);
    expect(result.total_amount).toBeCloseTo(48000, 1);
    expect(result.monthly_rate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// F6 — total_amount ≈ monthly_payment × term_months
// ---------------------------------------------------------------------------

describe("simulateFinancing — consistência total_amount", () => {
  it("F6: total_amount deve ser aproximadamente monthly_payment × term_months (tolerância 1 centavo)", () => {
    const result = simulateFinancing({
      vehicle_price: 60000,
      entry_value: 5000,
      term_months: 60,
    });

    const calculatedTotal = Math.round(result.monthly_payment * result.term_months * 100) / 100;
    // Tolerância: arredondamento por parcela é ±0.005, acumula até n * 0.005
    const maxError = result.term_months * 0.005 + 0.01;
    expect(Math.abs(result.total_amount - calculatedTotal)).toBeLessThan(maxError);
  });
});

// ---------------------------------------------------------------------------
// F7 — nunca NaN nem Infinity
// ---------------------------------------------------------------------------

describe("simulateFinancing — sem NaN nem Infinity", () => {
  it("F7a: taxa padrão não produz NaN", () => {
    const result = simulateFinancing({
      vehicle_price: 100000,
      entry_value: 20000,
      term_months: 72,
    });

    expect(Number.isNaN(result.monthly_payment)).toBe(false);
    expect(Number.isFinite(result.monthly_payment)).toBe(true);
    expect(Number.isNaN(result.total_amount)).toBe(false);
    expect(Number.isFinite(result.total_amount)).toBe(true);
  });

  it("F7b: rate = 0 não produz NaN nem Infinity", () => {
    const result = simulateFinancing({
      vehicle_price: 30000,
      entry_value: 0,
      term_months: 30,
      monthly_rate: 0,
    });

    expect(Number.isNaN(result.monthly_payment)).toBe(false);
    expect(Number.isFinite(result.monthly_payment)).toBe(true);
  });
});
