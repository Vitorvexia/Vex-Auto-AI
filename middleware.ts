import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  extractStoreSlugFromHost,
  isMarketingApexHost,
  DEFAULT_APP_ROOT_DOMAIN,
} from "@/lib/subdomain";
import { PUBLIC_SITE_ROUTE_HEADER } from "@/lib/public-route-header";
import { shouldRedirectToOnboarding, isOnboardingExemptPath } from "@/lib/onboarding-guard";

// Rotas hoje protegidas por sessão — preservadas exatamente como estavam
// antes do roteamento por subdomínio (o matcher ficou mais amplo pra
// conseguir inspecionar o Host de QUALQUER request, mas isso não deve, por
// si só, passar a exigir login em rotas que nunca exigiram, ex: "/", "/login",
// "/privacidade", "/renave", "/agenda" — nenhuma delas estava no matcher
// original, então nenhuma delas ganha guard de auth novo aqui). "/onboarding"
// (BL-0026) entra na lista de propósito — precisa de sessão como qualquer
// outra rota protegida, mesmo sendo isenta do próprio gate de onboarding.
const PROTECTED_PATH_PREFIXES = [
  "/leads",
  "/conversations",
  "/estoque",
  "/equipe",
  "/analytics",
  "/inicio",
  "/admin",
  "/onboarding",
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

  // Landing page de vendas do Vex Auto (roadmap 1.7) — só a raiz "/" do
  // apex/www é reescrita; outros paths no mesmo host (/login, /privacidade
  // etc.) seguem intocados pro fluxo normal abaixo. Reaproveita
  // PUBLIC_SITE_ROUTE_HEADER (mesmo marcador do site público de loja) porque
  // o efeito desejado é idêntico: layout próprio, sem o Header do app
  // autenticado. Ver app/marketing/page.tsx.
  if (
    request.nextUrl.pathname === "/" &&
    isMarketingApexHost(
      host,
      process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? DEFAULT_APP_ROOT_DOMAIN
    )
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/marketing";
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
  // Inlined — cannot import lib/admin-auth.ts here (Edge Runtime, no Node.js APIs).
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = user.email?.toLowerCase() ?? "";
  const isSuperAdminUser = adminEmails.includes(userEmail);

  if (isAdminRoute) {
    if (!isSuperAdminUser) {
      return NextResponse.redirect(new URL("/acesso-restrito", request.url));
    }
    return response;
  }

  // Gate de onboarding (BL-0026) — só dono_loja com onboarding pendente é
  // redirecionado. Query pulada inteiramente quando dá pra decidir sem I/O
  // (rota isenta ou super_admin já identificado pelo e-mail acima) — reaproveita
  // a sessão já resolvida por auth.getUser() acima em vez de repetir o padrão
  // de lib/auth.ts (assertStoreAdmin/getServerUserRole fazem 2x auth.getUser()
  // cada; aqui é 1 query extra no máximo, sobre a sessão que já existe).
  if (!isSuperAdminUser && !isOnboardingExemptPath(path)) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, store_id, stores(onboarding_completed_at)")
      .eq("id", user.id)
      .single();

    const storeRel = (profile as { stores?: unknown } | null)?.stores;
    const store = Array.isArray(storeRel) ? storeRel[0] : storeRel;
    const onboardingCompletedAt =
      (store as { onboarding_completed_at?: string | null } | undefined)
        ?.onboarding_completed_at ?? null;

    if (
      shouldRedirectToOnboarding({
        pathname: path,
        isSuperAdmin: false,
        role: (profile as { role?: string } | null)?.role ?? null,
        onboardingCompletedAt,
      })
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
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
