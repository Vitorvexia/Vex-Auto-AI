# Tests

Camada de testes de fundação do Vex Auto.

## Estrutura

- `tests/unit/*` — funções puras (sem Supabase). Rodam sempre.
- `tests/integration/*` — tocam o banco real. Pulam se `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` não estiverem configurados.

## Cobertura atual

| Área | Arquivo |
|---|---|
| `normalizePhone()` | `unit/phone.test.ts` |
| HMAC (`verifyMetaSignature`) | `unit/whatsapp-signature.test.ts` |
| Transições puras (`canTransitionLead`, `canTransitionConversation`) | `unit/status-transitions.test.ts` |
| RPC `webhook_ingest_message` (idempotência, race, CHECKs, trigger multi-tenant) | `integration/rpc.test.ts` |
| `transitionLeadStatus` / `transitionConversationStatus` (incl. concorrência) | `integration/status.test.ts` |
| Webhook POST fim-a-fim (HMAC, batch, timestamp, skip) | `integration/webhook.test.ts` |

## Rodar

```bash
npm install                # primeira vez
npm test                   # tudo
npm run test:unit          # só unit
npm run test:integration   # só integration (requer Supabase)
npm run test:watch         # modo watch
```

## Env

Testes de integração leem `.env.local` (ou `.env.test`, ou `.env`). Precisam de:

```
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Sem estes, os blocos `describeIf` são pulados automaticamente (não falham).

## Isolamento

Cada teste de integração cria sua própria `store` com `whatsapp_numero` aleatório e deleta tudo (cascade) no `afterAll`. Rodar em paralelo é seguro.
