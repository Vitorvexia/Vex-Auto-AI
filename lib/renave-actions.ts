"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerStoreId, getServerUserId, getServerUserRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRenaveStageAdvance, type RenaveStage } from "@/lib/renave";

/**
 * Avança o veículo pra próxima etapa da sequência de RENAVE (sempre um
 * degrau — nunca pula, ignora qualquer target_stage vindo do form). Reaproveita
 * RBAC existente: dono_loja e vendedor podem, nenhum nível novo criado.
 */
export async function advanceRenaveStage(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  const role = await getServerUserRole();
  if (role !== "dono_loja" && role !== "vendedor") {
    throw new Error("Apenas dono da loja ou vendedor podem avançar o status de RENAVE.");
  }

  const [storeId, actorId] = await Promise.all([getServerStoreId(), getServerUserId()]);

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id, renave_stage, renave_nfe_key")
    .eq("id", vehicleId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!vehicle) throw new Error("Veículo não encontrado");

  const nfeKeyInput = ((formData.get("nfe_key") as string | null) ?? "").trim() || null;

  const check = checkRenaveStageAdvance({
    currentStage: vehicle.renave_stage as RenaveStage,
    existingNfeKey: vehicle.renave_nfe_key,
    newNfeKey: nfeKeyInput,
  });
  if (!check.ok || !check.nextStage) {
    throw new Error(check.error ?? "Não é possível avançar o status de RENAVE.");
  }

  const update: Record<string, unknown> = {
    renave_stage: check.nextStage,
    renave_stage_updated_by: actorId,
    renave_stage_updated_at: new Date().toISOString(),
  };
  if (nfeKeyInput) update.renave_nfe_key = nfeKeyInput;

  const { error } = await supabaseAdmin
    .from("vehicles")
    .update(update)
    .eq("id", vehicleId)
    .eq("store_id", storeId);
  if (error) throw error;

  await logAudit({
    storeId,
    userId: actorId,
    action: "vehicle.renave_stage_advanced",
    resourceType: "vehicle",
    resourceId: vehicleId,
    metadata: { from_stage: vehicle.renave_stage, to_stage: check.nextStage },
  });

  revalidatePath("/renave");
  revalidatePath("/estoque");
}
