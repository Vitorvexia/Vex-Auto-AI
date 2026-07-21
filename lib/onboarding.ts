export type OnboardingState = {
  nome: string | null;
  vendedorCount: number;
  vehicleCount: number;
  estoqueSkipped: boolean;
  whatsappPhoneNumberId: string | null;
};

export type OnboardingStep = "nome" | "vendedores" | "estoque" | "whatsapp" | "done";

export function nextOnboardingStep(state: OnboardingState): OnboardingStep {
  if (!state.nome || state.nome.trim() === "") return "nome";
  if (state.vendedorCount < 1) return "vendedores";
  if (!state.estoqueSkipped && state.vehicleCount < 1) return "estoque";
  if (!state.whatsappPhoneNumberId) return "whatsapp";
  return "done";
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return nextOnboardingStep(state) === "done";
}
