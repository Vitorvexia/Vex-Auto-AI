"use client";

import { useEffect, useState } from "react";

type ChatTurn = {
  from: "lead" | "ia";
  text: string;
  time: string;
};

// Conversa fictícia — ilustra o produto real (coleta de financiamento/troca,
// agendamento), nunca representa um lead ou loja real. Ver lib/collection.ts
// pro fluxo real que isso ilustra de forma simplificada.
const SCRIPT: ChatTurn[] = [
  { from: "lead", text: "Boa noite! O Compass 2022 ainda tá disponível?", time: "21:48" },
  { from: "ia", text: "Boa noite, Rafael! Está sim ✅ Você pretende financiar ou pagar à vista?", time: "21:48" },
  { from: "lead", text: "Financiado. Tenho um HB20 2019 pra dar de entrada.", time: "21:49" },
  { from: "ia", text: "Perfeito, consigo já anotar seu HB20 na negociação. Consegue vir amanhã às 15h pra avaliarmos e você testar o Compass?", time: "21:49" },
  { from: "lead", text: "Consigo sim!", time: "21:50" },
  { from: "ia", text: "Combinado 🙌 Te espero amanhã às 15h — vou confirmar 1h antes por aqui.", time: "21:50" },
];

const STEP_MS = 1700;
const RESTART_PAUSE_MS = 2600;

export function HeroChatDemo() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [typing, setTyping] = useState(false);

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
      <div className="mkt-phone-body">
        {visible.map((turn, i) => (
          <div key={i} className={`mkt-bubble mkt-bubble-${turn.from}`}>
            <span>{turn.text}</span>
            <time>{turn.time}</time>
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
