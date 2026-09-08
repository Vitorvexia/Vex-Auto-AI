// Extraído de app/estoque/page.tsx — reusado em /inicio pro alerta de
// margem baixa no estoque.
export function marginPercent(preco: number, custo: number): number {
  if (preco <= 0 || custo <= 0) return 0;
  return ((preco - custo) / preco) * 100;
}
