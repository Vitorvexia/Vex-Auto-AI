"use client";

import { useFormState } from "react-dom";
import { createDemoRequest, type DemoRequestState } from "@/lib/demo-request-actions";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: DemoRequestState = { status: "idle" };

export function DemoRequestForm() {
  const [state, action] = useFormState(createDemoRequest, initialState);

  if (state.status === "success") {
    return (
      <div className="marketing-cta-success">
        Recebemos seu pedido — em breve alguém do time Vex Auto entra em contato.
      </div>
    );
  }

  return (
    <form action={action} className="marketing-cta-form">
      <h2>Agende uma demonstração</h2>

      {/* Honeypot — mesmo mecanismo do formulário de contato do site de
          loja (lib/public-contact-honeypot.ts): invisível pra humano, só
          bot preenche. */}
      <input
        type="text"
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", opacity: 0 }}
      />

      <label htmlFor="demo-nome">Nome</label>
      <input id="demo-nome" type="text" name="nome" required autoComplete="name" />

      <label htmlFor="demo-empresa">Empresa</label>
      <input id="demo-empresa" type="text" name="empresa" required autoComplete="organization" />

      <label htmlFor="demo-telefone">Telefone</label>
      <input
        id="demo-telefone"
        type="tel"
        name="telefone"
        required
        placeholder="+55 11 99999-0000"
        autoComplete="tel"
      />

      <label htmlFor="demo-email">E-mail (opcional)</label>
      <input id="demo-email" type="email" name="email" autoComplete="email" />

      <label htmlFor="demo-mensagem">Mensagem (opcional)</label>
      <textarea id="demo-mensagem" name="mensagem" rows={3} />

      {state.status === "error" && (
        <span className="marketing-cta-error">{state.message}</span>
      )}

      <SubmitButton label="Quero agendar" />
    </form>
  );
}
