"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label = "Importar Lead" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Importando..." : label}
    </button>
  );
}
