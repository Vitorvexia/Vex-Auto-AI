import { notFound } from "next/navigation";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import {
  resolveStoreIdBySlug,
  getPublicVehicleListings,
} from "@/lib/public-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Smoke test do roadmap 1.3 (resolução de subdomínio + acesso público seguro
// ao estoque) — NÃO é o site final da loja. Design, listagem visual, detalhe
// do veículo e formulário de contato são o item 1.4, próximo do roadmap.
export default async function PublicStorePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createPublicSupabaseClient();

  const storeId = await resolveStoreIdBySlug(supabase, params.slug);
  if (!storeId) notFound();

  const vehicles = await getPublicVehicleListings(supabase, storeId);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <p className="text-xs text-gray-400 mb-4">
        Smoke test — roadmap 1.3. Site final da loja (design, detalhe do
        veículo, contato) é o item 1.4.
      </p>
      <h1 className="text-2xl font-semibold mb-6">Estoque — {params.slug}</h1>
      {vehicles.length === 0 ? (
        <p className="text-gray-600">Nenhum veículo disponível no momento.</p>
      ) : (
        <ul className="space-y-2">
          {vehicles.map((v) => (
            <li key={v.id} className="bg-white rounded shadow p-4">
              {v.marca} {v.modelo} — {v.ano} — R${" "}
              {v.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
