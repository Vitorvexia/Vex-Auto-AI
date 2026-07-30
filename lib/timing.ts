// ============================================================================
// Helper de delay — isolado em módulo próprio pra ser mockável em testes
// (vi.mock("@/lib/timing")) sem depender de fake timers globais.
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
