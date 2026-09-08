import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError, StoreNotFoundError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin-auth";
import { nextOnboardingStep } from "@/lib/onboarding";
import { OnboardingWizard } from "@/app/components/OnboardingWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Middleware (lib/onboarding-guard.ts) só REDIRECIONA pro /onboarding quem é
// dono_loja com onboarding pendente — nunca bloqueia vendedor/super_admin de
// visitar a URL diretamente (não é o alvo do gate). Esse guard aqui cobre
// esse caso: quem não é dono_loja, ou cuja loja já terminou, não vê o wizard.
//
// Perf (fix pós-BL-0026): getServerUserRole()+getServerStoreId() faziam 2
// auth.getUser() + 2 queries "users" separadas (role sozinho, store_id
// sozinho) — 100% redundante já que ambos leem a mesma linha. Resolvido aqui
// com 1 client + 1 getUser() + 1 select combinado. As 3 queries independentes
// que seguem (stores/vendedorCount/vehicleCount) rodam em Promise.all.
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  // Mesmo atalho que getServerUserRole() já fazia: super_admin nunca tem
  // necessariamente linha em public.users, então resolve por e-mail antes de
  // consultar o banco.
  if (isSuperAdmin(user.email)) {
    redirect("/inicio");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", user.id)
    .single();

  if (!profile?.store_id) throw new StoreNotFoundError(user.id);

  if (profile.role !== "dono_loja") {
    redirect("/inicio");
  }

  const storeId = profile.store_id;

  const [{ data: store }, { count: vendedorCount }, { count: vehicleCount }] = await Promise.all([
    supabase
      .from("stores")
      .select("nome, whatsapp_phone_number_id, onboarding_completed_at, estoque_wizard_skipped")
      .eq("id", storeId)
      .single(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("role", "vendedor"),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId),
  ]);

  if (store?.onboarding_completed_at) {
    redirect("/inicio");
  }

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
