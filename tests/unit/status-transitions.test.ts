import { describe, it, expect } from "vitest";
import {
  canTransitionLead,
  canTransitionConversation,
} from "@/lib/status";

describe("canTransitionLead", () => {
  it("permite fluxo feliz progressivo", () => {
    expect(canTransitionLead("NOVO", "ENGAJADO")).toBe(true);
    expect(canTransitionLead("ENGAJADO", "INTERESSADO")).toBe(true);
    expect(canTransitionLead("INTERESSADO", "QUENTE")).toBe(true);
    expect(canTransitionLead("QUENTE", "NEGOCIACAO")).toBe(true);
    expect(canTransitionLead("NEGOCIACAO", "FECHADO")).toBe(true);
  });

  it("permite ir direto para PERDIDO de estados ativos", () => {
    expect(canTransitionLead("NOVO", "PERDIDO")).toBe(true);
    expect(canTransitionLead("ENGAJADO", "PERDIDO")).toBe(true);
    expect(canTransitionLead("INTERESSADO", "PERDIDO")).toBe(true);
    expect(canTransitionLead("QUENTE", "PERDIDO")).toBe(true);
    expect(canTransitionLead("NEGOCIACAO", "PERDIDO")).toBe(true);
  });

  it("bloqueia pulos invalidos", () => {
    expect(canTransitionLead("NOVO", "FECHADO")).toBe(false);
    expect(canTransitionLead("NOVO", "NEGOCIACAO")).toBe(false);
    expect(canTransitionLead("NOVO", "QUENTE")).toBe(false);
    expect(canTransitionLead("NOVO", "INTERESSADO")).toBe(false);
    expect(canTransitionLead("ENGAJADO", "FECHADO")).toBe(false);
    expect(canTransitionLead("INTERESSADO", "FECHADO")).toBe(false);
  });

  it("FECHADO eh terminal", () => {
    expect(canTransitionLead("FECHADO", "NOVO")).toBe(false);
    expect(canTransitionLead("FECHADO", "ENGAJADO")).toBe(false);
    expect(canTransitionLead("FECHADO", "PERDIDO")).toBe(false);
    expect(canTransitionLead("FECHADO", "NEGOCIACAO")).toBe(false);
  });

  it("PERDIDO reativa apenas para ENGAJADO", () => {
    expect(canTransitionLead("PERDIDO", "ENGAJADO")).toBe(true);
    expect(canTransitionLead("PERDIDO", "NOVO")).toBe(false);
    expect(canTransitionLead("PERDIDO", "QUENTE")).toBe(false);
    expect(canTransitionLead("PERDIDO", "FECHADO")).toBe(false);
  });

  it("permite cooldown QUENTE -> INTERESSADO e NEGOCIACAO -> QUENTE", () => {
    expect(canTransitionLead("QUENTE", "INTERESSADO")).toBe(true);
    expect(canTransitionLead("NEGOCIACAO", "QUENTE")).toBe(true);
  });

  it("mesma transicao (from == to) eh sempre valida", () => {
    expect(canTransitionLead("NOVO", "NOVO")).toBe(true);
    expect(canTransitionLead("QUENTE", "QUENTE")).toBe(true);
    expect(canTransitionLead("FECHADO", "FECHADO")).toBe(true);
  });
});

describe("canTransitionConversation", () => {
  it("ATIVA aceita AGUARDANDO_HUMANO / PAUSADA / ENCERRADA", () => {
    expect(canTransitionConversation("ATIVA", "AGUARDANDO_HUMANO")).toBe(true);
    expect(canTransitionConversation("ATIVA", "PAUSADA")).toBe(true);
    expect(canTransitionConversation("ATIVA", "ENCERRADA")).toBe(true);
  });

  it("AGUARDANDO_HUMANO devolve para ATIVA ou fecha", () => {
    expect(canTransitionConversation("AGUARDANDO_HUMANO", "ATIVA")).toBe(true);
    expect(canTransitionConversation("AGUARDANDO_HUMANO", "ENCERRADA")).toBe(
      true
    );
    expect(canTransitionConversation("AGUARDANDO_HUMANO", "PAUSADA")).toBe(
      false
    );
  });

  it("PAUSADA volta para ATIVA ou fecha", () => {
    expect(canTransitionConversation("PAUSADA", "ATIVA")).toBe(true);
    expect(canTransitionConversation("PAUSADA", "ENCERRADA")).toBe(true);
    expect(canTransitionConversation("PAUSADA", "AGUARDANDO_HUMANO")).toBe(
      false
    );
  });

  it("ENCERRADA eh terminal", () => {
    expect(canTransitionConversation("ENCERRADA", "ATIVA")).toBe(false);
    expect(canTransitionConversation("ENCERRADA", "PAUSADA")).toBe(false);
    expect(canTransitionConversation("ENCERRADA", "AGUARDANDO_HUMANO")).toBe(
      false
    );
  });

  it("mesma transicao eh sempre valida", () => {
    expect(canTransitionConversation("ATIVA", "ATIVA")).toBe(true);
    expect(canTransitionConversation("ENCERRADA", "ENCERRADA")).toBe(true);
  });
});
