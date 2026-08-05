import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — refs compartilhados nas factories dos vi.mock()
// ---------------------------------------------------------------------------

const { mockFrom, mockRpc, mockSendWA, mockRunAI, mockRevalidate, mockGetServerStoreId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSendWA: vi.fn(),
  mockRunAI: vi.fn(),
  mockRevalidate: vi.fn(),
  mockGetServerStoreId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}));

vi.mock("@/lib/whatsapp-send", () => ({
  sendWhatsAppMessage: mockSendWA,
}));

vi.mock("@/lib/ai-pipeline", () => ({
  runAiPipeline: mockRunAI,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidate,
}));

vi.mock("@/lib/auth", () => ({
  getServerStoreId: mockGetServerStoreId,
}));

// ---------------------------------------------------------------------------
// Import após mocks
// ---------------------------------------------------------------------------

import { ingestLeadManually } from "@/lib/lead-ingestion";
import { importLead } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Helpers — chains fluentes do Supabase
// ---------------------------------------------------------------------------

function chainRead(data: unknown = null) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const ms = ["select", "insert", "update", "upsert", "eq", "neq", "in", "is", "not", "order", "limit", "single", "maybeSingle"];
  for (const m of ms) c[m] = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return c;
}

function chainWrite(data: unknown = null) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const ms = ["select", "insert", "update", "upsert", "eq", "neq", "in", "is", "not", "order", "limit", "single", "maybeSingle"];
  for (const m of ms) c[m] = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue({ data, error: null });
  return c;
}

function chainInsertVoid(error: unknown = null) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const ms = ["select", "insert", "update", "upsert", "eq", "neq", "in", "is", "not", "order", "limit", "single", "maybeSingle"];
  for (const m of ms) c[m] = vi.fn().mockReturnValue(c);
  c.insert = vi.fn().mockResolvedValue({ error });
  return c;
}

function setupNewLead(leadId = "lead-1", convId = "conv-1") {
  mockFrom
    .mockReturnValueOnce(chainRead(null))               // leads SELECT — não encontrado
    .mockReturnValueOnce(chainWrite({ id: leadId }))    // leads INSERT — sucesso
    .mockReturnValueOnce(chainRead(null))               // conversations SELECT — não encontrado
    .mockReturnValueOnce(chainWrite({ id: convId }))    // conversations INSERT — sucesso
    .mockReturnValueOnce(chainInsertVoid(null));         // messages INSERT — sucesso
}

const BASE = {
  nome: "João Silva",
  telefone: "+5511999990001",
  storeId: "store-1",
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockGetServerStoreId.mockResolvedValue("store-1");
  mockRpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// T1 — Normalização de telefone BR antigo
// ---------------------------------------------------------------------------

it("T1: normaliza telefone BR 12 dígitos (celular) para E.164 com 9 inserido após DDD", async () => {
  setupNewLead();
  await ingestLeadManually({ ...BASE, telefone: "551199990000" });

  // Índice 1 = segunda chamada a from() = leads INSERT
  const leadsInsertChain = mockFrom.mock.results[1].value;
  expect(leadsInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ phone_normalized: "+5511999990000" })
  );
});

// ---------------------------------------------------------------------------
// T2 — Lead novo com status NOVO
// ---------------------------------------------------------------------------

it("T2: cria lead novo com lead_status NOVO", async () => {
  setupNewLead();
  await ingestLeadManually(BASE);

  const leadsInsertChain = mockFrom.mock.results[1].value;
  expect(leadsInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ lead_status: "NOVO" })
  );
});

// ---------------------------------------------------------------------------
// T3 — Duplicado retorna existing, nenhum insert de lead
// ---------------------------------------------------------------------------

it("T3: telefone duplicado retorna existing sem criar novo lead", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead({ id: "lead-1" }))   // leads SELECT — encontrado
    .mockReturnValueOnce(chainRead({ id: "conv-1" }));   // conversations SELECT — encontrado

  const result = await ingestLeadManually(BASE);

  expect(result).toEqual({ status: "existing", leadId: "lead-1", conversationId: "conv-1" });
  expect(mockFrom).toHaveBeenCalledTimes(2);
});

// ---------------------------------------------------------------------------
// T4 — Conversa criada com status ATIVA e handoff_to IA
// ---------------------------------------------------------------------------

it("T4: cria conversa ATIVA com handoff_to=IA quando não existe conversa aberta", async () => {
  setupNewLead();
  await ingestLeadManually(BASE);

  // Índice 3 = quarta chamada a from() = conversations INSERT
  const convInsertChain = mockFrom.mock.results[3].value;
  expect(convInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ conversation_status: "ATIVA", handoff_to: "IA" })
  );
});

