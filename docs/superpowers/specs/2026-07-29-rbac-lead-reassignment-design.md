# RBAC (0.3) — travar reatribuição de lead por perfil

Data: 2026-07-29
Status: Aprovado (aguardando escrita do plano de implementação)
Roadmap: `docs/vex/53_ROADMAP.md` item 0.3

## Contexto

`docs/vex/27_PROJECT_STATUS.md` documenta a dívida: `assignLeadToUser`/`removeLeadAssignment` (`lib/actions.ts`) só validam `store_id` — qualquer usuário de uma loja pode reatribuir qualquer lead pra qualquer vendedor da mesma loja, sem checagem de papel. Existe precedente parcial de super-admin (`assertSuperAdmin()`, `lib/admin-auth.ts`, usado em `/admin`), mas nenhuma noção de papel formalizada dentro do fluxo de leads/vendedores.

## Achado que mudou o escopo original

`users.role` já existe desde a migration `001_initial.sql` (`check (role in ('admin','vendedor'))`), mas **nunca foi usado para controle de acesso** — só aparece em `lib/team-metrics.ts` pra exibição. `'admin'` aqui é escopado por loja (dono/gerente), semanticamente igual ao "dono_loja" do pedido original. Não era necessário criar coluna nova — só formalizar o uso do que já existe.

`super_admin` é hoje 100% independente dessa coluna: `ADMIN_EMAILS` (env var) + `isSuperAdmin(email)` + `assertSuperAdmin()` (redireciona se não autorizado). Nenhum usuário precisa de linha em `public.users` pra ser super-admin.

## Decisões fechadas

1. **Renomear `'admin'` → `'dono_loja'`** no valor da coluna `users.role` (schema + dados existentes) — evita ambiguidade futura com `super_admin`, que é um conceito diferente (cross-store, não tem role de loja).
2. **`super_admin` continua via `ADMIN_EMAILS`/`isSuperAdmin()`** — mecanismo existente, sem mudança. Não vira valor literal em `users.role` (super-admin não pertence a uma loja só; forçar isso criaria duas fontes de verdade pra mesma coisa).
3. **Escopo de visibilidade: sem mudança.** Vendedor continua vendo/respondendo qualquer lead da própria loja, exatamente como hoje. A única trava nova é sobre **quem pode reatribuir** um lead pra outro vendedor.
4. **Decisão explicitamente registrada em `docs/vex/29_DECISIONS_LOG.md` (DL-0008):** o gap maior (vendedor vê/responde lead de qualquer colega) fica pra quando houver loja real com 2+ vendedores ativos simultâneos — hoje o piloto (Speed Motos) tem 1 vendedor só, não há uso real pra desenhar a regra certa (dono vê tudo? cobertura de férias?). Desenhar sem esse dado é apostar no desenho errado.

## Achado operacional (durante validação técnica)

`supabase db dump` (usado pra confirmar o nome exato da constraint check de `role` antes de escrever `DROP CONSTRAINT`) exige Docker local, indisponível neste ambiente. Em vez de assumir o nome padrão (`users_role_check`) ou pedir uma autenticação OAuth nova só pra espiar um nome, a migration descobre a constraint em runtime via `pg_constraint` e dropa pelo nome real, o que for — elimina o risco de nome errado permanentemente, não só pra essa execução.

**A migration já foi executada manualmente em produção** (SQL Editor do Supabase, 2026-07-29, confirmado via query read-only: os 3 usuários com `role='admin'` agora têm `role='dono_loja'`, os 2 `role='vendedor'` intocados). O arquivo de migration entra no repo como registro do schema real, sem tentar reaplicar — `supabase migration list --linked` já mostra que 020/022–025 têm o mesmo padrão de aplicação manual sem tracking oficial do CLI (dívida pré-existente, fora de escopo deste item).

## Design técnico

### Migration `supabase/migrations/026_rename_admin_to_dono_loja.sql`

```sql
-- Já aplicada manualmente em produção em 2026-07-29 (confirmado via query
-- read-only). Constraint descoberta em runtime via pg_constraint — evita
-- assumir nome fixo (dump de schema pra confirmar nome exigia Docker,
-- indisponível no ambiente de dev).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

UPDATE public.users SET role = 'dono_loja' WHERE role = 'admin';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('dono_loja', 'vendedor'));
```

### `getServerUserRole()` — fonte única de verdade (`lib/auth.ts`)

```ts
export type UserRole = "super_admin" | "dono_loja" | "vendedor";

export async function getServerUserRole(): Promise<UserRole> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError();
  if (isSuperAdmin(user.email)) return "super_admin";
  const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!data?.role) throw new StoreNotFoundError(user.id);
  return data.role as UserRole;
}
```

