import { supabaseAdmin } from "@/lib/supabase";
import { getServerUserRole } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";

export type AuditAction =
  | "lead.reassigned"
  | "lead.unassigned"
  | "conversation.handoff_to_human"
  | "conversation.handoff_to_ai"
  | "message.manual_reply"
  | "lead.closed"
  | "user.created"
  | "vehicle.renave_stage_advanced";

export type AuditResourceType = "lead" | "conversation" | "user" | "vehicle";

export interface LogAuditParams {
  storeId: string;
  userId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Non-fatal pro fluxo que chama — nunca lança. Falha de escrita vai pro
 * Sentry (nunca invisível — sumir silenciosamente seria pior que a ação
 * em si falhar).
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const actorRole = params.userId ? await getServerUserRole() : null;
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      store_id: params.storeId,
      user_id: params.userId,
      actor_role: actorRole,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      metadata: params.metadata ?? null,
    });
    if (error) throw error;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { pipeline_stage: "audit_log" },
      extra: { action: params.action, resource_type: params.resourceType },
    });
  }
}
