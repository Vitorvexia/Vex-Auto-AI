const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// resolveAssignedToFilter
// ============================================================================

/**
 * Resolves the `assigned_to` filter for /leads from the raw `assignedTo`
 * query param. No param (or a malformed one) defaults to the current user's
 * own leads — "all" opts out of filtering explicitly.
 */
export function resolveAssignedToFilter(
  rawParam: string | undefined,
  currentUserId: string
): string | "none" | undefined {
  if (rawParam === "all") return undefined;
  if (rawParam === "none") return "none";
  if (rawParam && UUID_REGEX.test(rawParam)) return rawParam;
  return currentUserId;
}

// ============================================================================
// isStaleLead
// ============================================================================

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** Lead sem atividade há mais de 2h — mesmo limiar usado no badge "Lead Atrasado". */
export function isStaleLead(ultimaAtividade: string, now: number = Date.now()): boolean {
  return now - new Date(ultimaAtividade).getTime() > STALE_THRESHOLD_MS;
}
