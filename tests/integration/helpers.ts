import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** true quando existem credenciais REAIS (nao dummy do setup). */
export const hasSupabase =
  !!url &&
  !!key &&
  url !== "https://dummy.supabase.co" &&
  key !== "dummy-service-role-key";

export const db: SupabaseClient = hasSupabase
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : (null as unknown as SupabaseClient);

/** Cria uma store de teste com numero unico. Deletar com deleteStoreDeep. */
export async function createTestStore(suffix = ""): Promise<{
  id: string;
  whatsapp_numero: string;
}> {
  // numero E.164 unico por execucao (max 15 digitos)
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  const whatsapp_numero = `+9${Date.now().toString().slice(-8)}${rand}`.slice(
    0,
    15
  );
  // slug: NOT NULL + UNIQUE desde a migration 033 (stores_slug_format_check
  // so aceita [a-z0-9] e hifen) - gerado aqui em vez de derivado do nome
  // porque os testes existentes nao controlam o formato de `suffix`.
  const slug = `test-store-${Date.now()}-${rand}`;
  const { data, error } = await db
    .from("stores")
    .insert({ nome: `Test ${suffix} ${Date.now()}`, whatsapp_numero, slug })
    .select("id, whatsapp_numero")
    .single();
  if (error) throw error;
  return data as { id: string; whatsapp_numero: string };
}

/** Deleta store; cascata remove leads/conversations/messages/ai_logs/vehicles. */
export async function deleteStoreDeep(storeId: string) {
  await db.from("stores").delete().eq("id", storeId);
}

/** Cria usuario de teste (auth.users + public.users) numa store. */
export async function createTestUser(
  storeId: string,
  nome = "Test User"
): Promise<string> {
  const email = `test-${randomUUID()}@vex.test`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "test-pwd-123456",
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw error ?? new Error("auth.admin.createUser failed");
  }
  const { error: uerr } = await db.from("users").insert({
    id: data.user.id,
    store_id: storeId,
    nome,
    role: "vendedor",
  });
  if (uerr) {
    await db.auth.admin.deleteUser(data.user.id);
    throw uerr;
  }
  return data.user.id;
}

export async function deleteTestUser(userId: string) {
  await db.auth.admin.deleteUser(userId);
}

/** Gera um message_external_id unico por chamada. */
export function makeExternalId(tag: string | number = ""): string {
  return `wamid.TEST_${tag}_${randomUUID()}`;
}

/** Gera um telefone E.164 unico (formato +55...) valido para o CHECK do DB. */
export function makePhone(): string {
  const rand = Math.floor(Math.random() * 900_000_000 + 100_000_000).toString();
  return `+5511${rand}`;
}

/** Assina um corpo JSON no formato Meta (X-Hub-Signature-256). */
export function hmacSign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
