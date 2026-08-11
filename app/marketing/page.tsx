import Image from "next/image";
import { DemoRequestForm } from "./DemoRequestForm";
import { HeroChatDemo } from "./HeroChatDemo";
import { StepIcon } from "./StepIcon";
import { StepMedia } from "./StepMedia";
import { STEPS } from "./steps";
import logo from "@/docs/vex/assets/brand/LOGO.png";
import mascote from "@/docs/vex/assets/brand/MASCOTE.png";

export const metadata = {
  title: "Vex Auto — Infraestrutura operacional AI-First para o mercado automotivo",
  description: "Agende uma demonstração do Vex Auto.",
};

export default function MarketingLandingPage() {
  return (
    <main className="marketing-landing">
      <header className="mkt-topbar">
        <Image src={logo} alt="Vex Auto" width={40} height={40} className="mkt-logo" priority />
        <span className="mkt-wordmark">VEX AUTO</span>
      </header>

      <section className="mkt-hero">
        <Image
          src={mascote}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="mkt-hero-mascote"
          priority
        />
        <div className="mkt-hero-grid">
          <div className="mkt-hero-copy">
            <h1>
              Venda mais carros sem deixar
              <br />
              nenhum lead no vácuo.
            </h1>
            <p className="mkt-hero-lead">
              Sistema de atendimento com IA que responde 24h, qualifica quem
              está pronto pra comprar e faz follow-up automático — enquanto
              seu time foca em fechar.
            </p>
            <ul className="mkt-trust-list">
              <li>Sem compromisso. IA nunca fecha venda sozinha — negociação e preço final sempre passam por aprovação humana.</li>
              <li>Responde em segundos, todos os dias — inclusive fora do horário comercial.</li>
            </ul>
            <button type="button" className="mkt-cta-primary" disabled aria-disabled="true" title="Simulação ao vivo em desenvolvimento">
              <span>Testar o sistema no WhatsApp</span>
              <span className="mkt-badge-soon">em breve</span>
            </button>
          </div>
          <div className="mkt-hero-demo">
            <HeroChatDemo />
          </div>
        </div>
      </section>

      <section className="mkt-steps" id="como-funciona">
        <h2>Cada etapa do funil, resolvida.</h2>
        <ol className="mkt-step-list">
          {STEPS.map((step, i) => (
            <li className={`mkt-step ${i % 2 === 1 ? "mkt-step-reverse" : ""}`} key={step.title}>
              <div className="mkt-step-media">
                <StepMedia icon={step.icon} />
              </div>
              <div className="mkt-step-copy">
                <span className="mkt-eyebrow">
                  <StepIcon name={step.icon} />
                  {step.eyebrow}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <div className="mkt-callout">{step.callout}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mkt-social">
        <h2>Early adopters — vagas limitadas</h2>
        <p>
          O Vex Auto está em piloto técnico ativo com uma loja real, validando
          o atendimento e a automação em produção. Ainda não temos números de
          resultado pra divulgar — preferimos abrir vagas limitadas pra quem
          quer construir esse resultado junto com a gente do que inflar
          número antes da hora.
        </p>
      </section>

      <section className="mkt-cta" id="demo">
        <DemoRequestForm />
      </section>

      <footer className="mkt-footer">
        <span>Vex Auto — infraestrutura operacional AI-First para o mercado automotivo.</span>
      </footer>
    </main>
  );
}
