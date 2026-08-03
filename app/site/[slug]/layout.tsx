// Layout do site público da loja (roadmap 1.3) — deliberadamente vazio, sem
// estilo (isso é trabalho do 1.4).
//
// A supressão do Header do app autenticado NÃO acontece aqui — o Next.js App
// Router não permite que um layout aninhado remova JSX renderizado por um
// layout ancestral (app/layout.tsx envolve TODAS as rotas, inclusive esta).
// O mecanismo real é middleware.ts marcando a request com
// PUBLIC_SITE_ROUTE_HEADER + app/components/AppChrome.tsx lendo essa marca
// no layout raiz. Este arquivo existe pra sinalizar explicitamente, na
// estrutura de pastas, que esta subárvore é pública — nunca deve ganhar
// nenhum componente que assuma sessão (Header, links de navegação interna,
// etc.).
export default function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
