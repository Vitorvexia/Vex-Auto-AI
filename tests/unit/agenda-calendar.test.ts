import { describe, it, expect } from "vitest";
import { buildMonthGrid, addMonths, monthRange } from "@/lib/agenda-calendar";

describe("monthRange", () => {
  it("T1: fevereiro 2026 (28 dias, não-bissexto)", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("T2: fevereiro 2028 (29 dias, bissexto)", () => {
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("T3: dezembro (31 dias, mesmo ano)", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

describe("addMonths", () => {
  it("T1: soma 1 mês dentro do mesmo ano", () => {
    expect(addMonths("2026-08", 1)).toBe("2026-09");
  });

  it("T2: soma 1 mês virando o ano", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("T3: subtrai 1 mês virando o ano", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("buildMonthGrid", () => {
  it("T1: toda semana tem exatos 7 dias", () => {
    const grid = buildMonthGrid("2026-08", "2026-08-13");
    for (const week of grid) {
      expect(week.length).toBe(7);
    }
  });

  it("T2: todo dia do mês (1..N) aparece exatamente uma vez com inMonth=true", () => {
    const grid = buildMonthGrid("2026-08", "2026-08-13");
    const inMonthDates = grid.flat().filter((d) => d.inMonth).map((d) => d.date);
    expect(inMonthDates).toEqual([
      "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05",
      "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10",
      "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15",
      "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20",
      "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25",
      "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30",
      "2026-08-31",
    ]);
  });

  it("T3: dias de preenchimento antes/depois pertencem ao mês vizinho, inMonth=false", () => {
    // Agosto/2026 começa num sábado — semana 1 deve ter 6 dias de julho antes do dia 1
    const grid = buildMonthGrid("2026-08", "2026-08-13");
    const firstWeek = grid[0];
    const paddingBefore = firstWeek.filter((d) => !d.inMonth);
    expect(paddingBefore.length).toBeGreaterThan(0);
    expect(paddingBefore.every((d) => d.date < "2026-08-01")).toBe(true);
  });

  it("T4: marca isToday só na data igual a hoje", () => {
    const grid = buildMonthGrid("2026-08", "2026-08-13");
    const todays = grid.flat().filter((d) => d.isToday);
    expect(todays.length).toBe(1);
    expect(todays[0].date).toBe("2026-08-13");
  });

  it("T5: hoje fora do mês visível (nem como padding) — nenhum dia marcado isToday", () => {
    const grid = buildMonthGrid("2026-08", "2026-10-15");
    expect(grid.flat().some((d) => d.isToday)).toBe(false);
  });

  it("T6: primeiro dia de cada semana é sempre domingo (getUTCDay() === 0)", () => {
    const grid = buildMonthGrid("2026-08", "2026-08-13");
    for (const week of grid) {
      const d = new Date(`${week[0].date}T00:00:00.000Z`);
      expect(d.getUTCDay()).toBe(0);
    }
  });
});
