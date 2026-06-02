"use client";

import { useState, useTransition } from "react";
import { assignLeadToUser, removeLeadAssignment } from "@/lib/actions";

type Props = {
  leadId: string;
  assignedTo: string | null;
  vendedores: { id: string; nome: string }[];
};

export function LeadAssignmentSelect({ leadId, assignedTo, vendedores }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Controlled: track value so RSC re-renders (after revalidatePath) update the select
  const [value, setValue] = useState(assignedTo ?? "");
  const [prevAssignedTo, setPrevAssignedTo] = useState(assignedTo);
  if (prevAssignedTo !== assignedTo) {
    setPrevAssignedTo(assignedTo);
    setValue(assignedTo ?? "");
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const userId = e.target.value;
    const rollbackTo = value; // capture current value before optimistic update
    setValue(userId);
    setErrorMsg(null);
    startTransition(async () => {
      try {
        if (userId) {
          await assignLeadToUser(leadId, userId);
        } else {
          await removeLeadAssignment(leadId);
        }
      } catch (err) {
        setValue(rollbackTo); // rollback to value at the time of the change, not stale prop
        const raw = err instanceof Error ? err.message : "";
        setErrorMsg(
          raw.includes("assigned_to must belong to the same store")
            ? "Não foi possível atribuir este lead ao vendedor selecionado."
            : raw || "Erro ao atribuir vendedor"
        );
      }
    });
  }

  // Fix: derive from `value` (controlled state) so the span stays in sync with the select
  const currentNome = vendedores.find((v) => v.id === value)?.nome ?? null;

  return (
    <div className="lead-assignment">
      {currentNome && (
        <span className="lead-assignment-current">{currentNome}</span>
      )}
      <select
        value={value}
        onChange={handleChange}
        disabled={isPending}
        className="lead-assignment-select"
        aria-label="Atribuir vendedor"
      >
        <option value="">Sem responsável</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nome}
          </option>
        ))}
      </select>
      {errorMsg && (
        <span className="lead-assignment-error" role="alert">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
