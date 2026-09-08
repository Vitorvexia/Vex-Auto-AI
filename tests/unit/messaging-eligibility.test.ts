/**
 * Testes unitários para lib/messaging-eligibility.ts
 *
 * canSendMarketingMessage — trava única compartilhada por follow-up e
 * reativação (BL-0040/DL-0021): opt-out > trava de frequência (48h) >
 * janela de horário comercial.
 */

import { describe, it, expect } from "vitest";
import { canSendMarketingMessage } from "@/lib/messaging-eligibility";

const STORE = { business_hours_start: "08:00", business_hours_end: "20:00" };

// Meio-dia BRT (UTC-3) — dentro de qualquer janela comercial razoável.
const NOON_BRT = new Date("2026-08-26T15:00:00.000Z");

describe("canSendMarketingMessage — opt-out", () => {
  it("bloqueia com reason=opt_out quando marketing_opt_out=true", () => {
    const result = canSendMarketingMessage(
      { marketing_opt_out: true, last_marketing_sent_at: null },
      STORE,
      NOON_BRT
    );
    expect(result).toEqual({ allowed: false, reason: "opt_out" });
  });

  it("opt-out tem prioridade sobre qualquer outra regra", () => {
    const result = canSendMarketingMessage(
      { marketing_opt_out: true, last_marketing_sent_at: NOON_BRT.toISOString() },
      STORE,
      NOON_BRT
    );
    expect(result.reason).toBe("opt_out");
  });
});

describe("canSendMarketingMessage — trava de frequência (48h)", () => {
  it("bloqueia com reason=frequency_cap a 47h59 do último envio", () => {
    const lastSent = new Date(NOON_BRT.getTime() - (48 * 60 - 1) * 60 * 1000);
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: lastSent.toISOString() },
      STORE,
      NOON_BRT
    );
    expect(result).toEqual({ allowed: false, reason: "frequency_cap" });
  });

  it("permite a exatos 48h01 do último envio", () => {
    const lastSent = new Date(NOON_BRT.getTime() - (48 * 60 + 1) * 60 * 1000);
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: lastSent.toISOString() },
      STORE,
      NOON_BRT
    );
    expect(result.allowed).toBe(true);
  });

  it("last_marketing_sent_at null não bloqueia por frequência", () => {
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      NOON_BRT
    );
    expect(result.allowed).toBe(true);
  });
});

describe("canSendMarketingMessage — janela de horário comercial", () => {
  it("bloqueia com reason=outside_hours antes da abertura (6h BRT)", () => {
    const sixAmBrt = new Date("2026-08-26T09:00:00.000Z"); // 6h BRT
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      sixAmBrt
    );
    expect(result).toEqual({ allowed: false, reason: "outside_hours" });
  });

  it("bloqueia com reason=outside_hours depois do fechamento (21h BRT)", () => {
    const ninePmBrt = new Date("2026-08-27T00:00:00.000Z"); // 21h BRT
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      ninePmBrt
    );
    expect(result).toEqual({ allowed: false, reason: "outside_hours" });
  });

  it("permite exatamente no início da janela (8h BRT)", () => {
    const eightAmBrt = new Date("2026-08-26T11:00:00.000Z"); // 8h BRT
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      eightAmBrt
    );
    expect(result.allowed).toBe(true);
  });

  it("bloqueia exatamente no fim da janela (20h BRT, exclusivo)", () => {
    const eightPmBrt = new Date("2026-08-26T23:00:00.000Z"); // 20h BRT
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      eightPmBrt
    );
    expect(result).toEqual({ allowed: false, reason: "outside_hours" });
  });

  it("respeita janela custom da loja (business_hours_start/end diferentes do default)", () => {
    const customStore = { business_hours_start: "09:00", business_hours_end: "18:00" };
    const eightAmBrt = new Date("2026-08-26T11:00:00.000Z"); // 8h BRT — antes de 9h custom
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      customStore,
      eightAmBrt
    );
    expect(result).toEqual({ allowed: false, reason: "outside_hours" });
  });
});

describe("canSendMarketingMessage — permitido", () => {
  it("dentro de tudo (sem opt-out, sem cap, dentro do horário) permite", () => {
    const result = canSendMarketingMessage(
      { marketing_opt_out: false, last_marketing_sent_at: null },
      STORE,
      NOON_BRT
    );
    expect(result).toEqual({ allowed: true });
  });
});
