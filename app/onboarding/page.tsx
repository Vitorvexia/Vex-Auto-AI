import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getServerStoreId, getServerUserRole } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";
import { OnboardingWizard } from "@/app/components/OnboardingWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Middleware (lib/onboarding-guard.ts) só REDIRECIONA pro /onboarding quem é
// dono_loja com onboarding pendente — nunca bloqueia vendedor/super_admin de
// visitar a URL diretamente (não é o alvo do gate). Esse guard aqui cobre
// esse caso: quem não é dono_loja, ou cuja loja já terminou, não vê o wizard.
export default async function OnboardingPage() {
  const role = await getServerUserRole();
  if (role !== "dono_loja") {
    redirect("/inicio");
  }

  const storeId = await getServerStoreId();
  const supabase = await createSupabaseServerClient();

  const { data: store } = await supabase
    .from("stores")
    .select("nome, whatsapp_phone_number_id, onboarding_completed_at, estoque_wizard_skipped")
    .eq("id", storeId)
    .single();

  if (store?.onboarding_completed_at) {
    redirect("/inicio");
  }

  const { count: vendedorCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("role", "vendedor");

  const { count: vehicleCount } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  const step = nextOnboardingStep({
    nome: store?.nome ?? null,
    vendedorCount: vendedorCount ?? 0,
    vehicleCount: vehicleCount ?? 0,
    estoqueSkipped: store?.estoque_wizard_skipped ?? false,
    whatsappPhoneNumberId: store?.whatsapp_phone_number_id ?? null,
  });

  if (step === "done") {
    redirect("/inicio");
  }

  return (
    <main className="onboarding-shell">
      <OnboardingWizard currentStep={step} storeNome={store?.nome ?? ""} />
    </main>
  );
}
