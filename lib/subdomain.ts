// Resolução de loja por subdomínio (roadmap 1.3) — função pura, sem I/O.
//
// Domínio único do Vex, wildcard DNS *.dominio → Vercel (nota técnica do
// roadmap, 53_ROADMAP.md Fase 1). Só 1 nível de subdomínio é suportado por
// decisão consciente — nível extra (a.b.dominio) retorna null e cai no fluxo
// normal do app autenticado, nunca tenta adivinhar qual segmento é o slug.

export const DEFAULT_APP_ROOT_DOMAIN = "vexauto.com.br";

// "app" é reservado porque é onde o app autenticado roda de verdade em
// produção (app.vexauto.com.br, não o apex) — sem essa exclusão, TODA
// request ao app real seria tratada como se "app" fosse slug de loja e
// reescrita pra /site/app/..., quebrando a autenticação inteira. "www"
// reservado pelo motivo simétrico (redirect/apex convencional).
const RESERVED_SUBDOMAINS = new Set(["www", "app"]);

interface ExtractOptions {
  /** Fallback pra dev local quando o host é "localhost"/"127.0.0.1" puro (sem subdomínio real). */
  queryLoja?: string | null;
  rootDomain?: string;
}

function normalizeSlugCandidate(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function stripPort(host: string): string {
  return host.split(":")[0];
}

export function extractStoreSlugFromHost(
  host: string | null | undefined,
  options: ExtractOptions = {}
): string | null {
  const rootDomain = (options.rootDomain ?? DEFAULT_APP_ROOT_DOMAIN).toLowerCase();
  const devFallback = normalizeSlugCandidate(options.queryLoja);

  if (!host) return devFallback;

  const hostname = stripPort(host).toLowerCase();

  // localhost/127.0.0.1 puro (sem subdomínio) — único caso onde o query
  // param de dev entra em jogo, porque não há subdomínio real pra ler.
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return devFallback;
  }

  // Subdomínio direto em localhost (ex: speedmotos.localhost) — funciona sem
  // configuração extra na maioria dos browsers/SOs modernos (RFC 6761),
  // preferível ao query param quando disponível.
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    if (!sub || RESERVED_SUBDOMAINS.has(sub)) return devFallback;
    return sub;
  }

  if (hostname === rootDomain) {
    return null;
  }

  if (hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, hostname.length - rootDomain.length - 1);
    if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
    return sub;
  }

  // Domínio desconhecido (preview da Vercel, outro host qualquer) — nunca
  // tratado como subdomínio de loja. Cai no fluxo normal do app autenticado.
  return null;
}
