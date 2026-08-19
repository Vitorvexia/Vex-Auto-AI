import "./globals.css";
import { Exo_2, Barlow, Inter } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { AppChrome } from "@/app/components/AppChrome";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSuperAdmin } from "@/lib/admin-auth";
import { PUBLIC_SITE_ROUTE_HEADER } from "@/lib/public-route-header";

const exo2 = Exo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-exo2",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["900"],
  style: ["italic"],
  variable: "--font-barlow",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const bebasNeue = localFont({
  src: "./fonts/BebasNeue-Regular.ttf",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata = {
  title: "Vex Auto",
  description: "Infraestrutura operacional AI-First para o mercado automotivo",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const requestHeaders = await headers();
  const isPublicRoute = requestHeaders.get(PUBLIC_SITE_ROUTE_HEADER) === "1";

  return (
    <html lang="pt-BR" className={`${exo2.variable} ${barlow.variable} ${bebasNeue.variable} ${inter.variable}`}>
      <head>
        {/* Aplica tema e estado da sidebar ANTES do primeiro paint — evita
            flash do tema errado / layout pulando ao expandir-colapsar
            (script bloqueante clássico, mesma técnica de next-themes).
            Default é CLARO desde DL-0016 (reversão de DL-0015, pedido
            direto do founder) — só fica escuro se o usuário escolheu
            explicitamente no toggle da sidebar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('vex-theme')!=='dark'){document.documentElement.setAttribute('data-theme','light');}}catch(e){document.documentElement.setAttribute('data-theme','light');}" +
              "try{if(localStorage.getItem('vex-sidebar')==='collapsed'){document.documentElement.setAttribute('data-sidebar','collapsed');}}catch(e){}",
          }}
        />
      </head>
      <body>
        <AppChrome isPublicRoute={isPublicRoute} isAdmin={isSuperAdmin(user?.email)}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
