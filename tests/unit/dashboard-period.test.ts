import { describe, it, expect } from "vitest";
import {
  presetRange,
  customRange,
  resolveRange,
  inRange,
  periodLabel,
  countLeadsInRange,
  countVisitasAgendadasInRange,
  breakdownByOrigem,
  breakdownByVendedor,
  type PeriodSelection,
} from "@/lib/dashboard-period";

const NOW = new Date("2026-08-25T15:00:00.000Z");

describe("presetRange", () => {
  it("hoje: since === until === hoje", () => {
    expect(presetRange("hoje", NOW)).toEqual({ since: "2026-08-25", until: "2026-08-25" });
  });

  it("7d: janela de 7 dias incluindo hoje", () => {
    expect(presetRange("7d", NOW)).toEqual({ since: "2026-08-19", until: "2026-08-25" });
  });

  it("30d: janela de 30 dias incluindo hoje", () => {
    expect(presetRange("30d", NOW)).toEqual({ since: "2026-07-27", until: "2026-08-25" });
  });

  it("todo: sem limite inferior", () => {
    expect(presetRange("todo", NOW)).toEqual({ since: null, until: "2026-08-25" });
  });
});

describe("customRange", () => {
  it("mantém a ordem quando since <= until", () => {
    expect(customRange("2026-08-01", "2026-08-10")).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });

  it("inverte quando o usuário digita until antes de since", () => {
    expect(customRange("2026-08-10", "2026-08-01")).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });
});

describe("resolveRange", () => {
  it("preset delega pra presetRange", () => {
    const sel: PeriodSelection = { kind: "preset", preset: "hoje" };
    expect(resolveRange(sel, NOW)).toEqual({ since: "2026-08-25", until: "2026-08-25" });
  });

  it("custom delega pra customRange", () => {
    const sel: PeriodSelection = { kind: "custom", since: "2026-08-01", until: "2026-08-10" };
    expect(resolveRange(sel, NOW)).toEqual({ since: "2026-08-01", until: "2026-08-10" });
  });
});

describe("inRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("dentro do intervalo (inclusive nas duas pontas)", () => {
    expect(inRange("2026-08-10", range)).toBe(true);
    expect(inRange("2026-08-20", range)).toBe(true);
    expect(inRange("2026-08-15", range)).toBe(true);
  });

  it("fora do intervalo", () => {
    expect(inRange("2026-08-09", range)).toBe(false);
    expect(inRange("2026-08-21", range)).toBe(false);
  });

  it("null/undefined nunca está no intervalo", () => {
    expect(inRange(null, range)).toBe(false);
    expect(inRange(undefined, range)).toBe(false);
  });

  it("since null (todo período): só o teto importa", () => {
    expect(inRange("2020-01-01", { since: null, until: "2026-08-20" })).toBe(true);
    expect(inRange("2026-08-21", { since: null, until: "2026-08-20" })).toBe(false);
  });
});

describe("periodLabel", () => {
  it("presets têm rótulo fixo", () => {
    expect(periodLabel({ kind: "preset", preset: "hoje" })).toBe("hoje");
    expect(periodLabel({ kind: "preset", preset: "7d" })).toBe("7 dias");
    expect(periodLabel({ kind: "preset", preset: "30d" })).toBe("30 dias");
    expect(periodLabel({ kind: "preset", preset: "todo" })).toBe("todo período");
  });

  it("custom com since === until: uma data só", () => {
    expect(periodLabel({ kind: "custom", since: "2026-03-12", until: "2026-03-12" })).toBe("12 mar");
  });

  it("custom com intervalo: 'de - até'", () => {
    expect(periodLabel({ kind: "custom", since: "2026-03-12", until: "2026-03-20" })).toBe("12 mar - 20 mar");
  });
});

