export interface VendedorLoadCandidate {
  userId: string;
  openLeadCount: number;
  createdAt: string;
}

/** Escolhe o vendedor de menor carga aberta; empate → mais antigo (createdAt) vence. */
export function pickLeastLoadedVendedor(
  candidates: VendedorLoadCandidate[]
): string | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => {
    if (current.openLeadCount < best.openLeadCount) return current;
    if (current.openLeadCount > best.openLeadCount) return best;
    return new Date(current.createdAt) < new Date(best.createdAt) ? current : best;
  }).userId;
}
