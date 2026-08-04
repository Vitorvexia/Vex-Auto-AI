import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { getPublicStoreBySlug, getPublicVehicleListings } from "@/lib/public-store";
import { StoreBrandHeader } from "./StoreBrandHeader";
import { StoreFooter } from "./StoreFooter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Site público da loja (roadmap 1.4/1.5) — template único, multi-tenant.
// Identidade visual por loja (logo, cor primária, telefone, endereço,
// "sobre") vem da view public_store_lookup (migration 039). cor_primaria
// sobrescreve --accent só dentro de .site-public (style inline no container
// raiz) — nunca vaza pro app autenticado, que tem seu próprio --accent fixo
// em globals.css.
//
// Links de veículo são relativos (`/veiculo/[id]`, não `/site/[slug]/veiculo/[id]`)
// de propósito: em produção o visitante está em nomedaloja.vexauto.com.br —
// middleware.ts reescreve internamente pra /site/[slug]/..., mas a URL na
// barra do navegador continua sendo a do subdomínio real. Um Link absoluto
// com o prefixo /site/[slug] quebraria a navegação em produção (o middleware
// tentaria reescrever de novo por cima).
export default async function PublicStorePage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createPublicSupabaseClient();

  const store = await getPublicStoreBySlug(supabase, params.slug);
  if (!store) notFound();

  const vehicles = await getPublicVehicleListings(supabase, store.id);

  const accentStyle = store.cor_primaria
    ? ({ "--accent": store.cor_primaria } as CSSProperties)
    : undefined;

  return (
    <div className="site-public" style={accentStyle}>
      <StoreBrandHeader store={store} />

      <header className="site-public-header">
        <h1>{store.nome}</h1>
        <div className="site-public-header-subtitle">Veículos disponíveis</div>
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

      <StoreFooter store={store} />
    </div>
  );
}
