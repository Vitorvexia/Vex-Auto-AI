import type { Origem } from "@/types/domain";

export type PeriodPreset = "hoje" | "7d" | "30d" | "todo";

export type PeriodSelection =
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "custom"; since: string; until: string };

export type DateRange = { since: string | null; until: string };

const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  todo: "todo período",
};

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Dia calendário UTC — mesma convenção de lib/metrics.ts (countLeadsToday,
// buildDailyTrend): servidor roda em UTC, timestamps ISO UTC; comparar por
// dia local do processo seria ambíguo entre ambientes.
export function presetRange(preset: PeriodPreset, now: Date = new Date()): DateRange {
  const untilKey = now.toISOString().slice(0, 10);
  if (preset === "todo") return { since: null, until: untilKey };
  const daysBack = preset === "hoje" ? 0 : preset === "7d" ? 6 : 29;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return { since: d.toISOString().slice(0, 10), until: untilKey };
}

// since/until vêm como YYYY-MM-DD de <input type="date">, sem ordem garantida
// (usuário pode digitar a data final antes da inicial) — normaliza.
export function customRange(since: string, until: string): DateRange {
  return since <= until ? { since, until } : { since: until, until: since };
}

export function resolveRange(selection: PeriodSelection, now: Date = new Date()): DateRange {
  return selection.kind === "preset"
    ? presetRange(selection.preset, now)
    : customRange(selection.since, selection.until);
}

export function inRange(dateKey: string | null | undefined, range: DateRange): boolean {
  if (!dateKey) return false;
  if (dateKey > range.until) return false;
  if (range.since !== null && dateKey < range.since) return false;
  return true;
}

function formatShortDatePt(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day} ${MONTHS_PT[Number(month) - 1]}`;
}

export function periodLabel(selection: PeriodSelection): string {
  if (selection.kind === "preset") return PRESET_LABELS[selection.preset];
  const range = customRange(selection.since, selection.until);
  const sinceLabel = formatShortDatePt(range.since as string);
  if (range.since === range.until) return sinceLabel;
  return `${sinceLabel} - ${formatShortDatePt(range.until)}`;
}

export function countLeadsInRange(
  leads: Array<{ created_at: string | null }>,
  range: DateRange
): number {
  return leads.filter((l) => inRange(l.created_at?.slice(0, 10), range)).length;
}

export function countVisitasAgendadasInRange(
  leads: Array<{ agendamento_data?: string | null }>,
  range: DateRange
): number {
  return leads.filter((l) => inRange(l.agendamento_data, range)).length;
}

export type BreakdownEntry<K extends string> = { key: K; label: string; count: number; percent: number };

// Método do maior resto (mesmo de lib/lead-funnel.ts calculateStageBreakdown)
// — garante que os percentuais somem exatamente 100 quando total > 0.
function distributePercent(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / total) * 100);
  const base = exact.map(Math.floor);
  const remaining = 100 - base.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - base[i] }))
    .sort((a, b) => b.frac - a.frac);
  const percents = [...base];
  for (let k = 0; k < remaining; k++) {
    percents[byRemainder[k % byRemainder.length].i] += 1;
  }
  return percents;
}

const ORIGEM_ORDER: Origem[] = ["whatsapp", "portal", "base_inativa", "manual", "site"];
const ORIGEM_LABELS: Record<Origem, string> = {
  whatsapp: "WhatsApp",
  portal: "Portal",
  base_inativa: "Base Inativa",
  manual: "Manual",
  site: "Site",
};

export function breakdownByOrigem(
  leads: Array<{ created_at: string | null; origem: Origem }>,
  range: DateRange
): BreakdownEntry<Origem>[] {
  const inWindow = leads.filter((l) => inRange(l.created_at?.slice(0, 10), range));
  const counts = ORIGEM_ORDER.map((o) => inWindow.filter((l) => l.origem === o).length);
  const percents = distributePercent(counts);
  return ORIGEM_ORDER.map((origem, i) => ({
    key: origem,
    label: ORIGEM_LABELS[origem],
    count: counts[i],
    percent: percents[i],
  })).filter((e) => e.count > 0);
}

export function breakdownByVendedor(
  leads: Array<{ created_at: string | null; assigned_to: string | null }>,
  sellers: Array<{ id: string; nome: string }>,
  range: DateRange
): BreakdownEntry<string>[] {
  const inWindow = leads.filter((l) => inRange(l.created_at?.slice(0, 10), range));
  const sellerIds = sellers.map((s) => s.id);
  const keys = [...sellerIds, "sem_vendedor"];
  const labelOf = (key: string) => sellers.find((s) => s.id === key)?.nome ?? "Sem vendedor";
  const counts = keys.map((key) =>
    key === "sem_vendedor"
      ? inWindow.filter((l) => l.assigned_to === null || !sellerIds.includes(l.assigned_to)).length
      : inWindow.filter((l) => l.assigned_to === key).length
  );
  const percents = distributePercent(counts);
  return keys
    .map((key, i) => ({ key, label: labelOf(key), count: counts[i], percent: percents[i] }))
    .filter((e) => e.count > 0);
}
