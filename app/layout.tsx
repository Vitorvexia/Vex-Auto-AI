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
        {/* Aplica o tema salvo ANTES do primeiro paint — evita flash do tema
            errado (script bloqueante clássico, mesma técnica de next-themes).
            Default é escuro (DL-0015); só precisa agir se o usuário
            escolheu claro alguma vez. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('vex-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}",
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
