import { describe, it, expect } from "vitest";
import { nextOnboardingStep, isOnboardingComplete, type OnboardingState } from "@/lib/onboarding";

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    nome: "Speed Motos",
    vendedorCount: 1,
    vehicleCount: 1,
    estoqueSkipped: false,
    whatsappPhoneNumberId: "123456",
    ...overrides,
  };
}

describe("nextOnboardingStep", () => {
  it("C1: sem nome → passo 'nome'", () => {
    expect(nextOnboardingStep(state({ nome: null }))).toBe("nome");
  });

  it("C2: nome vazio (whitespace) → passo 'nome'", () => {
    expect(nextOnboardingStep(state({ nome: "   " }))).toBe("nome");
  });

  it("C3: nome ok, zero vendedores → passo 'vendedores'", () => {
    expect(nextOnboardingStep(state({ vendedorCount: 0 }))).toBe("vendedores");
  });

  it("C4: nome + vendedor ok, zero veículos, não pulado → passo 'estoque'", () => {
    expect(nextOnboardingStep(state({ vehicleCount: 0, estoqueSkipped: false }))).toBe("estoque");
  });

  it("C5: zero veículos mas estoque pulado → avança pro whatsapp", () => {
    expect(
      nextOnboardingStep(state({ vehicleCount: 0, estoqueSkipped: true, whatsappPhoneNumberId: null }))
    ).toBe("whatsapp");
  });

  it("C6: tudo ok exceto whatsapp → passo 'whatsapp'", () => {
    expect(nextOnboardingStep(state({ whatsappPhoneNumberId: null }))).toBe("whatsapp");
  });

  it("C7: tudo completo → 'done'", () => {
    expect(nextOnboardingStep(state())).toBe("done");
  });

  it("C8: veículo existe mesmo sem ter sido pulado → conta como completo (passa pro whatsapp)", () => {
    expect(
      nextOnboardingStep(state({ vehicleCount: 3, estoqueSkipped: false, whatsappPhoneNumberId: null }))
    ).toBe("whatsapp");
  });
});

describe("isOnboardingComplete", () => {
  it("C9: retorna true quando nextOnboardingStep é 'done'", () => {
    expect(isOnboardingComplete(state())).toBe(true);
  });

  it("C10: retorna false quando falta qualquer passo", () => {
    expect(isOnboardingComplete(state({ nome: null }))).toBe(false);
    expect(isOnboardingComplete(state({ vendedorCount: 0 }))).toBe(false);
    expect(isOnboardingComplete(state({ vehicleCount: 0, estoqueSkipped: false }))).toBe(false);
    expect(isOnboardingComplete(state({ whatsappPhoneNumberId: null }))).toBe(false);
  });
});
