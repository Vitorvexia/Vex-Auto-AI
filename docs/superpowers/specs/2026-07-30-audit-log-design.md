# Log de Auditoria (0.5) — Design

Data: 2026-07-30
Status: Aprovado (aguardando escrita do plano de implementação)
Roadmap: `docs/vex/53_ROADMAP.md` item 0.5

## Contexto

LGPD + rastreabilidade — vira obrigatório quando RENAVE entrar (~set/2026). Dependia de 0.3 (RBAC), concluído — `getServerUserRole()` (`lib/auth.ts`) já existe como fonte única de identidade/perfil, reutilizada aqui pra capturar `actor_role`.

Não é observability de erro (isso já é Sentry, 0.4) — é trilha de **quem fez o quê, quando**, em ações sensíveis executadas por humanos no sistema.

## Achado que mudou o escopo original

O pedido original listava `user.role_changed` como uma das ações a auditar. Não existe fluxo de edição de role de usuário já existente no código — `app/admin/actions.ts` só define `role` na criação (`createStoreUser`/`createStoreUserDirect`), nunca depois. Decisão: logar `user.created` (com o role definido na criação) em vez de `user.role_changed`. Se um dia existir edição de role pós-criação, adiciona-se `user.role_changed` naquele momento — não antes.

## Decisões fechadas

1. **Escopo mínimo de captura** — 7 ações, todas em `lib/actions.ts` (6) e `app/admin/actions.ts` (1):
   - `lead.reassigned` (`assignLeadToUser`)
   - `lead.unassigned` (`removeLeadAssignment`)
   - `conversation.handoff_to_human` (`assignConversationToHuman`)
   - `conversation.handoff_to_ai` (`returnConversationToAI`)
   - `message.manual_reply` (`sendManualReply`)
   - `lead.closed` (`updateLeadStatus`, só quando `newStatus === "FECHADO"`)
   - `user.created` (`createStoreUser` e `createStoreUserDirect`, mesma action string pros dois — ambos criam usuário, só o método de convite difere)
2. **Só ação bem-sucedida** — tentativa negada pelo guard de RBAC (ex: vendedor bloqueado em `assignLeadToUser`) **não** gera entrada nesta etapa. Fica como item separado se surgir caso real de precisar auditar tentativas de bypass.
3. **`actor_role` congelado no momento da ação** — coluna própria, capturada via `getServerUserRole()` no momento do `logAudit()`. Histórico não pode ser reescrito retroativamente se o role da pessoa mudar depois (ex: vendedor promovido a dono_loja não pode fazer logs antigos parecerem que foram feitos por um dono_loja).
4. **Falha de escrita em `audit_logs` é non-fatal pro fluxo, mas nunca invisível** — a Server Action que chamou `logAudit()` não quebra se o insert falhar, mas o erro vai pro Sentry (`captureException`, já ativo desde 0.4). Auditoria sumindo silenciosamente seria pior que a ação em si falhar — ninguém saberia que o rastro se perdeu.
5. **RLS zero-policy desde o desenho** — `audit_logs` tem RLS habilitado e nenhuma policy (leitura/escrita só via `service_role`/Server Action). Mesmo princípio corrigido reativamente em `leads` na migration 027 (achado da review final do RBAC) — aplicado aqui desde o início, não descoberto depois numa review.
6. **Sem UI de consulta nesta etapa** — captura confiável é o entregável. Visualização fica pra quando houver necessidade real (RENAVE ou cliente pedindo).

## Design técnico

### Migration `supabase/migrations/028_audit_logs.sql`

```sql
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  actor_role    text,
  action        text not null,
  resource_type text not null,
  resource_id   uuid not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_store_created_idx on public.audit_logs (store_id, created_at desc);

alter table public.audit_logs enable row level security;
-- Sem policies = acesso apenas via service_role (mesmo princípio de 001_initial.sql
-- e da correção aplicada em leads na migration 027). Quando existir UI de consulta,
-- adicionar policy de SELECT escopada a super_admin/dono_loja da própria loja
-- naquele momento — não antes, pra não deixar acesso liberado sem consumidor real.
```

