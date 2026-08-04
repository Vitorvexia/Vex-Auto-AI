import type { PublicStoreInfo } from "@/lib/public-store";

type Props = {
  store: Pick<PublicStoreInfo, "telefone_publico" | "endereco" | "sobre">;
};

// Bloco de contato/sobre da loja (roadmap 1.5) — só renderiza se houver ao
// menos um dos três campos preenchidos (loja pode não ter cadastrado nada
// ainda, site continua funcionando sem a seção).
export function StoreFooter({ store }: Props) {
  if (!store.telefone_publico && !store.endereco && !store.sobre) return null;

  return (
    <footer className="site-public-footer">
      {store.sobre && <p className="site-public-about">{store.sobre}</p>}
      {(store.telefone_publico || store.endereco) && (
        <div className="site-public-contact">
          {store.telefone_publico && <span>📞 {store.telefone_publico}</span>}
          {store.endereco && <span>📍 {store.endereco}</span>}
        </div>
      )}
    </footer>
  );
}
