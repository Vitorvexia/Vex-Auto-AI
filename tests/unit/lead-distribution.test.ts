import { describe, it, expect } from "vitest";
import { pickLeastLoadedVendedor } from "@/lib/lead-distribution";

describe("pickLeastLoadedVendedor", () => {
  it("escolhe o vendedor com menor openLeadCount", () => {
    const candidates = [
      { userId: "a", openLeadCount: 5, createdAt: "2026-01-01T00:00:00Z" },
      { userId: "b", openLeadCount: 2, createdAt: "2026-01-01T00:00:00Z" },
      { userId: "c", openLeadCount: 8, createdAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickLeastLoadedVendedor(candidates)).toBe("b");
  });

  it("empate de carga: vendedor mais antigo (createdAt menor) vence", () => {
    const candidates = [
      { userId: "a", openLeadCount: 3, createdAt: "2026-02-01T00:00:00Z" },
      { userId: "b", openLeadCount: 3, createdAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickLeastLoadedVendedor(candidates)).toBe("b");
  });

  it("lista vazia retorna null", () => {
    expect(pickLeastLoadedVendedor([])).toBeNull();
  });

  it("candidato único retorna esse candidato independente da carga", () => {
    const candidates = [
      { userId: "only", openLeadCount: 42, createdAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickLeastLoadedVendedor(candidates)).toBe("only");
  });
});
