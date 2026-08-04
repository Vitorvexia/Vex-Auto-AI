import type { PublicStoreInfo } from "@/lib/public-store";

// Cabeçalho de marca do site público (roadmap 1.5) — logo (se existir) + nome
// da loja. Componente compartilhado entre a listagem e o detalhe de veículo,
// única fonte de markup pra não duplicar a lógica do "se logo_url existir"
// nos dois pontos de uso.
export function StoreBrandHeader({ store }: { store: Pick<PublicStoreInfo, "nome" | "logo_url"> }) {
  return (
    <div className="site-public-brand">
      {store.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- URL pública do Storage, host dinâmico por ambiente
        <img src={store.logo_url} alt={`${store.nome} — logo`} className="site-public-logo" />
      )}
      <span className="site-public-brand-name">{store.nome}</span>
    </div>
  );
}
