"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { validateDemoRequest, type DemoRequestInput } from "@/lib/demo-request";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";

/**
 * Server Action do formulário de CTA da landing page de vendas do Vex Auto
 * (roadmap 1.7) — rota pública, sem auth. Grava em demo_requests via
 * supabaseAdmin (service_role); tabela é consultada manualmente hoje, sem
 * UI própria. Assinatura (prevState, formData) segue o mesmo padrão de
 * submitPublicContactLead (lib/public-contact.ts) pra plugar direto em
 * useFormState no client component.
 *
 * Honeypot: mesmo mecanismo do formulário de contato do site de loja
 * (lib/public-contact-honeypot.ts) — campo invisível só bot preenche; se
 * preenchido, finge sucesso sem gravar nada.
 */
export type DemoRequestState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function createDemoRequest(
  _prevState: DemoRequestState,
  formData: FormData
): Promise<DemoRequestState> {
  if ((formData.get(HONEYPOT_FIELD_NAME) as string | null)?.trim()) {
    return { status: "success" };
  }

  const input: DemoRequestInput = {
    nome: (formData.get("nome") as string | null)?.trim() ?? "",
    empresa: (formData.get("empresa") as string | null)?.trim() ?? "",
    telefone: (formData.get("telefone") as string | null)?.trim() ?? "",
    email: (formData.get("email") as string | null)?.trim() || null,
    mensagem: (formData.get("mensagem") as string | null)?.trim() || null,
  };

  const validation = validateDemoRequest(input);
  if (!validation.valid) {
    return { status: "error", message: validation.message };
  }

  const { error } = await supabaseAdmin.from("demo_requests").insert({
    nome: input.nome,
    empresa: input.empresa,
    telefone: input.telefone,
    email: input.email,
    mensagem: input.mensagem,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível enviar. Tente novamente.",
    };
  }

  return { status: "success" };
}