`user_id` nullable (ações de sistema/cron, nenhuma das 7 ações do escopo mínimo usa isso hoje — é proteção de schema pra uso futuro, ex: jobs automáticos). `resource_id` sempre `uuid` — as 7 ações do escopo mínimo sempre referenciam lead/conversation/user, todos uuid.

### `lib/audit.ts` (novo)

```ts
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
  | "user.created";

export type AuditResourceType = "lead" | "conversation" | "user";

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
 * Sentry (não pode sumir silenciosamente, é trilha de auditoria).
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
```

### Pontos de chamada (`lib/actions.ts`)

Cada `logAudit(...)` entra **depois** que a ação já foi executada com sucesso (após o `revalidatePath`, mesma posição de outras chamadas non-fatal como `markReactivationConverted`), `await`ado mas sem `try/catch` no call site (o non-fatal já está dentro de `logAudit`).

- `assignLeadToUser`: precisa do `assigned_to` anterior — buscar antes do update (já faz um `select` de guard, ampliar pra incluir `assigned_to`). `logAudit({storeId, userId: await getServerUserId(), action: "lead.reassigned", resourceType: "lead", resourceId: leadId, metadata: {previous_assigned_to, new_assigned_to: userId}})`.
- `removeLeadAssignment`: mesma lógica, sem `new_assigned_to`.
- `assignConversationToHuman`/`returnConversationToAI`: **não chamam `getServerUserId()` hoje** — precisa adicionar (`Promise.all` com `getServerStoreId()`, mesmo padrão de `sendManualReply`). `resourceId` = `conversationId`, `metadata: {lead_id: check.lead_id}`.
- `sendManualReply`: `userId` já disponível. `resourceId` = `conversationId`, `metadata: {lead_id: conv.lead_id, message_id: messageId}` (só se `messageId` não for null).
- `updateLeadStatus`: só quando `newStatus === "FECHADO"` — precisa adicionar `getServerUserId()` (hoje só chama `getServerStoreId()`). `resourceId` = `leadId`, `metadata: {vehicle_id: vehicleId, valor_final: valorFinal}`.

### Ponto de chamada (`app/admin/actions.ts`)

- `createStoreUser`: depois do insert em `users` bem-sucedido. `userId` (ator) = `await assertSuperAdmin()` (já retorna o id do super-admin autenticado). `resourceId` = `authData.user.id` (o usuário criado). `metadata: {role}`.
- `createStoreUserDirect`: mesma lógica.

### Testes

Um teste por action, verificando que exatamente 1 insert em `audit_logs` acontece com `store_id`/`user_id`/`action`/`resource_id` corretos — mockando `supabaseAdmin.from("audit_logs").insert` do jeito que os outros arquivos de teste já mockam `supabaseAdmin`. Caso adicional: insert falhando não propaga erro pra Server Action (non-fatal) e chama `Sentry.captureException`.

## Fora de escopo

- Tentativa negada pelo guard de RBAC — decisão explícita, ver "Decisões fechadas" item 2.
- `user.role_changed` — não existe fluxo de edição de role hoje, ver "Achado que mudou o escopo original".
- UI de consulta de auditoria — ver "Decisões fechadas" item 6.
- Policy de SELECT em `audit_logs` — só quando existir consumidor real (UI), ver comentário na migration.
- Retenção/expurgo de logs antigos — não solicitado, revisitar se LGPD exigir limite de retenção quando RENAVE definir o requisito concreto.

## Documentação a atualizar no mesmo commit

- `docs/vex/27_PROJECT_STATUS.md` — nova entrada em RECENT COMPLETED WORK.
- `docs/vex/53_ROADMAP.md` — 0.5 → ✔ CONCLUÍDO.
