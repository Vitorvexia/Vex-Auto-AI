"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerStoreId, getServerUserRole } from "@/lib/auth";
import {
  STORE_LOGO_BUCKET,
  isValidHexColor,
  sanitizeStoreText,
  validateLogoFile,
} from "@/lib/store-settings";

const TELEFONE_MAX_LENGTH = 30;
const ENDERECO_MAX_LENGTH = 300;
const SOBRE_MAX_LENGTH = 1000;

async function assertCanEditStoreSettings(): Promise<string> {
  const storeId = await getServerStoreId();
  const role = await getServerUserRole();
  if (role === "vendedor") {
    throw new Error("Apenas o dono da loja pode editar as configurações");
  }
  return storeId;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Atualiza cor primária, telefone público, endereço e texto "sobre" da loja.
 * Logo tem action própria (uploadStoreLogo) — é upload de arquivo, não campo
 * de formulário de texto.
 */
export async function updateStoreSettings(formData: FormData): Promise<void> {
  const storeId = await assertCanEditStoreSettings();

  const corRaw = (formData.get("cor_primaria") as string | null)?.trim() ?? "";
  if (corRaw && !isValidHexColor(corRaw)) {
    throw new Error("Cor primária inválida — use o formato #RRGGBB");
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update({
      cor_primaria: corRaw || null,
      telefone_publico: sanitizeStoreText(formData.get("telefone_publico") as string | null, TELEFONE_MAX_LENGTH),
      endereco: sanitizeStoreText(formData.get("endereco") as string | null, ENDERECO_MAX_LENGTH),
      sobre: sanitizeStoreText(formData.get("sobre") as string | null, SOBRE_MAX_LENGTH),
    })
    .eq("id", storeId);

  if (error) throw error;

  revalidatePath("/configuracoes");
}

/**
 * Sobe o logo pro Storage em path fixo `{store_id}/logo.{ext}` — upsert:true
 * substitui o anterior no mesmo path, nunca acumula lixo (diferente de
 * vehicle-photos, que é galeria incremental).
 */
export async function uploadStoreLogo(formData: FormData): Promise<void> {
  const storeId = await assertCanEditStoreSettings();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo de logo.");
  }

  const check = validateLogoFile({ type: file.type, size: file.size, name: file.name });
  if (!check.ok) throw new Error(check.error);

  const ext = EXT_BY_TYPE[file.type] ?? "jpg";
  const path = `${storeId}/logo.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORE_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Falha ao subir logo: ${uploadError.message}`);

  const { data: publicUrlData } = supabaseAdmin.storage.from(STORE_LOGO_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabaseAdmin
    .from("stores")
    .update({ logo_url: publicUrlData.publicUrl })
    .eq("id", storeId);
  if (updateError) throw updateError;

  revalidatePath("/configuracoes");
}
