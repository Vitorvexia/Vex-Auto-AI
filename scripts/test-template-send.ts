// ============================================================================
// Teste pontual de envio real de template WhatsApp (B006/0.2, critério 3)
//
// Chama sendWhatsAppTemplateMessage diretamente — mesma função usada em
// produção por lib/follow-up.ts/lib/reactivation.ts quando
// WHATSAPP_TEMPLATE_SEND_ENABLED=true. Não passa pela RPC de elegibilidade
// nem pelo job — não toca em lead real, não depende de estado do banco.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/test-template-send.ts \
//     --to +5532XXXXXXXXX --template follow_up_1 --params "Carlos"
//
// --params aceita múltiplos valores separados por vírgula, na ordem das
// variáveis {{1}}, {{2}}... do template. Omitir --params = template sem
// variáveis (array vazio).
//
// Requer .env.local com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// WHATSAPP_ACCESS_TOKEN apontando pras credenciais reais da loja.
// ============================================================================

import { supabaseAdmin } from "../lib/supabase";
import { getStoreWhatsAppPhoneId } from "../lib/whatsapp-credentials";
import { sendWhatsAppTemplateMessage } from "../lib/whatsapp-send";

const TEMPLATE_LANGUAGE = "pt_BR";

// E.164: '+' seguido de 8 a 15 dígitos (padrão ITU, mesma faixa usada por lib/phone.ts)
const E164_RE = /^\+[1-9]\d{7,14}$/;

interface Args {
  to: string;
  template: string;
  params: string[];
  store: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const to = get("--to");
  const template = get("--template");
  const paramsRaw = get("--params");
  const store = get("--store") ?? "speed";

  if (!to) throw new Error("--to é obrigatório (ex: --to +5532XXXXXXXXX)");
  if (!template) throw new Error("--template é obrigatório (ex: --template follow_up_1)");
  if (!E164_RE.test(to)) {
    throw new Error(
      `--to "${to}" não parece E.164 válido (esperado: '+' seguido de 8 a 15 dígitos, ex: +5532988887777). Confira antes de disparar — envio real, número errado manda mensagem real pra pessoa errada.`
    );
  }

  return {
    to,
    template,
    params: paramsRaw ? paramsRaw.split(",").map((p) => p.trim()) : [],
    store,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, nome")
    .ilike("nome", `%${args.store}%`)
    .single();

  if (error || !store) {
    throw new Error(`Store "${args.store}" não encontrada: ${error?.message ?? "sem resultado"}`);
  }

  console.log(`Store: ${store.nome} (${store.id})`);

  const phoneId = await getStoreWhatsAppPhoneId(store.id);
  console.log(`Phone Number ID: ${phoneId}`);
  console.log(
    `Enviando template "${args.template}" (${TEMPLATE_LANGUAGE}) params=${JSON.stringify(args.params)} para ${args.to}...`
  );

  await sendWhatsAppTemplateMessage(args.to, args.template, TEMPLATE_LANGUAGE, args.params, phoneId);

  console.log("OK — Meta aceitou o envio (HTTP 2xx). Confira o celular.");
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
