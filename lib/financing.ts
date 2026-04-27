export const DEFAULT_MONTHLY_RATE = 0.018;

export interface SimulationParams {
  vehicle_price: number;
  entry_value: number;
  term_months: number;
  monthly_rate?: number;
}

export interface SimulationResult {
  financed_amount: number;
  monthly_payment: number;
  total_amount: number;
  monthly_rate: number;
  term_months: number;
}

export function simulateFinancing(params: SimulationParams): SimulationResult {
  const { vehicle_price, entry_value, term_months } = params;
  const rate = params.monthly_rate ?? DEFAULT_MONTHLY_RATE;

  if (vehicle_price <= 0) throw new Error("Valor do veículo deve ser positivo");

  const principal = vehicle_price - entry_value;
  if (principal <= 0) throw new Error("Valor financiado deve ser positivo");

  // Guard clause: taxa zero = divisão simples sem juros
  if (rate === 0) {
    const payment = Math.round((principal / term_months) * 100) / 100;
    return {
      financed_amount: principal,
      monthly_payment: payment,
      total_amount: Math.round(payment * term_months * 100) / 100,
      monthly_rate: 0,
      term_months,
    };
  }

  // Fórmula Price (PMT)
  const factor = Math.pow(1 + rate, term_months);
  const pmt = (principal * rate * factor) / (factor - 1);

  return {
    financed_amount: principal,
    monthly_payment: Math.round(pmt * 100) / 100,
    total_amount: Math.round(pmt * term_months * 100) / 100,
    monthly_rate: rate,
    term_months,
  };
}
