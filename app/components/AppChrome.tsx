import { Header } from "@/app/components/Header";

// Decide se o Header do app autenticado renderiza. Existe como componente
// isolado (em vez de inline no root layout) por causa de uma restrição do
// Next.js App Router: um layout aninhado (app/site/[slug]/layout.tsx) NÃO
// consegue remover JSX renderizado por um layout ancestral — app/layout.tsx
// envolve TODAS as rotas, incluindo o site público da loja (roadmap 1.3).
// A decisão precisa morar aqui, no layout raiz, controlada por uma prop
// booleana computada a partir do header que middleware.ts marca em toda
// request reescrita pro site público (PUBLIC_SITE_ROUTE_HEADER).
export function AppChrome({
  isPublicRoute,
  isAdmin,
  children,
}: {
  isPublicRoute: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  if (isPublicRoute) return <>{children}</>;
  return (
    <>
      <Header isAdmin={isAdmin} />
      {children}
    </>
  );
}
