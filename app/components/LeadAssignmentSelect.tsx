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
    setValue(userId); // optimistic update
    setErrorMsg(null);
    startTransition(async () => {
      try {
        if (userId) {
          await assignLeadToUser(leadId, userId);
        } else {
          await removeLeadAssignment(leadId);
        }
      } catch (err) {
        setValue(assignedTo ?? ""); // rollback on failure
        setErrorMsg(
          err instanceof Error ? err.message : "Erro ao atribuir vendedor"
        );
      }
    });
  }

  const currentNome = vendedores.find((v) => v.id === assignedTo)?.nome ?? null;

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
