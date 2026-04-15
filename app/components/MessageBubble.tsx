import { formatDateTime } from "@/lib/format";
import type { Autor } from "@/types/domain";

const AUTHOR_LABELS: Record<Autor, string> = {
  lead: "Lead",
  ia: "IA",
  humano: "Vendedor",
  sistema: "Sistema",
};

function rowSide(autor: Autor): "left" | "right" | "center" {
  if (autor === "lead") return "left";
  if (autor === "sistema") return "center";
  return "right";
}

type Props = {
  id: string;
  autor: Autor;
  mensagem: string;
  created_at: string;
};

export function MessageBubble({ autor, mensagem, created_at }: Props) {
  const side = rowSide(autor);

  return (
    <div className={`msg-row ${side}`}>
      <div className="msg-author">{AUTHOR_LABELS[autor]}</div>
      <div className={`msg-bubble ${autor}`}>{mensagem}</div>
      <div className="msg-time">{formatDateTime(created_at)}</div>
    </div>
  );
}
