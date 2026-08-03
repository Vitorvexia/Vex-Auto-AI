import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import {
  resolveStoreIdBySlug,
  getPublicVehicleListings,
} from "@/lib/public-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Site público da loja (roadmap 1.4) — template único, multi-tenant. Estilo
// neutro/padrão do sistema (tokens de app/globals.css) — identidade visual
// por loja (logo, cor, texto "sobre") é o item 1.5, próximo do roadmap, não
// antecipado aqui.
//
// Links de veículo são relativos (`/veiculo/[id]`, não `/site/[slug]/veiculo/[id]`)
// de propósito: em produção o visitante está em nomedaloja.vexauto.com.br —
// middleware.ts reescreve internamente pra /site/[slug]/..., mas a URL na
// barra do navegador continua sendo a do subdomínio real. Um Link absoluto
// com o prefixo /site/[slug] quebraria a navegação em produção (o middleware
// tentaria reescrever de novo por cima).
//
// Nome da loja não aparece aqui — public_store_lookup (migration 035) expõe
// só id/slug de propósito (nunca nome/whatsapp), então o cabeçalho é
// genérico até o item 1.5 decidir como/onde a identidade da loja entra.
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
    <div className="site-public">
      <header className="site-public-header">
        <h1>Veículos disponíveis</h1>
      </header>

      {vehicles.length === 0 ? (
        <p className="site-public-empty">Nenhum veículo disponível no momento.</p>
      ) : (
        <div className="site-vehicle-grid">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/veiculo/${v.id}`} className="site-vehicle-card">
              <div className="site-vehicle-thumb">
                {v.photo_url.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente
                  <img src={v.photo_url[0]} alt={`${v.marca} ${v.modelo}`} />
                ) : (
                  <span className="site-vehicle-nophoto">Sem foto</span>
                )}
              </div>
              <div className="site-vehicle-info">
                <div className="site-vehicle-name">{v.marca} {v.modelo}</div>
                <div className="site-vehicle-year">{v.ano}</div>
                <div className="site-vehicle-price">
                  {v.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
