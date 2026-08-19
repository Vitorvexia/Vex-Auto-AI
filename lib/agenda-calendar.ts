export type CalendarDay = {
  date: string; // ISO YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
};

function daysInMonth(year: number, month1to12: number): number {
  // dia 0 do mês seguinte = último dia do mês atual
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function monthRange(monthISO: string): { start: string; end: string } {
  const [year, month] = monthISO.split("-").map(Number);
  const lastDay = daysInMonth(year, month);
  return {
    start: `${monthISO}-01`,
    end: `${monthISO}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function addMonths(monthISO: string, delta: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildMonthGrid(monthISO: string, todayISO: string): CalendarDay[][] {
  const { start, end } = monthRange(monthISO);
  const firstOfMonth = new Date(`${start}T00:00:00.000Z`);
  const lastOfMonth = new Date(`${end}T00:00:00.000Z`);

  // Recua até o domingo que inicia a semana do dia 1
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  // Avança até o sábado que fecha a semana do último dia
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: CalendarDay[][] = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toISODate(cursor);
      week.push({
        date: iso,
        inMonth: iso >= start && iso <= end,
        isToday: iso === todayISO,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
