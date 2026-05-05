"use client";

import { useState, useMemo } from "react";
import { simulateFinancing, DEFAULT_MONTHLY_RATE } from "@/lib/financing";
import { saveFinancingSimulation } from "@/lib/actions";
import type { FinancingSimulation } from "@/types/domain";

interface Props {
  leadId: string;
  conversationId: string;
  lastSimulation: FinancingSimulation | null;
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinancingSimulator({ leadId, conversationId, lastSimulation }: Props) {
  const [vehiclePrice, setVehiclePrice] = useState(
    lastSimulation ? String(lastSimulation.vehicle_price) : ""
  );
  const [entryValue, setEntryValue] = useState(
    lastSimulation ? String(lastSimulation.entry_value) : "0"
  );
  const [termMonths, setTermMonths] = useState(
    lastSimulation ? String(lastSimulation.term_months) : "48"
  );
  const [monthlyRate, setMonthlyRate] = useState(
    lastSimulation
      ? String(Number((lastSimulation.monthly_rate * 100).toFixed(2)))
      : String(DEFAULT_MONTHLY_RATE * 100)
  );

  const preview = useMemo(() => {
    const price = parseFloat(vehiclePrice);
    const entry = parseFloat(entryValue) || 0;
    const term  = parseInt(termMonths, 10);
    const rate  = parseFloat(monthlyRate) / 100;

    if (!price || price <= 0) return null;
    if (entry < 0 || entry >= price) return null;
    if (!term || term < 12 || term > 72) return null;
    if (isNaN(rate) || rate < 0) return null;

    try {
      return simulateFinancing({ vehicle_price: price, entry_value: entry, term_months: term, monthly_rate: rate });
    } catch {
      return null;
    }
  }, [vehiclePrice, entryValue, termMonths, monthlyRate]);

  const saveAction = saveFinancingSimulation.bind(null, leadId, conversationId);

  const isValid =
    preview !== null &&
    parseInt(termMonths, 10) >= 12 &&
    parseInt(termMonths, 10) <= 72;

  return (
    <div className="financing-simulator">
      <div className="financing-disclaimer">
        Simulação estimada. Valores sujeitos à análise da financeira.
      </div>

      <div className="financing-header">Simulação de Financiamento</div>

      <form action={saveAction} className="financing-form">
        <div className="financing-fields">
          <label className="financing-field">
            <span>Preço do veículo (R$)</span>
            <input
              type="number"
              name="vehicle_price"
              min="1"
              step="100"
              value={vehiclePrice}
              onChange={(e) => setVehiclePrice(e.target.value)}
              placeholder="Ex: 50000"
              required
            />
          </label>

          <label className="financing-field">
            <span>Entrada (R$)</span>
            <input
              type="number"
              name="entry_value"
              min="0"
              step="100"
              value={entryValue}
              onChange={(e) => setEntryValue(e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="financing-field">
            <span>Prazo (meses)</span>
            <input
              type="number"
              name="term_months"
              min="12"
              max="72"
              step="12"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder="48"
              required
            />
          </label>

          <label className="financing-field">
            <span>Taxa mensal (%)</span>
            <input
              type="number"
              name="monthly_rate_pct"
              min="0"
              step="0.01"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              placeholder="1.8"
            />
          </label>
        </div>

        {preview && (
          <div className="financing-preview">
            <div className="financing-preview-row">
              <span>Valor financiado</span>
              <strong>R$ {fmtBRL(preview.financed_amount)}</strong>
            </div>
            <div className="financing-preview-row financing-preview-highlight">
              <span>Parcela estimada</span>
              <strong>R$ {fmtBRL(preview.monthly_payment)} / mês</strong>
            </div>
            <div className="financing-preview-row">
              <span>Total estimado</span>
              <strong>R$ {fmtBRL(preview.total_amount)}</strong>
            </div>
          </div>
        )}

        {!preview && vehiclePrice && (
          <div className="financing-preview-empty">
            Preencha os campos para ver a estimativa.
          </div>
        )}

        <button
          type="submit"
          className="btn-save-simulation"
          disabled={!isValid}
        >
          Salvar simulação
        </button>
      </form>

      {lastSimulation && (
        <div className="financing-last">
          <span className="financing-last-label">Última simulação salva:</span>
          <span>
            R$ {fmtBRL(lastSimulation.vehicle_price)} • {lastSimulation.term_months}x •
            R$ {fmtBRL(lastSimulation.monthly_payment)}/mês
          </span>
        </div>
      )}
    </div>
  );
}
