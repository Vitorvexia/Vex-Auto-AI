"use client";

import { useEffect, useRef, useState } from "react";

type ChatTurn = {
  from: "lead" | "ia";
  text: string;
  time: string;
  photos?: boolean;
};

// Conversa fictícia — ilustra o produto real (coleta de financiamento/troca,
// agendamento), nunca representa um lead ou loja real. Ver lib/collection.ts
// pro fluxo real que isso ilustra de forma simplificada. Sem emoji de propósito
// — texto emojificado lê como "resposta de robô", o objetivo aqui é o oposto.
const SCRIPT: ChatTurn[] = [
  { from: "lead", text: "Oi! O Nivus ainda está disponível?", time: "21:48" },
  { from: "ia", text: "Olá, Vitor! Está sim. Separei umas fotos pra você. Prefere financiar ou fechar à vista? Teria carro pra dar de entrada?", time: "21:48", photos: true },
  { from: "lead", text: "À vista. Tenho um Onix pra dar de entrada.", time: "21:49" },
  { from: "ia", text: "Show, já anoto o Onix na negociação. Consegue vir amanhã às 15h pra avaliarmos ele e você conhecer o Nivus de pertinho?", time: "21:49" },
  { from: "lead", text: "Consigo sim.", time: "21:50" },
  { from: "ia", text: "Combinado. Te espero amanhã às 15h, confirmo 1h antes por aqui.", time: "21:50" },
];

const STEP_MS = 1700;
const RESTART_PAUSE_MS = 2600;

function ReadTicks() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none" aria-hidden="true" className="mkt-ticks">
      <path d="M1 5.5 4 8.5 10 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5.5 9 8.5 15 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhotoThumb() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 30" aria-hidden="true">
      <rect x="0" y="0" width="40" height="30" rx="3" fill="rgba(255,255,255,.08)" />
      <path d="M8 21 15 12 20 17 25 10 32 21Z" fill="rgba(255,255,255,.22)" />
      <circle cx="12" cy="9" r="2.4" fill="rgba(255,255,255,.22)" />
    </svg>
  );
}

export function HeroChatDemo() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleCount >= SCRIPT.length) {
      const resetId = setTimeout(() => setVisibleCount(1), RESTART_PAUSE_MS);
      return () => clearTimeout(resetId);
    }

    const nextTurn = SCRIPT[visibleCount];
    const isIaTurn = nextTurn.from === "ia";
    const typingDelay = isIaTurn ? STEP_MS * 0.55 : 0;

    if (isIaTurn) setTyping(true);

    const revealId = setTimeout(() => {
      setTyping(false);
      setVisibleCount((count) => count + 1);
    }, STEP_MS + typingDelay);

    return () => clearTimeout(revealId);
  }, [visibleCount]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visibleCount, typing]);

  const visible = SCRIPT.slice(0, visibleCount);

  return (
    <div className="mkt-phone" role="img" aria-label="Simulação de atendimento via WhatsApp com a IA da Vex Auto">
      <div className="mkt-phone-header">
        <div className="mkt-phone-avatar">V</div>
        <div>
          <div className="mkt-phone-name">Vex Auto</div>
          <div className="mkt-phone-status">online</div>
        </div>
      </div>
      <div className="mkt-phone-body" ref={bodyRef}>
        {visible.map((turn, i) => (
          <div key={i} className={`mkt-bubble mkt-bubble-${turn.from}`}>
            {turn.photos && (
              <div className="mkt-bubble-photos">
                <PhotoThumb />
                <PhotoThumb />
              </div>
            )}
            <span>{turn.text}</span>
            <time>
              {turn.time}
              {turn.from === "lead" && <ReadTicks />}
            </time>
          </div>
        ))}
        {typing && (
          <div className="mkt-bubble mkt-bubble-ia mkt-bubble-typing" aria-hidden="true">
            <span className="mkt-typing-dot" />
            <span className="mkt-typing-dot" />
            <span className="mkt-typing-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
