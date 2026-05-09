"use client";

import { useFormState } from "react-dom";
import { createStore, type CreateStoreState } from "./actions";

export function CreateStoreForm() {
  const [state, formAction] = useFormState(createStore, null);

  if (state && "success" in state) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Loja criada com sucesso.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Nome</label>
        <input
          name="nome"
          required
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">
          WhatsApp Número (E.164)
        </label>
        <input
          name="whatsapp_numero"
          placeholder="+5511999990001"
          required
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Phone Number ID</label>
        <input
          name="whatsapp_phone_number_id"
          placeholder="opcional"
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>
      {state && "error" in state && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        className="w-full bg-black text-white rounded py-1.5 text-sm font-medium"
      >
        Criar Loja
      </button>
    </form>
  );
}