// ---------------------------------------------------------------------------
// T5 — Não duplica conversa se já existe uma aberta
// ---------------------------------------------------------------------------

it("T5: não cria conversa duplicada se conversa aberta já existe para o novo lead", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead(null))                        // leads SELECT — não encontrado
    .mockReturnValueOnce(chainWrite({ id: "lead-1" }))          // leads INSERT — sucesso
    .mockReturnValueOnce(chainRead({ id: "conv-existing" }));   // conversations SELECT — JÁ EXISTE

  const result = await ingestLeadManually(BASE);

  expect(result.status).toBe("created");
  expect(mockFrom).toHaveBeenCalledTimes(3); // sem 4ª chamada para INSERT de conversa
});

// ---------------------------------------------------------------------------
// T6 — Mensagem de sistema inserida
// ---------------------------------------------------------------------------

it("T6: insere mensagem de sistema 'Lead importado manualmente.'", async () => {
  setupNewLead();
  await ingestLeadManually(BASE);

  // Índice 4 = quinta chamada a from() = messages INSERT
  const messagesChain = mockFrom.mock.results[4].value;
  expect(messagesChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ mensagem: "Lead importado manualmente.", autor: "sistema" })
  );
});

// ---------------------------------------------------------------------------
// T7 — Telefone inválido
// ---------------------------------------------------------------------------

it("T7: telefone inválido retorna invalid_phone sem tocar o banco", async () => {
  const result = await ingestLeadManually({ ...BASE, telefone: "abc" });

  expect(result).toEqual({ status: "invalid_phone" });
  expect(mockFrom).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// T8 — Origem default manual
// ---------------------------------------------------------------------------

it("T8: origem default é 'manual' quando não informada", async () => {
  setupNewLead();
  await ingestLeadManually(BASE); // sem campo origem

  const leadsInsertChain = mockFrom.mock.results[1].value;
  expect(leadsInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ origem: "manual" })
  );
});

// ---------------------------------------------------------------------------
// T8b — origem 'site' (roadmap 1.4 — contato do site público da loja)
// ---------------------------------------------------------------------------

it("T8c: mensagem de sistema difere por origem — 'site' gera texto próprio, 'manual' mantém o genérico", async () => {
  setupNewLead();
  await ingestLeadManually({ ...BASE, origem: "site" });
  const messagesInsertChainSite = mockFrom.mock.results[4].value;
  expect(messagesInsertChainSite.insert).toHaveBeenCalledWith(
    expect.objectContaining({ mensagem: "Lead recebido pelo site." })
  );

  vi.clearAllMocks();
  mockGetServerStoreId.mockResolvedValue("store-1");
  setupNewLead();
  await ingestLeadManually(BASE); // origem default 'manual'
  const messagesInsertChainManual = mockFrom.mock.results[4].value;
  expect(messagesInsertChainManual.insert).toHaveBeenCalledWith(
    expect.objectContaining({ mensagem: "Lead importado manualmente." })
  );
});

it("T8b: aceita origem 'site' e persiste no insert do lead", async () => {
  setupNewLead();
  await ingestLeadManually({ ...BASE, origem: "site" });

  const leadsInsertChain = mockFrom.mock.results[1].value;
  expect(leadsInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ origem: "site" })
  );
});

// ---------------------------------------------------------------------------
// T9 — sendWhatsAppMessage nunca chamado
// ---------------------------------------------------------------------------

