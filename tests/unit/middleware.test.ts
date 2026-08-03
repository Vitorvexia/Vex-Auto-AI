/**
 * middleware.ts — primeiro teste de middleware do projeto.
 *
 * Motivo: o matcher foi ampliado de uma lista fixa de rotas protegidas para
 * quase-catch-all (roadmap 1.3, detecção de subdomínio precisa rodar em
 * QUALQUER path). "Comportamento preservado via PROTECTED_PATH_PREFIXES" era
 * só verificação manual até este arquivo existir — isso é exatamente o tipo
 * de mudança que merece teste explícito, não confiança na leitura do código.
 *
 * Também serve de teste de regressão para um bug real encontrado ao escrever
 * este arquivo: a produção roda em `app.vexauto.com.br` (confirmado via
 * comandos de teste de webhook anteriores nesta sessão), não no apex. A
 * primeira versão de lib/subdomain.ts só reservava "www" — tratava "app"
 * como se fosse slug de loja, o que teria reescrito TODA request da
 * produção real para /site/app/... e quebrado a autenticação inteira. Fixado
 * antes deste teste existir; MW-5 trava a regressão.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

import { middleware } from "@/middleware";

const PROD_HOST = "app.vexauto.com.br";

function buildRequest(path: string, host: string): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: mockGetUser },
  });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("middleware — rotas protegidas continuam exigindo sessão após ampliação do matcher (roadmap 1.3)", () => {
  it("MW-1: /conversations sem sessão redireciona para /login", async () => {
    const res = await middleware(buildRequest("/conversations", PROD_HOST));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("MW-2: /estoque sem sessão redireciona para /login", async () => {
    const res = await middleware(buildRequest("/estoque", PROD_HOST));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("MW-3: /admin sem sessão redireciona para /login (antes até de checar ADMIN_EMAILS)", async () => {
    const res = await middleware(buildRequest("/admin", PROD_HOST));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("MW-4: /leads sem sessão redireciona para /login", async () => {
    const res = await middleware(buildRequest("/leads", PROD_HOST));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("MW-5 (regressão): app.vexauto.com.br NUNCA é tratado como subdomínio de loja — /conversations segue para o fluxo de auth normal, não é reescrito para /site/app/conversations", async () => {
    const res = await middleware(buildRequest("/conversations", PROD_HOST));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).not.toContain("/site/");
    // auth.getUser() FOI chamado — prova que caiu no fluxo de auth, não no rewrite público
    expect(mockGetUser).toHaveBeenCalledOnce();
  });

  it("MW-6: rota não protegida (ex: /privacidade) não invoca checagem de auth — matcher mais amplo não gatilha guard novo", async () => {
    const res = await middleware(buildRequest("/privacidade", PROD_HOST));
    expect(res.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

describe("middleware — roteamento público por subdomínio (roadmap 1.3)", () => {
  it("MW-7: subdomínio de loja real reescreve para /site/[slug] sem checar sessão", async () => {
    const res = await middleware(buildRequest("/", "speedmotos.vexauto.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/site/speedmotos");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("MW-8: subdomínio de loja com path preserva o sufixo (ex: /veiculo/123)", async () => {
    const res = await middleware(
      buildRequest("/veiculo/123", "speedmotos.vexauto.com.br")
    );
    expect(res.headers.get("x-middleware-rewrite")).toContain(
      "/site/speedmotos/veiculo/123"
    );
  });
});
