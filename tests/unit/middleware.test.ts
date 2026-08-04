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

const { mockGetUser, mockCreateServerClient, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

import { middleware } from "@/middleware";
import { PUBLIC_SITE_ROUTE_HEADER } from "@/lib/public-route-header";

const PROD_HOST = "app.vexauto.com.br";

function buildRequest(path: string, host: string): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host },
  });
}

// profile: null simula usuário sem linha em public.users (ex: superadmin puro).
function mockProfile(profile: { role: string; store_id: string; stores: { onboarding_completed_at: string | null } } | null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: profile, error: null });
  mockFrom.mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
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

  it("MW-9 (regressão): rewrite pro site público marca PUBLIC_SITE_ROUTE_HEADER — é o que app/layout.tsx usa (via AppChrome) pra nunca renderizar o Header autenticado numa rota pública", async () => {
    const res = await middleware(buildRequest("/", "speedmotos.vexauto.com.br"));
    // Next.js propaga headers de request via x-middleware-request-<nome> na resposta.
    expect(res.headers.get(`x-middleware-request-${PUBLIC_SITE_ROUTE_HEADER}`)).toBe("1");
  });

  it("MW-10: rota protegida autenticada NÃO marca PUBLIC_SITE_ROUTE_HEADER", async () => {
    const res = await middleware(buildRequest("/conversations", PROD_HOST));
    expect(res.headers.get(`x-middleware-request-${PUBLIC_SITE_ROUTE_HEADER}`)).toBeNull();
  });
});

describe("middleware — landing page de vendas no apex/www (roadmap 1.7)", () => {
  it("MW-11: apex \"/\" reescreve para /marketing sem checar sessão", async () => {
    const res = await middleware(buildRequest("/", "vexauto.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/marketing");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("MW-12: www \"/\" também reescreve para /marketing", async () => {
    const res = await middleware(buildRequest("/", "www.vexauto.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/marketing");
  });

  it("MW-13 (regressão): apex reescrito marca PUBLIC_SITE_ROUTE_HEADER — landing não herda Header do app autenticado", async () => {
    const res = await middleware(buildRequest("/", "vexauto.com.br"));
    expect(res.headers.get(`x-middleware-request-${PUBLIC_SITE_ROUTE_HEADER}`)).toBe("1");
  });

  it("MW-14: apex em path diferente de \"/\" (ex: /login) NÃO é reescrito para /marketing", async () => {
    const res = await middleware(buildRequest("/login", "vexauto.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("MW-15: app.vexauto.com.br \"/\" NÃO é reescrito para /marketing — é o app autenticado, não apex/www", async () => {
    const res = await middleware(buildRequest("/", PROD_HOST));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });
});

describe("middleware — gate de onboarding (BL-0026)", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "vex@vexauto.com.br";
  });

  it("MW-16: dono_loja com onboarding pendente em /leads → redireciona /onboarding", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });
    mockProfile({ role: "dono_loja", store_id: "store-1", stores: { onboarding_completed_at: null } });

    const res = await middleware(buildRequest("/leads", PROD_HOST));

    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("MW-17: dono_loja com onboarding completo em /leads → não redireciona", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });
    mockProfile({ role: "dono_loja", store_id: "store-1", stores: { onboarding_completed_at: "2026-08-01T00:00:00Z" } });

    const res = await middleware(buildRequest("/leads", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
  });

  it("MW-18: vendedor com onboarding pendente em /leads → não redireciona, nunca vê o wizard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2", email: "vendedor@x.com" } }, error: null });
    mockProfile({ role: "vendedor", store_id: "store-1", stores: { onboarding_completed_at: null } });

    const res = await middleware(buildRequest("/leads", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
  });

  it("MW-19: super_admin (ADMIN_EMAILS) em /leads → não redireciona e não consulta a tabela users (round-trip evitado)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u3", email: "vex@vexauto.com.br" } }, error: null });

    const res = await middleware(buildRequest("/leads", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("MW-20: já em /onboarding → não redireciona (sem loop) e não consulta a tabela users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });

    const res = await middleware(buildRequest("/onboarding", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("MW-21: /estoque com onboarding pendente → não redireciona (destino do botão 'Ir pro estoque agora') e não consulta a tabela users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "dono@x.com" } }, error: null });

    const res = await middleware(buildRequest("/estoque", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("MW-22: usuário sem linha em public.users → não redireciona", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "orfao@x.com" } }, error: null });
    mockProfile(null);

    const res = await middleware(buildRequest("/leads", PROD_HOST));

    expect(res.headers.get("location")).toBeNull();
  });

  it("MW-23: sem sessão em /onboarding → redireciona /login (rota também exige auth)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await middleware(buildRequest("/onboarding", PROD_HOST));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
