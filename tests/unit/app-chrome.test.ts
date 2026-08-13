// @vitest-environment jsdom
/**
 * AppChrome (roadmap 1.3) — decide se o Header do app autenticado renderiza.
 * Existe porque um layout aninhado (app/site/[slug]/layout.tsx) não consegue
 * remover JSX renderizado pelo layout raiz (app/layout.tsx envolve TODAS as
 * rotas) — a supressão precisa ser condicional dentro do próprio raiz.
 *
 * Regressão coberta: antes deste componente, app/site/[slug]/page.tsx
 * herdava o Header inteiro (nav Leads/Estoque/Equipe/RENAVE/Agenda
 * + dropdown de usuário + "Sair") na rota pública sem sessão — clicar em
 * qualquer link daquele Header a partir de um subdomínio de loja rewrita
 * pra uma rota /site/[slug]/<path> inexistente (404), incluindo o próprio
 * logout.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";

vi.mock("@/app/components/Header", () => ({
  Header: () => createElement("div", { "data-testid": "app-header" }, "Sair"),
}));

import { AppChrome } from "@/app/components/AppChrome";

afterEach(() => {
  cleanup();
});

describe("AppChrome — isolamento do site público (roadmap 1.3)", () => {
  it("isPublicRoute=true NÃO renderiza o Header (nav autenticada / Sair ausentes)", () => {
    render(
      createElement(AppChrome, {
        isPublicRoute: true,
        isAdmin: false,
        children: createElement("main", null, "conteúdo público"),
      })
    );

    expect(screen.queryByTestId("app-header")).toBeNull();
    expect(screen.queryByText("Sair")).toBeNull();
    expect(screen.getByText("conteúdo público")).toBeTruthy();
  });

  it("isPublicRoute=false renderiza o Header normalmente (app autenticado)", () => {
    render(
      createElement(AppChrome, {
        isPublicRoute: false,
        isAdmin: false,
        children: createElement("main", null, "conteúdo interno"),
      })
    );

    expect(screen.getByTestId("app-header")).toBeTruthy();
    expect(screen.getByText("conteúdo interno")).toBeTruthy();
  });
});
