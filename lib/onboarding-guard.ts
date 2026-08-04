// Decisão pura de redirect pro wizard de onboarding — usada pelo middleware
// (Edge Runtime). Sem I/O aqui de propósito: o middleware já resolve sessão +
// 1 query (role/store_id/onboarding_completed_at) e passa o resultado pra cá,
// mesmo princípio de lib/onboarding.ts (nextOnboardingStep) e lib/subdomain.ts
// — lógica de decisão isolada da leitura de dado, testável sem mockar Supabase.

export type OnboardingGuardInput = {
  pathname: string;
  isSuperAdmin: boolean;
  role: string | null;
  onboardingCompletedAt: string | null;
};

// /estoque é exceção deliberada: o passo "estoque" do wizard oferece um botão
// "Ir pro estoque agora" que linka pra página real (evita duplicar o form de
// veículo dentro do wizard) — sem essa exceção o gate mandaria o usuário de
// volta pro /onboarding assim que ele clicasse.
const ONBOARDING_EXEMPT_PREFIXES = ["/onboarding", "/estoque"];

export function isOnboardingExemptPath(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function shouldRedirectToOnboarding(input: OnboardingGuardInput): boolean {
  if (isOnboardingExemptPath(input.pathname)) return false;
  if (input.isSuperAdmin) return false;
  if (input.role !== "dono_loja") return false;
  return input.onboardingCompletedAt == null;
}
