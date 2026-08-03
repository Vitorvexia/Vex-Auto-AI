import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { extractStoreSlugFromHost, DEFAULT_APP_ROOT_DOMAIN } from "@/lib/subdomain";
import { PUBLIC_SITE_ROUTE_HEADER } from "@/lib/public-route-header";

// Rotas hoje protegidas por sessão — preservadas exatamente como estavam
// antes do roteamento por subdomínio (o matcher ficou mais amplo pra
// conseguir inspecionar o Host de QUALQUER request, mas isso não deve, por
// si só, passar a exigir login em rotas que nunca exigiram, ex: "/", "/login",
// "/privacidade", "/renave", "/agenda" — nenhuma delas estava no matcher
// original, então nenhuma delas ganha guard de auth novo aqui).
const PROTECTED_PATH_PREFIXES = [
  "/leads",
  "/conversations",
  "/estoque",
  "/equipe",
  "/analytics",
  "/inicio",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  // Roteamento público por subdomínio (roadmap 1.3) — checado ANTES de
  // qualquer coisa relacionada a sessão/auth. Rota pública não tem usuário
  // logado, então nunca deve passar pelo fluxo de autenticação abaixo.
  const host = request.headers.get("host");
  const storeSlug = extractStoreSlugFromHost(host, {
    queryLoja: request.nextUrl.searchParams.get("loja"),
    rootDomain: process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? DEFAULT_APP_ROOT_DOMAIN,
  });

  if (storeSlug) {
    const url = request.nextUrl.clone();
    const suffix = url.pathname === "/" ? "" : url.pathname;
    url.pathname = `/site/${storeSlug}${suffix}`;
    // Marca a request pra app/layout.tsx saber (via next/headers) que não
    // deve renderizar o Header do app autenticado — o Next.js App Router não
    // permite que um layout aninhado (app/site/[slug]/layout.tsx) remova JSX
    // renderizado por um layout ancestral (app/layout.tsx envolve TODAS as
    // rotas). Este é o mecanismo real; ver app/components/AppChrome.tsx.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PUBLIC_SITE_ROUTE_HEADER, "1");
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const path = request.nextUrl.pathname;
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  if (isAdminRoute) {
    // Inlined — cannot import lib/admin-auth.ts here (Edge Runtime, no Node.js APIs).
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = user.email?.toLowerCase() ?? "";
    if (!adminEmails.includes(userEmail)) {
      return NextResponse.redirect(new URL("/acesso-restrito", request.url));
    }
  }

  return response;
}

export const config = {
  // Antes: só as rotas protegidas (lista de PROTECTED_PATH_PREFIXES). Ampliado
  // pra qualquer path não-asset/não-api porque a detecção de subdomínio
  // (roadmap 1.3) precisa rodar em QUALQUER host, incluindo "/" do site
  // público — não dá pra restringir o matcher às rotas autenticadas e ainda
  // assim resolver subdomínio na home pública. api/_next/favicon excluídos
  // por performance (nunca precisam de auth nem de rewrite de subdomínio).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
