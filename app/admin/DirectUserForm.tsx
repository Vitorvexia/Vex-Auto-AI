"use client";

import { useFormState } from "react-dom";
import { createStoreUserDirect, type CreateUserState } from "./actions";

export function DirectUserForm({ storeId }: { storeId: string }) {
  const boundAction = createStoreUserDirect.bind(null, storeId);
  const [state, formAction] = useFormState(boundAction, null);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-blue-600 hover:underline list-none">
        Criar usuário direto (sem email de convite)
      </summary>
      <div className="mt-3 border-t pt-3">
        {state && "success" in state && state.success ? (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm space-y-1">
            <p className="font-medium text-green-800">Usuário criado com sucesso</p>
            <p className="text-green-700">Email: <code>{state.email}</code></p>
            <p className="text-green-700">
              Senha temporária: <code className="font-bold">{state.password}</code>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ Copie a senha agora — ela não será exibida novamente se você
              navegar para outra página.
            </p>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nome</label>
                <input
                  name="nome"
                  required
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <select name="role" className="border rounded px-2 py-1 text-sm">
                <option value="admin">admin</option>
                <option value="vendedor">vendedor</option>
              </select>
            </div>
            {state && "error" in state && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            <button
              type="submit"
              className="bg-black text-white rounded px-4 py-1.5 text-sm font-medium"
            >
              Criar usuário com senha
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
