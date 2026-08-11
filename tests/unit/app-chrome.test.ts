// @vitest-environment jsdom
/**
 * AppChrome (roadmap 1.3) — decide se o chrome (sidebar) do app autenticado
 * renderiza. Existe porque um layout aninhado (app/site/[slug]/layout.tsx)
 * não consegue remover JSX renderizado pelo layout raiz (app/layout.tsx
 * envolve TODAS as rotas) — a supressão precisa ser condicional dentro do
 * próprio raiz.
 *
 * Regressão coberta: antes deste componente, app/site/[slug]/page.tsx
 * herdava a nav inteira (Leads/Estoque/Equipe/RENAVE/Agenda/Analytics +
 * dropdown de usuário + "Sair") na rota pública sem sessão — clicar em
 * qualquer link daquela nav a partir de um subdomínio de loja rewrita pra
 * uma rota /site/[slug]/<path> inexistente (404), incluindo o próprio
 * logout.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, screen } from "@testing-library/react";

vi.mock("@/app/components/Sidebar", () => ({
  Sidebar: () => createElement("div", { "data-testid": "app-sidebar" }, "Sair"),
}));

import { AppChrome } from "@/app/components/AppChrome";

afterEach(() => {
  cleanup();
});

describe("AppChrome — isolamento do site público (roadmap 1.3)", () => {
  it("isPublicRoute=true NÃO renderiza a Sidebar (nav autenticada / Sair ausentes)", () => {
    render(
      createElement(AppChrome, {
        isPublicRoute: true,
        isAdmin: false,
        children: createElement("main", null, "conteúdo público"),
      })
    );

    expect(screen.queryByTestId("app-sidebar")).toBeNull();
    expect(screen.queryByText("Sair")).toBeNull();
    expect(screen.getByText("conteúdo público")).toBeTruthy();
  });

  it("isPublicRoute=false renderiza a Sidebar normalmente (app autenticado)", () => {
    render(
      createElement(AppChrome, {
        isPublicRoute: false,
        isAdmin: false,
        children: createElement("main", null, "conteúdo interno"),
      })
    );

    expect(screen.getByTestId("app-sidebar")).toBeTruthy();
    expect(screen.getByText("conteúdo interno")).toBeTruthy();
  });
});
