import { describe, it, expect, vi, afterEach } from "vitest";
import { createLogger } from "@/lib/logger";

afterEach(() => vi.restoreAllMocks());

describe("createLogger", () => {
  it("inclui correlationId em todas as saídas", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("cid-abc123");
    log.info("teste");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.correlationId).toBe("cid-abc123");
  });

  it("inclui level e msg corretos", () => {
    const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("cid-001");
    log.info("mensagem info");
    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("mensagem info");
  });

  it("error usa console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("cid-002");
    log.error("falhou");
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
  });

  it("warn usa console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("cid-003");
    log.warn("atenção");
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("warn");
  });

  it("meta extra é mesclada no JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("cid-004", { storeId: "store-123" });
    log.info("ok", { leadId: "lead-456" });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.storeId).toBe("store-123");
    expect(parsed.leadId).toBe("lead-456");
  });

  it("inclui ts em formato ISO", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("cid-005");
    log.info("ts test");
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
