import "./globals.css";

export const metadata = {
  title: "Vex Auto",
  description: "Infraestrutura operacional AI-First para o mercado automotivo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
