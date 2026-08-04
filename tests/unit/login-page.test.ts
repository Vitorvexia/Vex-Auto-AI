// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, act } from "@testing-library/react";

const { mockPush, mockRefresh, mockSignIn } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: { signInWithPassword: mockSignIn },
  }),
}));

import LoginPage from "@/app/login/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage — botão não trava em 'Entrando...' após signInWithPassword resolver", () => {
  it("sucesso: mesmo com navegação lenta, loading volta a false (botão reabilitado)", async () => {
    let resolveSignIn!: (v: { error: null }) => void;
    mockSignIn.mockReturnValue(new Promise((r) => { resolveSignIn = r; }));

    const { container, getByRole } = render(createElement(LoginPage));
    const inputs = container.querySelectorAll("input");

    fireEvent.change(inputs[0], { target: { value: "a@b.com" } });
    fireEvent.change(inputs[1], { target: { value: "secret" } });
    fireEvent.click(getByRole("button"));

    expect(getByRole("button").textContent).toBe("Entrando...");
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveSignIn({ error: null });
      await Promise.resolve();
    });

    expect(getByRole("button").textContent).toBe("Entrar");
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/leads");
  });

  it("erro de credenciais: loading volta a false (comportamento já existente, não regride)", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "invalid" } });

    const { container, getByRole } = render(createElement(LoginPage));
    const inputs = container.querySelectorAll("input");

    fireEvent.change(inputs[0], { target: { value: "a@b.com" } });
    fireEvent.change(inputs[1], { target: { value: "wrong" } });

    await act(async () => {
      fireEvent.click(getByRole("button"));
      await Promise.resolve();
    });

    expect(getByRole("button").textContent).toBe("Entrar");
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
});
