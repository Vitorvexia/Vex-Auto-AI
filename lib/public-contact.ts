"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { resolveStoreIdBySlug } from "@/lib/public-store";
import { ingestLeadManually } from "@/lib/lead-ingestion";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";

/**
 * Formulário de contato do site público da loja (roadmap 1.4) — cria lead
 * via ingestLeadManually com origem="site". Server Action roda no servidor,
 * pode usar supabaseAdmin (service_role) com segurança — não é o cliente
 * de leitura pública (lib/supabase-public.ts), que nunca pode ter esse
 * privilégio (decisão nº 5 do roadmap 1.3).
 *
 * Honeypot: campo invisível (via CSS no client component) que só bot
 * preenche. Se preenchido, descarta o envio silenciosamente — nunca cria
 * lead, nunca expõe erro que ensine o bot a se adaptar. Finge sucesso.
 * Nome do campo mora em lib/public-contact-honeypot.ts — um módulo
 * "use server" só pode exportar async functions.
 */
export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function submitPublicContactLead(
  slug: string,
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  if ((formData.get(HONEYPOT_FIELD_NAME) as string | null)?.trim()) {
    return { status: "success" };
  }

  const nome = (formData.get("nome") as string | null)?.trim() ?? "";
  const telefone = (formData.get("telefone") as string | null)?.trim() ?? "";
  const mensagem = (formData.get("mensagem") as string | null)?.trim() || null;

  if (!nome) return { status: "error", message: "Informe seu nome." };
  if (!telefone) return { status: "error", message: "Informe seu telefone." };

  const storeId = await resolveStoreIdBySlug(supabaseAdmin, slug);
  if (!storeId) {
    return { status: "error", message: "Loja não encontrada." };
  }

  const result = await ingestLeadManually({
    nome,
    telefone,
    origem: "site",
    observacao: mensagem,
    storeId,
  });

  if (result.status === "invalid_phone") {
    return { status: "error", message: "Telefone inválido. Use DDD + número." };
  }
  if (result.status === "invalid_input" || result.status === "missing_store") {
    return { status: "error", message: "Não foi possível enviar. Tente novamente." };
  }

  return { status: "success" };
}
