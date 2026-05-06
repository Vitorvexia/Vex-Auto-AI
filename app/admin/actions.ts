"use server";

import { revalidatePath } from "next/cache";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

// assertSuperAdmin() é chamada no topo de cada action — Server Actions não herdam
// autenticação do Server Component que as invoca.

const E164_REGEX = /^\+[1-9][0-9]{6,14}$/;

export async function createStore(formData: FormData) {
  await assertSuperAdmin();

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const whatsappNumero = ((formData.get("whatsapp_numero") as string) ?? "").trim();
  const phoneId =
    ((formData.get("whatsapp_phone_number_id") as string) ?? "").trim() || null;

  if (!nome || !whatsappNumero)
    return { error: "nome e whatsapp_numero são obrigatórios" };

  if (!E164_REGEX.test(whatsappNumero))
    return { error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" };

  const { error } = await supabaseAdmin.from("stores").insert({
    nome,
    whatsapp_numero: whatsappNumero,
    whatsapp_phone_number_id: phoneId,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
}

export async function updateStore(storeId: string, formData: FormData) {
  await assertSuperAdmin();

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const whatsappNumero = ((formData.get("whatsapp_numero") as string) ?? "").trim();
  const phoneId =
    ((formData.get("whatsapp_phone_number_id") as string) ?? "").trim() || null;
  // Checkbox HTML: checked = "on", unchecked = nada (não "false")
  const active = formData.get("active") === "on";

  if (!nome || !whatsappNumero)
    return { error: "nome e whatsapp_numero são obrigatórios" };

  if (!E164_REGEX.test(whatsappNumero))
    return { error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" };

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ nome, whatsapp_numero: whatsappNumero, whatsapp_phone_number_id: phoneId, active })
    .eq("id", storeId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
}

export async function createStoreUser(formData: FormData) {
  await assertSuperAdmin();

  const email = ((formData.get("email") as string) ?? "").trim();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const role = formData.get("role") as "admin" | "vendedor";
  const storeId = formData.get("store_id") as string;

  if (!email || !nome || !storeId)
    return { error: "email, nome e store_id são obrigatórios" };

  const { data: authData, error: authErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
    });

  if (authErr) return { error: authErr.message };

  if (!authData?.user?.id) return { error: "invite_failed_no_user_id" };

  const { error: userErr } = await supabaseAdmin.from("users").insert({
    id: authData.user.id,
    store_id: storeId,
    nome,
    role,
  });

  if (userErr) {
    await supabaseAdmin.auth.admin
      .deleteUser(authData.user.id)
      .catch(() => {
        console.error("rollback_failed: orphan auth user", authData.user.id);
      });
    return { error: userErr.message };
  }

  revalidatePath("/admin");
  return { success: true, message: `Convite enviado para ${email}` };
}
