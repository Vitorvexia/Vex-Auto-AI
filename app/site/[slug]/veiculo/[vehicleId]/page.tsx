import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { resolveStoreIdBySlug, getPublicVehicleById } from "@/lib/public-store";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Página de detalhe do site público da loja (roadmap 1.4). Mesma allowlist
// de dados do card de listagem (id/store_id/marca/modelo/ano/preco/photo_url/
// disponivel) — nunca custo/margem_minima, mesma decisão da migration 034.
// "Voltar" usa link relativo à raiz do site ("/"), não "/site/[slug]" — ver
// nota em app/site/[slug]/page.tsx sobre por que os links são relativos.
export default async function PublicVehicleDetailPage({
  params,
}: {
  params: { slug: string; vehicleId: string };
}) {
  const supabase = createPublicSupabaseClient();

  const storeId = await resolveStoreIdBySlug(supabase, params.slug);
  if (!storeId) notFound();

  const vehicle = await getPublicVehicleById(supabase, storeId, params.vehicleId);
  if (!vehicle) notFound();

  return (
    <div className="site-public">
      <Link href="/" className="site-public-back">← Voltar ao estoque</Link>

      <div className="site-vehicle-detail">
        <div className="site-vehicle-gallery">
          {vehicle.photo_url.length > 0 ? (
            vehicle.photo_url.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente
              <img
                key={url}
                src={url}
                alt={`${vehicle.marca} ${vehicle.modelo} — foto ${i + 1}`}
              />
            ))
          ) : (
            <div className="site-vehicle-nophoto-large">Sem foto</div>
          )}
        </div>

        <div className="site-vehicle-detail-info">
          <h1>{vehicle.marca} {vehicle.modelo}</h1>
          <div className="site-vehicle-detail-year">{vehicle.ano}</div>
          <div className="site-vehicle-detail-price">
            {vehicle.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          </div>

          <ContactForm slug={params.slug} />
        </div>
      </div>
    </div>
  );
}
