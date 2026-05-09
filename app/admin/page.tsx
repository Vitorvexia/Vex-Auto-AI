import { supabaseAdmin } from "@/lib/supabase";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { createStore, updateStore, createStoreUser } from "./actions";
import { DirectUserForm } from "./DirectUserForm";

// Next.js allows Server Actions to return values (accessible via useActionState),
// but React's form action type only accepts Promise<void>. Cast at call site.
type FormAction = (formData: FormData) => Promise<void>;

type StoreUser = { id: string; nome: string; role: string };
type Store = {
  id: string;
  nome: string;
  whatsapp_numero: string;
  whatsapp_phone_number_id: string | null;
  active: boolean;
  created_at: string;
  users: StoreUser[] | null;
};

export default async function AdminPage() {
  await assertSuperAdmin();

  const { data: stores } = await supabaseAdmin
    .from("stores")
    .select(
      "id, nome, whatsapp_numero, whatsapp_phone_number_id, active, created_at, users(id, nome, role)"
    )
    .order("nome");

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin — Lojas</h1>
        <details className="relative">
          <summary className="cursor-pointer px-4 py-2 bg-black text-white rounded text-sm font-medium list-none">
            + Nova Loja
          </summary>
          <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg p-4 z-10">
            <h3 className="font-semibold mb-3">Nova Loja</h3>
            <form action={createStore as unknown as FormAction} className="space-y-3">
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
                <label className="block text-xs font-medium mb-1">
                  Phone Number ID
                </label>
                <input
                  name="whatsapp_phone_number_id"
                  placeholder="opcional"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-black text-white rounded py-1.5 text-sm font-medium"
              >
                Criar Loja
              </button>
            </form>
          </div>
        </details>
      </div>

      <div className="space-y-4">
        {(stores ?? []).map((store) => {
          const s = store as Store;
          const users = s.users ?? [];
          const waConfigurado = !!(
            s.whatsapp_phone_number_id?.trim()
          );

          return (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg">{s.nome}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.active ? "ATIVA" : "INATIVA"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        waConfigurado
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {waConfigurado ? "WA Configurado" : "WA Apenas Env"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        users.length > 0
                          ? "bg-purple-100 text-purple-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {users.length > 0
                        ? `${users.length} usuário${users.length > 1 ? "s" : ""}`
                        : "Sem Usuário"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {s.whatsapp_numero} · phone_id:{" "}
                    {s.whatsapp_phone_number_id ?? "—"}
                  </div>
                  {users.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {users.map((u) => `${u.nome} (${u.role})`).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* Editar loja */}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-600 hover:underline list-none">
                  Editar configurações
                </summary>
                <div className="mt-3 border-t pt-3">
                  <form
                    action={updateStore.bind(null, s.id) as unknown as FormAction}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Nome
                        </label>
                        <input
                          name="nome"
                          defaultValue={s.nome}
                          required
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Phone Number ID
                        </label>
                        <input
                          name="whatsapp_phone_number_id"
                          defaultValue={s.whatsapp_phone_number_id ?? ""}
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        WhatsApp Número (E.164)
                      </label>
                      <input
                        name="whatsapp_numero"
                        defaultValue={s.whatsapp_numero}
                        required
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Alterar whatsapp_numero quebra o roteamento de
                        inbound sem reconfigurar na Meta.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="active"
                        id={`active-${s.id}`}
                        defaultChecked={s.active}
                      />
                      <label
                        htmlFor={`active-${s.id}`}
                        className="text-sm"
                      >
                        Loja ativa
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="bg-black text-white rounded px-4 py-1.5 text-sm font-medium"
                    >
                      Salvar
                    </button>
                  </form>
                </div>
              </details>

              {/* Criar usuário com convite */}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-blue-600 hover:underline list-none">
                  Criar usuário (convite por email)
                </summary>
                <div className="mt-3 border-t pt-3">
                  <form action={createStoreUser as unknown as FormAction} className="space-y-3">
                    <input type="hidden" name="store_id" value={s.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Email
                        </label>
                        <input
                          name="email"
                          type="email"
                          required
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Nome
                        </label>
                        <input
                          name="nome"
                          required
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Role
                      </label>
                      <select
                        name="role"
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="admin">admin</option>
                        <option value="vendedor">vendedor</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="bg-black text-white rounded px-4 py-1.5 text-sm font-medium"
                    >
                      Enviar Convite
                    </button>
                  </form>
                </div>
              </details>

              {/* Criar usuário com senha temporária (sem email de convite) */}
              <DirectUserForm storeId={s.id} />
            </div>
          );
        })}

        {(stores ?? []).length === 0 && (
          <p className="text-gray-400 text-sm">Nenhuma loja cadastrada.</p>
        )}
      </div>
    </main>
  );
}
