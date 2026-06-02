"use client";

import { useTransition } from "react";
import { assignLeadToUser, removeLeadAssignment } from "@/lib/actions";

type Props = {
  leadId: string;
  assignedTo: string | null;
  vendedores: { id: string; nome: string }[];
};

export function LeadAssignmentSelect({ leadId, assignedTo, vendedores }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const userId = e.target.value;
    startTransition(async () => {
      if (userId) {
        await assignLeadToUser(leadId, userId);
      } else {
        await removeLeadAssignment(leadId);
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
        defaultValue={assignedTo ?? ""}
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
    </div>
  );
}
