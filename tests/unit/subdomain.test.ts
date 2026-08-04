import { describe, it, expect } from "vitest";
import {
  extractStoreSlugFromHost,
  isMarketingApexHost,
  DEFAULT_APP_ROOT_DOMAIN,
} from "@/lib/subdomain";

describe("extractStoreSlugFromHost — resolução de loja por subdomínio (roadmap 1.3)", () => {
  it("SUB-1: subdomínio de produção extrai o slug", () => {
    expect(extractStoreSlugFromHost("speedmotos.vexauto.com.br")).toBe(
      "speedmotos"
    );
  });

  it("SUB-2: domínio raiz (apex) não tem slug — é o app autenticado", () => {
    expect(extractStoreSlugFromHost("vexauto.com.br")).toBeNull();
  });

  it("SUB-3: www no domínio raiz não tem slug", () => {
    expect(extractStoreSlugFromHost("www.vexauto.com.br")).toBeNull();
  });

  it("SUB-3b: app.vexauto.com.br não tem slug — é onde o app autenticado roda de verdade em produção, nunca um site de loja", () => {
    expect(extractStoreSlugFromHost("app.vexauto.com.br")).toBeNull();
  });

  it("SUB-3c: app.localhost também é reservado (paridade dev/prod)", () => {
    expect(extractStoreSlugFromHost("app.localhost:3000")).toBeNull();
  });

  it("SUB-4: porta no host não interfere na extração", () => {
    expect(extractStoreSlugFromHost("speedmotos.vexauto.com.br:3000")).toBe(
      "speedmotos"
    );
  });

  it("SUB-5: domínio de preview da Vercel não é tratado como subdomínio de loja", () => {
    expect(
      extractStoreSlugFromHost("vex-auto-git-main-vitor.vercel.app")
    ).toBeNull();
  });

  it("SUB-6: localhost puro sem query param → sem slug", () => {
    expect(extractStoreSlugFromHost("localhost:3000")).toBeNull();
  });

  it("SUB-7: fallback de dev local via query param ?loja= quando host é localhost puro", () => {
    expect(
      extractStoreSlugFromHost("localhost:3000", { queryLoja: "speedmotos" })
    ).toBe("speedmotos");
  });

  it("SUB-8: subdomínio direto em localhost (ex: speedmotos.localhost) funciona sem query param", () => {
    expect(extractStoreSlugFromHost("speedmotos.localhost:3000")).toBe(
      "speedmotos"
    );
  });

  it("SUB-9: www.localhost não é tratado como slug", () => {
    expect(extractStoreSlugFromHost("www.localhost:3000")).toBeNull();
  });

  it("SUB-10: subdomínio multi-nível não é suportado (decisão: só 1 nível) — retorna null", () => {
    expect(extractStoreSlugFromHost("a.b.vexauto.com.br")).toBeNull();
  });

  it("SUB-11: 127.0.0.1 puro sem query param → sem slug", () => {
    expect(extractStoreSlugFromHost("127.0.0.1:3000")).toBeNull();
  });

  it("SUB-12: host nulo/vazio → sem slug (não quebra)", () => {
    expect(extractStoreSlugFromHost(null)).toBeNull();
    expect(extractStoreSlugFromHost("")).toBeNull();
  });

  it("SUB-13: rootDomain customizável via options — não depende de constante hardcoded no caller", () => {
    expect(
      extractStoreSlugFromHost("bellocar.outrodominio.com", {
        rootDomain: "outrodominio.com",
      })
    ).toBe("bellocar");
  });

  it("SUB-14: slug extraído do host é normalizado para lowercase", () => {
    expect(extractStoreSlugFromHost("SpeedMotos.vexauto.com.br")).toBe(
      "speedmotos"
    );
  });

  it("SUB-15: query param de fallback é normalizado (trim + lowercase)", () => {
    expect(
      extractStoreSlugFromHost("localhost:3000", { queryLoja: "  SpeedMotos  " })
    ).toBe("speedmotos");
  });

  it("DEFAULT_APP_ROOT_DOMAIN é exportado para uso no middleware", () => {
    expect(DEFAULT_APP_ROOT_DOMAIN).toBe("vexauto.com.br");
  });
});

describe("isMarketingApexHost — detecta apex/www da landing page (roadmap 1.7)", () => {
  it("MKT-1: apex do domínio raiz é host de marketing", () => {
    expect(isMarketingApexHost("vexauto.com.br")).toBe(true);
  });

  it("MKT-2: www do domínio raiz é host de marketing", () => {
    expect(isMarketingApexHost("www.vexauto.com.br")).toBe(true);
  });

  it("MKT-3: subdomínio de loja não é host de marketing", () => {
    expect(isMarketingApexHost("speedmotos.vexauto.com.br")).toBe(false);
  });

  it("MKT-4: app.vexauto.com.br (app autenticado) não é host de marketing", () => {
    expect(isMarketingApexHost("app.vexauto.com.br")).toBe(false);
  });

  it("MKT-5: domínio de preview da Vercel não é host de marketing", () => {
    expect(isMarketingApexHost("vex-auto-git-main-vitor.vercel.app")).toBe(false);
  });

  it("MKT-6: host nulo/vazio não é host de marketing", () => {
    expect(isMarketingApexHost(null)).toBe(false);
    expect(isMarketingApexHost("")).toBe(false);
  });

  it("MKT-7: localhost puro é host de marketing (paridade dev/prod)", () => {
    expect(isMarketingApexHost("localhost:3000")).toBe(true);
  });

  it("MKT-8: www.localhost é host de marketing", () => {
    expect(isMarketingApexHost("www.localhost:3000")).toBe(true);
  });

  it("MKT-9: app.localhost não é host de marketing", () => {
    expect(isMarketingApexHost("app.localhost:3000")).toBe(false);
  });

  it("MKT-10: rootDomain customizável via parâmetro", () => {
    expect(
      isMarketingApexHost("outrodominio.com", "outrodominio.com")
    ).toBe(true);
  });

  it("MKT-11: porta no host não interfere", () => {
    expect(isMarketingApexHost("vexauto.com.br:3000")).toBe(true);
  });

  it("MKT-12: comparação é case-insensitive", () => {
    expect(isMarketingApexHost("VexAuto.com.br")).toBe(true);
  });
});
