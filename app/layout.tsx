import "./globals.css";
import { Exo_2, Barlow } from "next/font/google";
import { Header } from "@/app/components/Header";

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

export const metadata = {
  title: "Vex Auto",
  description: "Infraestrutura operacional AI-First para o mercado automotivo",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${exo2.variable} ${barlow.variable}`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
