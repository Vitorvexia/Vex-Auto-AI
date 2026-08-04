"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateStoreNomeSelfService,
  createStoreVendedorSelfService,
  skipEstoqueOnboarding,
  updateStoreWhatsAppSelfService,
} from "@/lib/onboarding-actions";
import type { OnboardingStep } from "@/lib/onboarding";

type WizardStep = Exclude<OnboardingStep, "done">;
type ActionResult = { error: string } | { success: true } | null;

const STEP_ORDER: WizardStep[] = ["nome", "vendedores", "estoque", "whatsapp"];
const STEP_LABELS: Record<WizardStep, string> = {
  nome: "Nome da loja",
  vendedores: "Vendedor",
  estoque: "Estoque",
  whatsapp: "WhatsApp",
};

// Ações em lib/onboarding-actions.ts recebem só FormData (mesma assinatura
// usada onde já são chamadas fora de wizard nenhum) — useFormState exige
// (prevState, formData). Adaptador local, sem tocar a assinatura original
// (D1-D9 em tests/unit/onboarding-actions.test.ts dependem dela como está).
function adaptToFormAction<T>(action: (formData: FormData) => Promise<T>) {
  return (_prev: T | null, formData: FormData) => action(formData);
}

function useRefreshOnSuccess(state: ActionResult) {
  const router = useRouter();
  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.refresh();
    }
  }, [state, router]);
}

export function OnboardingWizard({
  currentStep,
  storeNome,
}: {
  currentStep: WizardStep;
  storeNome: string;
}) {
  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="onboarding-card">
      <div className="onboarding-progress">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className={`onboarding-progress-dot${i < stepIndex ? " done" : ""}`} />
        ))}
      </div>
      <div className="onboarding-step-label">
        Passo {stepIndex + 1} de {STEP_ORDER.length} — {STEP_LABELS[currentStep]}
      </div>

      {currentStep === "nome" && <NomeStep storeNome={storeNome} />}
      {currentStep === "vendedores" && <VendedorStep />}
      {currentStep === "estoque" && <EstoqueStep />}
      {currentStep === "whatsapp" && <WhatsAppStep />}
    </div>
  );
}

function NomeStep({ storeNome }: { storeNome: string }) {
  const [state, formAction] = useFormState(adaptToFormAction(updateStoreNomeSelfService), null);
  useRefreshOnSuccess(state);

  return (
    <>
      <div className="onboarding-title">Como se chama sua loja?</div>
      <div className="onboarding-desc">
        Esse nome aparece pro seu time dentro do sistema. Você pode mudar depois.
      </div>
      <form action={formAction} className="import-form">
        <div className="import-field">
          <input
            name="nome"
            required
            defaultValue={storeNome}
            className="import-input"
            placeholder="Ex: Speed Motos"
          />
        </div>
        {state && "error" in state && <div className="import-feedback error">{state.error}</div>}
        <div className="import-actions">
          <button type="submit">Próximo</button>
        </div>
      </form>
    </>
  );
}

function VendedorStep() {
  const [state, formAction] = useFormState(
    adaptToFormAction(createStoreVendedorSelfService),
    null
  );
  const router = useRouter();

  if (state && "success" in state && state.success) {
    return (
      <>
        <div className="onboarding-title">Vendedor criado</div>
        <div className="import-feedback success" style={{ display: "block", padding: "12px" }}>
          <p style={{ fontWeight: 700, marginBottom: "4px" }}>
            Email: <code>{state.email}</code>
          </p>
          <p>
            Senha temporária: <code style={{ fontWeight: 700 }}>{state.password}</code>
          </p>
          <p style={{ fontSize: "11.5px", marginTop: "6px" }}>
            Copie a senha agora e envie pro vendedor — ela não aparece de novo.
          </p>
        </div>
        <div className="import-actions">
          <button type="button" className="card-cta" onClick={() => router.refresh()}>
            Continuar →
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="onboarding-title">Cadastre pelo menos um vendedor</div>
      <div className="onboarding-desc">
        Cada vendedor recebe login próprio e só vê os leads da sua loja.
      </div>
      <form action={formAction} className="import-form">
        <div className="import-row">
          <div className="import-field">
            <label className="import-label">Nome do vendedor</label>
            <input name="nome" required className="import-input" placeholder="Ex: Maria Silva" />
          </div>
          <div className="import-field">
            <label className="import-label">Email</label>
            <input
              name="email"
              type="email"
              required
              className="import-input"
              placeholder="maria@speedmotos.com"
            />
          </div>
        </div>
        {state && "error" in state && <div className="import-feedback error">{state.error}</div>}
        <div className="import-actions">
          <button type="submit">Cadastrar vendedor</button>
        </div>
      </form>
    </>
  );
}

function EstoqueStep() {
  const [state, formAction] = useFormState(
    adaptToFormAction((_formData: FormData) => skipEstoqueOnboarding()),
    null
  );
  useRefreshOnSuccess(state);

  return (
    <>
      <div className="onboarding-title">Cadastre um veículo (opcional)</div>
      <div className="onboarding-desc">
        Pode cadastrar agora no estoque ou deixar pra depois — o sistema funciona mesmo com o
        estoque vazio.
      </div>
      <div className="import-actions">
        <Link href="/estoque" className="card-cta">
          Ir pro estoque agora →
        </Link>
      </div>
      <form action={formAction} style={{ marginTop: "12px" }}>
        {state && "error" in state && <div className="import-feedback error">{state.error}</div>}
        <button
          type="submit"
          className="card-cta"
          style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer" }}
        >
          Pular por enquanto
        </button>
      </form>
    </>
  );
}

function WhatsAppStep() {
  const [state, formAction] = useFormState(
    adaptToFormAction(updateStoreWhatsAppSelfService),
    null
  );
  useRefreshOnSuccess(state);

  return (
    <>
      <div className="onboarding-title">Conecte o WhatsApp da loja</div>
      <div className="onboarding-desc">
        Vá em{" "}
        <a href="https://business.facebook.com/" target="_blank" rel="noreferrer">
          business.facebook.com
        </a>
        , verifique sua empresa, gere um token permanente no WhatsApp Manager e registre o número
        real da loja. Cole o Phone Number ID e o número abaixo quando terminar.
      </div>
      <form action={formAction} className="import-form">
        <div className="import-field">
          <label className="import-label">Phone Number ID</label>
          <input
            name="whatsapp_phone_number_id"
            required
            className="import-input"
            placeholder="123456789012345"
          />
        </div>
        <div className="import-field">
          <label className="import-label">Número (E.164)</label>
          <input
            name="whatsapp_numero"
            required
            className="import-input"
            placeholder="+5511999999999"
          />
        </div>
        {state && "error" in state && <div className="import-feedback error">{state.error}</div>}
        <div className="import-actions">
          <button type="submit">Concluir configuração</button>
        </div>
      </form>
    </>
  );
}
