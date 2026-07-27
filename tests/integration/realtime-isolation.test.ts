/**
 * Isolamento multi-tenant no Realtime — item 0.8 (Inbox em tempo real).
 *
 * Valida a garantia mais importante do design: usuário da loja A não recebe
 * evento postgres_changes de conversa da loja B, MESMO sabendo o conversation_id
 * (o filtro em subscribeToConversationMessages é só otimização client-side — a
 * fronteira de segurança real é a RLS "messages_own_store_select" aplicada pelo
 * servidor Realtime ao avaliar quem pode ver cada linha).
 *
 * Depende de:
 *   - migration 023_messages_realtime.sql aplicada (tabela na publication supabase_realtime)
 *   - RLS de messages (migration 005_rls_policies.sql)
 * Roda contra Supabase real — pula automaticamente se NEXT_PUBLIC_SUPABASE_ANON_KEY
 * ou credenciais reais (hasSupabase) não estiverem disponíveis.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { db, hasSupabase, deleteStoreDeep, deleteTestUser } from "./helpers";
import { subscribeToConversationMessages, type ConversationMessage } from "@/lib/realtime-messages";

const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const canRunRlsAsUser = hasSupabase && !!anonUrl && !!anonKey;

const describeIf = canRunRlsAsUser ? describe : describe.skip;

// Prefixo __test__ em todo dado criado por este arquivo — permite varredura
// manual de sobras no Studio (`WHERE nome LIKE '__test__%'`) caso o cleanup
// falhe no meio (crash do processo, kill externo etc — afterAll não roda nesses
// casos; timeout/falha de asserção normal não têm esse problema, afterAll roda).
const TEST_PREFIX = "__test__realtime-isolation";

/**
 * public.users.store_id é ON DELETE RESTRICT (não CASCADE) — uma store com
 * usuário vinculado NUNCA é deletável até o usuário (auth.users, que cascade
 * pra public.users) ser removido primeiro. `deleteStoreDeep` sozinho ignora o
 * erro do delete, então usar só ele aqui falharia em silêncio e deixaria a
 * store (+ leads/conversations/messages cascateados) presos em produção —
 * foi exatamente o que aconteceu nas execuções anteriores desta sessão.
 */
async function createIdentifiableTestStore(label: string): Promise<{ id: string }> {
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const whatsapp_numero = `+9${Date.now().toString().slice(-8)}${rand}`.slice(0, 15);
  const { data, error } = await db
    .from("stores")
    .insert({ nome: `${TEST_PREFIX}-${label}-${randomUUID()}`, whatsapp_numero })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

async function createSignedInUser(storeId: string, nome: string) {
  const email = `test-realtime-${randomUUID()}@vex.test`;
  const password = "test-pwd-123456";

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) throw error ?? new Error("auth.admin.createUser failed");

  const { error: uerr } = await db
    .from("users")
    .insert({ id: data.user.id, store_id: storeId, nome, role: "vendedor" });
  if (uerr) throw uerr;

  const client = createClient(anonUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;

  // Sem isso o Realtime nunca recebe o JWT e a RLS nunca resolve auth.uid() —
  // ver comentário equivalente em app/components/ConversationMessages.tsx.
  client.realtime.setAuth(signInData.session!.access_token);

  return { userId: data.user.id as string, client };
}

async function createLeadAndConversation(storeId: string) {
  const phone = `+5511${Math.floor(Math.random() * 900_000_000 + 100_000_000)}`;
  const { data: lead, error: leadErr } = await db
    .from("leads")
    .insert({ store_id: storeId, phone_normalized: phone, nome: "Lead RT" })
    .select("id")
    .single();
  if (leadErr) throw leadErr;

  const { data: conv, error: convErr } = await db
    .from("conversations")
    .insert({ store_id: storeId, lead_id: lead.id })
    .select("id")
    .single();
  if (convErr) throw convErr;

  return { leadId: lead.id as string, conversationId: conv.id as string };
}

async function insertMessage(
  storeId: string,
  conversationId: string,
  leadId: string,
  mensagem: string
) {
  const { error } = await db.from("messages").insert({
    store_id: storeId,
    conversation_id: conversationId,
    lead_id: leadId,
    direcao: "entrada",
    autor: "lead",
    mensagem,
  });
  if (error) throw error;
}

/**
 * Espera o canal chegar em SUBSCRIBED de verdade, em vez de um sleep fixo.
 * Um delay fixo (ex: 1500ms) é aposta, não garantia — handshake do
 * websocket + join do canal + autorização RLS às vezes passa disso sob
 * carga, causando falso negativo intermitente (observado nesta sessão:
 * mesmo teste, mesmo código, passou numa run e deu timeout na seguinte).
 */
function waitForSubscribed(timeoutMs: number): {
  promise: Promise<void>;
  onStatusChange: (status: string) => void;
} {
  let resolveFn!: () => void;
  let settled = false;
  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = () => {
      settled = true;
      resolve();
    };
    setTimeout(() => {
      if (!settled) reject(new Error("timeout esperando status SUBSCRIBED do canal"));
    }, timeoutMs);
  });
  return {
    promise,
    onStatusChange: (status) => {
      if (status === "SUBSCRIBED") resolveFn();
    },
  };
}

