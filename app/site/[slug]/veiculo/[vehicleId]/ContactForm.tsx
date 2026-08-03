"use client";

import { useFormState } from "react-dom";
import { submitPublicContactLead, type ContactFormState } from "@/lib/public-contact";
import { HONEYPOT_FIELD_NAME } from "@/lib/public-contact-honeypot";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: ContactFormState = { status: "idle" };

export function ContactForm({ slug }: { slug: string }) {
  const [state, action] = useFormState(
    submitPublicContactLead.bind(null, slug),
    initialState
  );

  if (state.status === "success") {
    return (
      <div className="site-contact-success">
        Recebemos seu contato — em breve alguém da loja fala com você.
      </div>
    );
  }

  return (
    <form action={action} className="site-contact-form">
      <h2>Tenho interesse</h2>

      {/* Honeypot — invisível pra humano, só bot preenche. Nunca display:none
          (alguns bots ignoram campos display:none de propósito); posicionado
          fora da tela + aria-hidden + fora da ordem de tab. */}
      <input
        type="text"
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", opacity: 0 }}
      />

      <label className="site-contact-label" htmlFor="contact-nome">Nome</label>
      <input
        id="contact-nome"
        className="site-contact-input"
        type="text"
        name="nome"
        required
        autoComplete="name"
      />

      <label className="site-contact-label" htmlFor="contact-telefone">Telefone</label>
      <input
        id="contact-telefone"
        className="site-contact-input"
        type="tel"
        name="telefone"
        required
        placeholder="+55 11 99999-0000"
        autoComplete="tel"
      />

      <label className="site-contact-label" htmlFor="contact-mensagem">Mensagem (opcional)</label>
      <textarea
        id="contact-mensagem"
        className="site-contact-input"
        name="mensagem"
        rows={3}
      />

      {state.status === "error" && (
        <span className="site-contact-error">{state.message}</span>
      )}

      <SubmitButton label="Enviar" />
    </form>
  );
}