Importa `isSuperAdmin` de `lib/admin-auth.ts` (sem dependência circular — `admin-auth.ts` não importa de `auth.ts`). `super_admin` e `dono_loja` tratados de forma idêntica pelo guard (`role !== "vendedor"`) — sem caso especial pra super-admin, sem duplicar a regra de "quem pode reatribuir" em vários lugares.

### Guard em `lib/actions.ts`

`assignLeadToUser` e `removeLeadAssignment` passam a chamar `getServerUserRole()` logo após `getServerStoreId()` e lançar erro (`throw new Error(...)`) se `role === "vendedor"`, antes de qualquer leitura/update no banco. Mesmo padrão determinístico já usado no projeto (guardrail de margem, coleta de financiamento) — regra garantida em código, nunca só escondendo UI.

### UI — `app/leads/page.tsx` + `LeadAssignmentSelect.tsx`

Server Component calcula `canReassign = role !== "vendedor"` (via `getServerUserRole()`) e passa como prop pro client component. Vendedor vê o `<select>` desabilitado (mantém consistência visual com o padrão de "campo bloqueado" já usado em outros formulários do projeto, em vez de sumir — evita confusão de "cadê o campo"). Isso é só UX — o guard do passo anterior é o mecanismo de segurança real.

### Testes

- `tests/unit/actions.test.ts` — adicionar casos pra `assignLeadToUser`/`removeLeadAssignment`: vendedor bloqueado (erro, sem update no banco), dono_loja permitido, super_admin permitido. Mockar `getServerUserRole` do jeito que `getServerStoreId`/`getServerUserId` já são mockados hoje nesse arquivo.
- `tests/unit/admin-actions.test.ts` — atualizar asserções que checam a string `'admin'` pra `'dono_loja'` (validação de role em `createStoreUser`/`createStoreUserDirect`).
- Suíte completa (`npm run test`) verde, lint/typecheck limpos.

### Arquivos que referenciam a string `'admin'` (renomear pra `'dono_loja'`)

- `app/admin/actions.ts` (validação `["admin", "vendedor"].includes(role)`, mensagem de erro)
- `app/admin/DirectUserForm.tsx` (UI de seleção de role no onboarding)
- `app/equipe/page.tsx` (exibição do role na tabela de equipe)
- `tests/unit/admin-actions.test.ts`

## Fora de escopo

- Impersonation (super-admin logar "como" outro usuário) — decisão explícita de não implementar, preserva integridade do futuro log de auditoria (0.5).
- Distribuição automática de leads (1.10) — depende deste item, mas é trabalho separado.
- Visibilidade restrita de lead por vendedor (ver DL-0008) — fica pra quando houver dado real de multi-vendedor.
- CRUD completo de gerenciamento de roles/permissões além do mínimo (onboarding via `/admin` já cobre criação com role).
- Reparo do drift de `supabase migration list` em 020/022–025 (achado incidental, não introduzido por este item).

## Documentação a atualizar no mesmo commit

- `docs/vex/27_PROJECT_STATUS.md` — nova entrada em RECENT COMPLETED WORK.
- `docs/vex/53_ROADMAP.md` — 0.3 → ✔ CONCLUÍDO.
- `docs/vex/29_DECISIONS_LOG.md` — nova entrada DL-0008 (texto abaixo, fornecido pelo usuário).

### DL-0008 (texto a inserir)

```
Title: Escopo reduzido de 0.3 (RBAC) — travar só reatribuição, visibilidade
de lead entre vendedores fica para quando houver multi-vendedor real

Context: dívida documentada em 27_PROJECT_STATUS.md é sobre reatribuição
sem controle. Existe também gap maior (qualquer vendedor vê/responde lead
de qualquer colega da mesma loja), mas hoje o piloto tem 1 vendedor só —
não há caso real pra desenhar a regra de visibilidade restrita com
informação de verdade (ex: dono da loja precisa ver tudo mesmo? vendedor
cobre colega de férias?).

Decision: implementar RBAC cobrindo só a reatribuição agora. Visibilidade
de lead entre vendedores continua irrestrita dentro da loja.

Reasoning: desenhar a regra de visibilidade sem uso real de multi-vendedor
é apostar no desenho errado. Esperar por um cliente/loja com 2+ vendedores
ativos dá dado real pra decidir a forma certa (visibilidade total pro dono,
exceções de cobertura, etc.), em vez de suposição.

Review Date (gatilho): primeira loja (piloto ou cliente novo) operando com
2+ vendedores simultâneos e ativos — nesse ponto, reavaliar e desenhar a
visibilidade restrita com base em uso real.

Owner: Founder
Status: Active
```