it("T9: não chama sendWhatsAppMessage em nenhum path da importação", async () => {
  setupNewLead();
  await ingestLeadManually(BASE);

  expect(mockSendWA).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// T10 — runAiPipeline nunca chamado
// ---------------------------------------------------------------------------

it("T10: não chama runAiPipeline em nenhum path da importação", async () => {
  setupNewLead();
  await ingestLeadManually(BASE);

  expect(mockRunAI).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// T11 — storeId ausente retorna missing_store
// ---------------------------------------------------------------------------

it("T11: storeId ausente retorna missing_store sem tocar o banco", async () => {
  const result = await ingestLeadManually({ ...BASE, storeId: "" });

  expect(result).toEqual({ status: "missing_store" });
  expect(mockFrom).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// T12 — Nome vazio retorna invalid_input
// ---------------------------------------------------------------------------

it("T12: nome vazio (ou só espaços) retorna invalid_input com field='nome'", async () => {
  const result = await ingestLeadManually({ ...BASE, nome: "   " });

  expect(result).toEqual({ status: "invalid_input", field: "nome" });
  expect(mockFrom).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// T13 — Server Action: coerção segura quando formData.get("nome") é null
// ---------------------------------------------------------------------------

it("T13: Server Action importLead não lança TypeError quando formData.get('nome') é null", async () => {
  const formData = new FormData();
  formData.append("telefone", "+5511999990001");
  // "nome" NÃO adicionado — formData.get("nome") retorna null

  const result = await importLead(null, formData);

  // Coerção segura: null → "" → invalid_input (sem TypeError)
  expect(result).toEqual({ status: "invalid_input", field: "nome" });
});

// ---------------------------------------------------------------------------
// T14 — observacao salva no contexto
// ---------------------------------------------------------------------------

it("T14: observacao é salva em leads.contexto quando fornecida", async () => {
  setupNewLead();
  await ingestLeadManually({ ...BASE, observacao: "Cliente indicado por fulano" });

  const leadsInsertChain = mockFrom.mock.results[1].value;
  expect(leadsInsertChain.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      contexto: expect.objectContaining({ observacao: "Cliente indicado por fulano" }),
    })
  );
});

// ---------------------------------------------------------------------------
// T15 — Heal path: lead existente sem conversa recebe conversa nova
// ---------------------------------------------------------------------------

it("T15: lead existente sem conversa aberta recebe conversa criada (heal path)", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead({ id: "lead-1" }))           // leads SELECT — encontrado
    .mockReturnValueOnce(chainRead(null))                        // conversations SELECT — NÃO encontrado (heal!)
    .mockReturnValueOnce(chainWrite({ id: "conv-healed" }))     // conversations INSERT — sucesso
    .mockReturnValueOnce(chainInsertVoid(null));                  // messages INSERT — sucesso

  const result = await ingestLeadManually(BASE);

  expect(result).toEqual({
    status: "existing",
    leadId: "lead-1",
    conversationId: "conv-healed",
  });
});

// ---------------------------------------------------------------------------
// T16 — AGUARDANDO_HUMANO não causa nova conversa
// ---------------------------------------------------------------------------

it("T16: lead com conversa AGUARDANDO_HUMANO retorna existing sem tentar criar nova conversa", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead({ id: "lead-1" }))    // leads SELECT — encontrado
    .mockReturnValueOnce(chainRead({ id: "conv-human" })); // conversations SELECT — encontrado (AGUARDANDO_HUMANO incluso em OPEN_CONVERSATION_STATUSES)

  const result = await ingestLeadManually(BASE);

  expect(result).toEqual({
    status: "existing",
    leadId: "lead-1",
    conversationId: "conv-human",
  });
  expect(mockFrom).toHaveBeenCalledTimes(2); // sem INSERT de conversa
});

// ---------------------------------------------------------------------------
// T17 — importLead usa getServerStoreId(), não DEFAULT_STORE_ID
// ---------------------------------------------------------------------------

it("T17: importLead chama getServerStoreId() para resolver storeId (não DEFAULT_STORE_ID)", async () => {
  setupNewLead();

  const formData = new FormData();
  formData.append("nome", "João Silva");
  formData.append("telefone", "+5511999990001");

  await importLead(null, formData);

  expect(mockGetServerStoreId).toHaveBeenCalledOnce();
});

// ---------------------------------------------------------------------------
// T18 — distribuição automática (roadmap 1.10): lead novo chama a RPC de
// atribuição; lead existente (duplicado ou heal path) nunca chama.
// ---------------------------------------------------------------------------

it("T18: lead novo chama assign_lead_to_least_loaded_vendedor via RPC com leadId + storeId", async () => {
  setupNewLead("lead-42");
  await ingestLeadManually(BASE);

  expect(mockRpc).toHaveBeenCalledWith("assign_lead_to_least_loaded_vendedor", {
    p_lead_id: "lead-42",
    p_store_id: "store-1",
  });
});

it("T19: lead duplicado (existing) não chama a RPC de distribuição", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead({ id: "lead-1" }))
    .mockReturnValueOnce(chainRead({ id: "conv-1" }));

  await ingestLeadManually(BASE);

  expect(mockRpc).not.toHaveBeenCalled();
});

it("T20: heal path (lead existente sem conversa) não chama a RPC de distribuição", async () => {
  mockFrom
    .mockReturnValueOnce(chainRead({ id: "lead-1" }))
    .mockReturnValueOnce(chainRead(null))
    .mockReturnValueOnce(chainWrite({ id: "conv-healed" }))
    .mockReturnValueOnce(chainInsertVoid(null));

  await ingestLeadManually(BASE);

  expect(mockRpc).not.toHaveBeenCalled();
});
