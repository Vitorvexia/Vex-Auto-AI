import { describe, it, expect } from "vitest";
import { shouldRedirectToOnboarding, type OnboardingGuardInput } from "@/lib/onboarding-guard";

function input(overrides: Partial<OnboardingGuardInput> = {}): OnboardingGuardInput {
  return {
    pathname: "/leads",
    isSuperAdmin: false,
    role: "dono_loja",
    onboardingCompletedAt: null,
    ...overrides,
  };
}

describe("shouldRedirectToOnboarding", () => {
  it("G1: dono_loja com onboarding pendente em rota protegida → true", () => {
    expect(shouldRedirectToOnboarding(input())).toBe(true);
  });

  it("G2: dono_loja com onboarding completo → false", () => {
    expect(
      shouldRedirectToOnboarding(input({ onboardingCompletedAt: "2026-08-01T00:00:00Z" }))
    ).toBe(false);
  });

  it("G3: já está em /onboarding → false (evita loop)", () => {
    expect(shouldRedirectToOnboarding(input({ pathname: "/onboarding" }))).toBe(false);
  });

  it("G4: já está em /estoque → false (destino do botão 'Ir pro estoque agora')", () => {
    expect(shouldRedirectToOnboarding(input({ pathname: "/estoque" }))).toBe(false);
  });

  it("G5: vendedor → false, nunca vê o wizard", () => {
    expect(shouldRedirectToOnboarding(input({ role: "vendedor" }))).toBe(false);
  });

  it("G6: super_admin → false, mesmo com onboarding pendente", () => {
    expect(shouldRedirectToOnboarding(input({ isSuperAdmin: true }))).toBe(false);
  });

  it("G7: role null (usuário sem linha em public.users) → false", () => {
    expect(shouldRedirectToOnboarding(input({ role: null }))).toBe(false);
  });

  it("G8: sub-rota protegida (/estoque/novo) também é exceção", () => {
    expect(shouldRedirectToOnboarding(input({ pathname: "/estoque/novo" }))).toBe(false);
  });
});
