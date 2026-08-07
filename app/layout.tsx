import "./globals.css";
import { Exo_2, Barlow } from "next/font/google";
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
    <html lang="pt-BR" className={`${exo2.variable} ${barlow.variable} ${bebasNeue.variable}`}>
      <body>
        <AppChrome isPublicRoute={isPublicRoute} isAdmin={isSuperAdmin(user?.email)}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
