import { DemoRequestForm } from "./DemoRequestForm";

// Landing page de vendas do Vex Auto (roadmap 1.7). Servida em "/" quando o
// Host é o apex ou o "www" do domínio raiz — ver middleware.ts
// (isMarketingApexHost). Estrutura semântica mínima; visual é substituído
// depois pela ferramenta de design própria (fora de escopo deste scaffold).
// Conteúdo abaixo é placeholder — copy final também fica pra depois.
export const metadata = {
  title: "Vex Auto — Infraestrutura operacional AI-First para o mercado automotivo",
  description: "Agende uma demonstração do Vex Auto.",
};

export default function MarketingLandingPage() {
  return (
    <main className="marketing-landing">
      <section className="marketing-hero">
        <h1>[placeholder] Sua loja nunca mais perde um lead</h1>
        <p>
          [placeholder] Vex Auto é a infraestrutura operacional AI-First que
          atende, qualifica e reativa leads 24/7 — enquanto você foca em
          fechar venda.
        </p>
      </section>

      <section className="marketing-diferenciais">
        <h2>[placeholder] Diferenciais</h2>
        <ul>
          <li>[placeholder] Atendimento via WhatsApp 24/7 com IA</li>
          <li>[placeholder] Follow-up e reativação automáticos</li>
          <li>[placeholder] Guardrail de margem no fechamento de venda</li>
        </ul>
      </section>

      <section className="marketing-prova-social">
        <h2>[placeholder] Early adopters — vagas limitadas</h2>
        <p>[placeholder] Prova social vem aqui.</p>
      </section>

      <section className="marketing-cta">
        <DemoRequestForm />
      </section>
    </main>
  );
}