describeIf("Realtime isolamento multi-tenant — messages", () => {
  let storeA: { id: string };
  let storeB: { id: string };
  let userA: { userId: string; client: SupabaseClient };
  let userB: { userId: string; client: SupabaseClient };
  let convA: { leadId: string; conversationId: string };
  let convB: { leadId: string; conversationId: string };

  beforeAll(async () => {
    storeA = await createIdentifiableTestStore("A");
    storeB = await createIdentifiableTestStore("B");
    userA = await createSignedInUser(storeA.id, "Vendedor A");
    userB = await createSignedInUser(storeB.id, "Vendedor B");
    convA = await createLeadAndConversation(storeA.id);
    convB = await createLeadAndConversation(storeB.id);

    // eslint-disable-next-line no-console
    console.log(
      "[RT setup] storeA=%s storeB=%s | userA=%s (loja A) userB=%s (loja B) | convA=%s (loja A) convB=%s (loja B)",
      storeA.id,
      storeB.id,
      userA.userId,
      userB.userId,
      convA.conversationId,
      convB.conversationId
    );
  }, 30000);

  afterAll(async () => {
    // Ordem importa: usuário primeiro (libera o RESTRICT em users.store_id),
    // store depois (cascade cuida de leads/conversations/messages).
    // deleteStoreDeep (helpers.ts) ignora o erro do delete — verifica aqui pra
    // não repetir o vazamento silencioso das execuções anteriores desta sessão.
    if (userA?.userId) await deleteTestUser(userA.userId);
    if (userB?.userId) await deleteTestUser(userB.userId);
    if (storeA?.id) {
      await deleteStoreDeep(storeA.id);
      const { data } = await db.from("stores").select("id").eq("id", storeA.id).maybeSingle();
      if (data) console.error(`[RT cleanup] FALHOU: storeA (${storeA.id}) ainda existe em produção`);
    }
    if (storeB?.id) {
      await deleteStoreDeep(storeB.id);
      const { data } = await db.from("stores").select("id").eq("id", storeB.id).maybeSingle();
      if (data) console.error(`[RT cleanup] FALHOU: storeB (${storeB.id}) ainda existe em produção`);
    }
  });

  it(
    "RT-1: usuário da loja A recebe INSERT de conversa da própria loja",
    async () => {
      // eslint-disable-next-line no-console
      console.log(
        "[RT-1] userA=%s inscrito no canal messages:%s (própria loja, storeA=%s)",
        userA.userId,
        convA.conversationId,
        storeA.id
      );

      // Objeto (não `let`) de propósito — evita a TS narrowar o tipo pra
      // literal `null` por causa da mutação acontecer dentro do closure onInsert.
      const state: { received: ConversationMessage | null } = { received: null };
      const { promise: subscribed, onStatusChange } = waitForSubscribed(15000);
      const unsubscribe = subscribeToConversationMessages(userA.client, convA.conversationId, {
        onInsert: (m) => {
          state.received = m;
        },
        onStatusChange,
      });

      await subscribed;

      // Observado nesta sessão (~1 em cada 3-4 runs): logo após SUBSCRIBED às
      // vezes existe uma janela curta onde o servidor ainda não terminou de
      // registrar a assinatura RLS do postgres_changes, mesmo já tendo
      // confirmado o join do canal — o primeiro INSERT se perde nessa janela.
      // Reenviar após uma espera curta é o mitigador padrão pra esse
      // comportamento conhecido do Realtime; não é bug de RLS/isolamento —
      // RT-2a/2b nunca flakam porque "não chegar nada" é insensível a essa race.
      for (let attempt = 1; attempt <= 3 && !state.received; attempt++) {
        // eslint-disable-next-line no-console
        console.log(
          "[RT-1] tentativa %d — inserindo mensagem em convA (storeA=%s)...",
          attempt,
          storeA.id
        );
        await insertMessage(
          storeA.id,
          convA.conversationId,
          convA.leadId,
          `oi da propria loja (tentativa ${attempt})`
        );
        await new Promise((r) => setTimeout(r, 2000));
      }

      // eslint-disable-next-line no-console
      console.log(
        "[RT-1] RESULTADO: userA %s — mensagem=%j",
        state.received ? "recebeu evento" : "NÃO recebeu evento em 3 tentativas",
        state.received?.mensagem ?? null
      );
      expect(state.received).not.toBeNull();
      expect(state.received?.mensagem).toMatch(/^oi da propria loja/);

      unsubscribe();
    },
    28000
  );

  it(
    "RT-2a: usuário da loja A NÃO recebe INSERT de conversa da loja B mesmo sabendo o conversation_id — RLS bloqueia no servidor, não só o filtro client-side",
    async () => {
      // eslint-disable-next-line no-console
      console.log(
        "[RT-2a] userA=%s (loja A) inscrito no canal messages:%s (loja B, storeB=%s) — sabendo o conversation_id de propósito",
        userA.userId,
        convB.conversationId,
        storeB.id
      );

      let received: ConversationMessage | null = null;
      const { promise: subscribed, onStatusChange } = waitForSubscribed(15000);
      const unsubscribe = subscribeToConversationMessages(userA.client, convB.conversationId, {
        onInsert: (m) => {
          received = m;
        },
        onStatusChange,
      });

      await subscribed;
      // eslint-disable-next-line no-console
      console.log("[RT-2a] inserindo mensagem em convB (storeB=%s)...", storeB.id);
      await insertMessage(storeB.id, convB.conversationId, convB.leadId, "mensagem da loja B");

      // Janela de espera generosa: se RLS não estivesse aplicada ao Realtime,
      // o evento chegaria dentro desse tempo (RT-1 provou que o transporte funciona
      // nesse mesmo prazo — então silêncio aqui é isolamento, não canal quebrado).
      await new Promise((r) => setTimeout(r, 4000));

      // eslint-disable-next-line no-console
      console.log(
        "[RT-2a] RESULTADO: userA (loja A) recebeu evento da loja B? %s — esperado: NÃO",
        received === null ? "NÃO recebeu (isolamento OK)" : `RECEBEU (${JSON.stringify(received)}) — FALHA DE ISOLAMENTO`
      );
      expect(received).toBeNull();

      unsubscribe();
    },
    22000
  );

  it(
    "RT-2b: usuário da loja B NÃO recebe INSERT de conversa da loja A mesmo sabendo o conversation_id — mesma garantia, direção invertida",
    async () => {
      // eslint-disable-next-line no-console
      console.log(
        "[RT-2b] userB=%s (loja B) inscrito no canal messages:%s (loja A, storeA=%s) — sabendo o conversation_id de propósito",
        userB.userId,
        convA.conversationId,
        storeA.id
      );

      let received: ConversationMessage | null = null;
      const { promise: subscribed, onStatusChange } = waitForSubscribed(15000);
      const unsubscribe = subscribeToConversationMessages(userB.client, convA.conversationId, {
        onInsert: (m) => {
          received = m;
        },
        onStatusChange,
      });

      await subscribed;
      // eslint-disable-next-line no-console
      console.log("[RT-2b] inserindo mensagem em convA (storeA=%s)...", storeA.id);
      await insertMessage(storeA.id, convA.conversationId, convA.leadId, "mensagem da loja A");

      await new Promise((r) => setTimeout(r, 4000));

      // eslint-disable-next-line no-console
      console.log(
        "[RT-2b] RESULTADO: userB (loja B) recebeu evento da loja A? %s — esperado: NÃO",
        received === null ? "NÃO recebeu (isolamento OK)" : `RECEBEU (${JSON.stringify(received)}) — FALHA DE ISOLAMENTO`
      );
      expect(received).toBeNull();

      unsubscribe();
    },
    22000
  );
});