describe("countLeadsInRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("conta só leads criados dentro do período", () => {
    const leads = [
      { created_at: "2026-08-15T10:00:00.000Z" },
      { created_at: "2026-08-05T10:00:00.000Z" },
      { created_at: "2026-08-20T23:59:59.000Z" },
    ];
    expect(countLeadsInRange(leads, range)).toBe(2);
  });

  it("created_at null não conta", () => {
    expect(countLeadsInRange([{ created_at: null }], range)).toBe(0);
  });
});

describe("countVisitasAgendadasInRange", () => {
  const range = { since: "2026-08-10", until: "2026-08-20" };

  it("conta leads com agendamento_data dentro do período", () => {
    const leads = [
      { agendamento_data: "2026-08-15" },
      { agendamento_data: "2026-08-01" },
      { agendamento_data: null },
    ];
    expect(countVisitasAgendadasInRange(leads, range)).toBe(1);
  });

  it("agendamento_data undefined (migration não rodou) conta 0, não quebra", () => {
    expect(countVisitasAgendadasInRange([{}, {}], range)).toBe(0);
  });
});

describe("breakdownByOrigem", () => {
  it("agrupa por origem dentro do período, percentuais somam 100, zera entradas sem lead", () => {
    const range = { since: "2026-08-01", until: "2026-08-31" };
    const leads = [
      { created_at: "2026-08-05T00:00:00.000Z", origem: "whatsapp" as const },
      { created_at: "2026-08-06T00:00:00.000Z", origem: "whatsapp" as const },
      { created_at: "2026-08-07T00:00:00.000Z", origem: "site" as const },
      { created_at: "2026-01-01T00:00:00.000Z", origem: "manual" as const }, // fora do período
    ];
    const result = breakdownByOrigem(leads, range);
    expect(result.find((e) => e.key === "manual")).toBeUndefined();
    expect(result.find((e) => e.key === "whatsapp")).toEqual({ key: "whatsapp", label: "WhatsApp", count: 2, percent: 67 });
    expect(result.find((e) => e.key === "site")).toEqual({ key: "site", label: "Site", count: 1, percent: 33 });
    expect(result.reduce((s, e) => s + e.percent, 0)).toBe(100);
  });

  it("período sem leads retorna lista vazia", () => {
    const range = { since: "2020-01-01", until: "2020-01-31" };
    expect(breakdownByOrigem([{ created_at: "2026-08-05T00:00:00.000Z", origem: "whatsapp" as const }], range)).toEqual([]);
  });
});

describe("breakdownByVendedor", () => {
  const sellers = [
    { id: "u1", nome: "Ana" },
    { id: "u2", nome: "Beto" },
  ];
  const range = { since: "2026-08-01", until: "2026-08-31" };

  it("agrupa por vendedor + bucket 'Sem vendedor' pra assigned_to nulo", () => {
    const leads = [
      { created_at: "2026-08-05T00:00:00.000Z", assigned_to: "u1" },
      { created_at: "2026-08-06T00:00:00.000Z", assigned_to: "u1" },
      { created_at: "2026-08-07T00:00:00.000Z", assigned_to: "u2" },
      { created_at: "2026-08-08T00:00:00.000Z", assigned_to: null },
    ];
    const result = breakdownByVendedor(leads, sellers, range);
    expect(result.find((e) => e.key === "u1")).toEqual({ key: "u1", label: "Ana", count: 2, percent: 50 });
    expect(result.find((e) => e.key === "u2")).toEqual({ key: "u2", label: "Beto", count: 1, percent: 25 });
    expect(result.find((e) => e.key === "sem_vendedor")).toEqual({ key: "sem_vendedor", label: "Sem vendedor", count: 1, percent: 25 });
  });

  it("vendedor sem leads no período não aparece", () => {
    const leads = [{ created_at: "2026-08-05T00:00:00.000Z", assigned_to: "u1" }];
    const result = breakdownByVendedor(leads, sellers, range);
    expect(result.find((e) => e.key === "u2")).toBeUndefined();
  });
});
