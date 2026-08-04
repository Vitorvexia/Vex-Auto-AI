"use server";

import { revalidatePath } from "next/cache";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { slugifyStoreName, nextAvailableSlug } from "@/lib/store-slug";

export type CreateStoreState = { success: true } | { error: string } | null;

export type CreateUserState =
  | { success: true; password: string; email: string }
  | { error: string }
  | null;

// assertSuperAdmin() é chamada no topo de cada action — Server Actions não herdam
// autenticação do Server Component que as invoca.

const E164_REGEX = /^\+[1-9][0-9]{6,14}$/;

// stores.slug é NOT NULL + UNIQUE desde a migration 033 (roadmap 1.3), mas
// essa migration só fez backfill das lojas que já existiam na hora — nunca
// atualizou este createStore() pra gerar slug em criações novas. Gap ficou
// sem dono até uma loja nova ser criada pela primeira vez pela UI (ver
// docs/vex/29_DECISIONS_LOG.md).
async function generateUniqueStoreSlug(nome: string): Promise<string> {
  const base = slugifyStoreName(nome);
  const { data } = await supabaseAdmin.from("stores").select("slug");
  const taken = new Set((data ?? []).map((s: { slug: string }) => s.slug));
  return nextAvailableSlug(base, taken);
}

export async function createStore(
  _prev: CreateStoreState,
  formData: FormData
): Promise<CreateStoreState> {
  await assertSuperAdmin();

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const whatsappNumero = ((formData.get("whatsapp_numero") as string) ?? "").trim();
  const phoneId =
    ((formData.get("whatsapp_phone_number_id") as string) ?? "").trim() || null;

  if (!nome || !whatsappNumero)
    return { error: "nome e whatsapp_numero são obrigatórios" };

  if (!E164_REGEX.test(whatsappNumero))
    return { error: "formato inválido: use +55DDD9XXXXXXXX (E.164)" };

  const slug = await generateUniqueStoreSlug(nome);

  const { error } = await supabaseAdmin.from("stores").insert({
    nome,
    whatsapp_numero: whatsappNumero,
    whatsapp_phone_number_id: phoneId,
    slug,
  });

  if (error) {
    if (error.code === "23505") {
      if (error.message.toLowerCase().includes("slug")) {
        return { error: "Conflito ao gerar identificador da loja — tente salvar de novo." };
      }
      return { error: "Já existe uma loja cadastrada com este WhatsApp." };
    }
    return { error: error.message };
  }
  revalidatePath("/admin");
  return { success: true };
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
  const actorId = await assertSuperAdmin();

  const email = ((formData.get("email") as string) ?? "").trim();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const role = formData.get("role") as "dono_loja" | "vendedor";
  const storeId = formData.get("store_id") as string;

  if (!email || !nome || !storeId)
    return { error: "email, nome e store_id são obrigatórios" };

  if (!["dono_loja", "vendedor"].includes(role))
    return { error: "role inválido: use 'dono_loja' ou 'vendedor'" };

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
        console.error("rollback_failed: orphan auth user", authData.user.id.slice(-8));
      });
    return { error: userErr.message };
  }

  await logAudit({
    storeId,
    userId: actorId,
    action: "user.created",
    resourceType: "user",
    resourceId: authData.user.id,
    metadata: { role },
  });

  revalidatePath("/admin");
  return { success: true, message: `Convite enviado para ${email}` };
}

export async function createStoreUserDirect(
  storeId: string,
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const actorId = await assertSuperAdmin();

  const email = ((formData.get("email") as string) ?? "").trim();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const role = formData.get("role") as "dono_loja" | "vendedor";

  if (!email || !nome || !storeId)
    return { error: "email, nome e store_id são obrigatórios" };

  if (!["dono_loja", "vendedor"].includes(role))
    return { error: "role inválido: use 'dono_loja' ou 'vendedor'" };

  const { randomBytes } = await import("crypto");
  const password = randomBytes(12).toString("base64url").slice(0, 16);

  const { data: authData, error: authErr } =
    await supabaseAdmin.auth.admin.createUser({
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
    role,
  });

  if (userErr) {
    await supabaseAdmin.auth.admin
      .deleteUser(authData.user.id)
      .catch(() => {
        console.error("rollback_failed: orphan auth user", authData.user.id.slice(-8));
      });
    return { error: userErr.message };
  }

  await logAudit({
    storeId,
    userId: actorId,
    action: "user.created",
    resourceType: "user",
    resourceId: authData.user.id,
    metadata: { role },
  });

  revalidatePath("/admin");
  return { success: true, password, email };
}

// Suporte pra destravar uma loja com onboarding preso (BL-0026, spec Edge
// Case 5) — onboarding_completed_at nunca é limpo automaticamente, só aqui.
export async function resetStoreOnboarding(
  storeId: string
): Promise<{ error: string } | { success: true }> {
  await assertSuperAdmin();

  const { error } = await supabaseAdmin
    .from("stores")
    .update({ onboarding_completed_at: null })
    .eq("id", storeId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
