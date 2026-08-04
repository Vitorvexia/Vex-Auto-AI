import type { PublicStoreInfo } from "@/lib/public-store";

// Logo da loja no topo do site público (roadmap 1.5). Só a imagem — o NOME
// da loja já vira o <h1> da página (listagem: título; detalhe: junto do
// veículo), então este componente nunca repete o texto. Bug corrigido
// (2026-08-04, validação manual em produção): a primeira versão renderizava
// nome aqui E no <h1> — duplicava "Speed Motos" na tela. Sem logo cadastrado,
// não renderiza nada (evita div vazia com margem sobrando).
export function StoreBrandHeader({ store }: { store: Pick<PublicStoreInfo, "nome" | "logo_url"> }) {
  if (!store.logo_url) return null;

  return (
    <div className="site-public-brand">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente */}
      <img src={store.logo_url} alt={`${store.nome} — logo`} className="site-public-logo" />
    </div>
  );
}
