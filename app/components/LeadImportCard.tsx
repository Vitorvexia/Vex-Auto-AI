"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { importLead } from "@/lib/actions";
import { SubmitButton } from "@/app/components/SubmitButton";

const FEEDBACK: Record<string, { cls: string; msg: string }> = {
  created:       { cls: "import-feedback success", msg: "Lead criado com sucesso." },
  existing:      { cls: "import-feedback warning", msg: "Lead já existe no sistema." },
  invalid_phone: { cls: "import-feedback error",   msg: "Telefone inválido." },
  missing_store: { cls: "import-feedback error",   msg: "Erro de configuração do servidor." },
  invalid_input: { cls: "import-feedback error",   msg: "Nome é obrigatório." },
};

export function LeadImportCard() {
  const [state, action] = useFormState(importLead, null);
  const fb = state ? FEEDBACK[state.status] : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.status === "created") {
      formRef.current?.reset();
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button type="button" className="lead-create-trigger" onClick={() => dialogRef.current?.showModal()}>
        + Criar Lead
      </button>

      <dialog
        ref={dialogRef}
        className="lead-create-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="import-card">
          <div className="import-card-header">
            <div>
              <span className="import-card-title">Criar Lead Manual</span>
              <span className="import-card-sub">Cadastro manual — sem disparo automático</span>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              className="lead-create-dialog-close"
              onClick={() => dialogRef.current?.close()}
            >
              ✕
            </button>
          </div>

          <form ref={formRef} action={action} className="import-form">
            <div className="import-row">
              <div className="import-field">
                <label className="import-label" htmlFor="imp-nome">Nome</label>
                <input
                  id="imp-nome"
                  className="import-input"
                  type="text"
                  name="nome"
                  placeholder="Ex: João Silva"
                  required
                  autoComplete="off"
                />
              </div>
              <div className="import-field">
                <label className="import-label" htmlFor="imp-tel">Telefone</label>
                <input
                  id="imp-tel"
                  className="import-input"
                  type="tel"
                  name="telefone"
                  placeholder="+55 11 99999-0000"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="import-row">
              <div className="import-field">
                <label className="import-label" htmlFor="imp-interesse">Interesse</label>
                <input
                  id="imp-interesse"
                  className="import-input"
                  type="text"
                  name="interesse"
                  placeholder="Ex: SUV até R$ 80k"
                  autoComplete="off"
                />
              </div>
              <div className="import-field">
                <label className="import-label" htmlFor="imp-obs">Observação interna</label>
                <input
                  id="imp-obs"
                  className="import-input"
                  type="text"
                  name="observacao"
                  placeholder="Ex: Indicado por fulano"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="import-actions">
              {fb && <span className={fb.cls}>{fb.msg}</span>}
              <SubmitButton label="Criar Lead" />
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
