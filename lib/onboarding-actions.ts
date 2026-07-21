"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { assertStoreAdmin } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";

const E164_REGEX = /^\+[1-9][0-9]{6,14}$/;

async function maybeStampOnboardingComplete(storeId: string): Promise<void> {
  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("nome, whatsapp_phone_number_id, onboarding_completed_at, estoque_wizard_skipped")
    .eq("id", storeId)
    .single();

  if (!store || store.onboarding_completed_at) return;

  const { count: vendedorCount } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("role", "vendedor");

  const { count: vehicleCount } = await supabaseAdmin
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);

  const step = nextOnboardingStep({
    nome: store.nome,
    vendedorCount: vendedorCount ?? 0,
    vehicleCount: vehicleCount ?? 0,
    estoqueSkipped: store.estoque_wizard_skipped,
    whatsappPhoneNumberId: store.whatsapp_phone_number_id,
  });

  if (step === "done") {
    await supabaseAdmin
      .from("stores")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", storeId);
  }
}

export async function updateStoreNomeSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();
  const nome = ((formData.get("nome") as string | null) ?? "").trim();

  if (!nome) return { error: "Nome da loja é obrigatório" };

  const { error } = await supabaseAdmin.from("stores").update({ nome }).eq("id", storeId);
  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function createStoreVendedorSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true; email: string; password: string }> {
  const storeId = await assertStoreAdmin();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const nome = ((formData.get("nome") as string | null) ?? "").trim();

  if (!email || !nome) return { error: "email e nome são obrigatórios" };

  const { randomBytes } = await import("crypto");
  const password = randomBytes(12).toString("base64url").slice(0, 16);

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (authErr) return { error: authErr.message };
  if (!authData?.user?.id) return { error: "create_user_failed_no_id" };

  const { error: userErr } = await supabaseAdmin.from("users").insert({
    id: authData.user.id,
    store_id: storeId,
    nome,
    role: "vendedor",
  });

  if (userErr) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {
      console.error("rollback_failed: orphan auth user", authData.user.id.slice(-8));
    });
    return { error: userErr.message };
  }

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true, email, password };
}

export async function skipEstoqueOnboarding(): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ estoque_wizard_skipped: true })
    .eq("id", storeId);

  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function updateStoreWhatsAppSelfService(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const storeId = await assertStoreAdmin();
  const phoneNumberId = ((formData.get("whatsapp_phone_number_id") as string | null) ?? "").trim();
  const whatsappNumero = ((formData.get("whatsapp_numero") as string | null) ?? "").trim();

  if (!phoneNumberId) return { error: "Phone Number ID é obrigatório" };
  if (!whatsappNumero) return { error: "Número de WhatsApp é obrigatório" };
  if (!E164_REGEX.test(whatsappNumero)) {
    return { error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" };
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ whatsapp_phone_number_id: phoneNumberId, whatsapp_numero: whatsappNumero })
    .eq("id", storeId);

  if (error) return { error: error.message };

  await maybeStampOnboardingComplete(storeId);
  revalidatePath("/onboarding");
  return { success: true };
}
