export const metadata = {
  title: "Política de Privacidade — Vex Auto",
};

export default function PrivacidadePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        padding: "48px 24px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <article style={{ maxWidth: "680px", width: "100%" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          Política de Privacidade — Vex Auto
        </h1>
        <p style={{ fontSize: "13px", color: "#888", marginBottom: "32px" }}>
          Última atualização: julho de 2026
        </p>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            1. Sobre este documento
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            O Vex Auto é uma plataforma de atendimento e vendas para revendas automotivas,
            que utiliza inteligência artificial para atender leads via WhatsApp em nome da
            loja parceira contratante. Esta política descreve como os dados de leads e clientes
            são coletados, usados e protegidos nesse fluxo.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            2. Dados coletados
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            Nome, número de telefone, mensagens trocadas via WhatsApp, veículo de interesse
            e histórico de interações com a loja. Esses dados são fornecidos diretamente pelo
            lead ao iniciar contato pelo WhatsApp da loja.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            3. Uso dos dados
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            Os dados são usados exclusivamente para viabilizar o atendimento automatizado
            (respostas via IA), follow-up e reativação comercial da loja parceira. Não são
            vendidos ou compartilhados com terceiros para fins de marketing externo.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            4. Compartilhamento com terceiros
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            As mensagens trafegam pela WhatsApp Business Platform (Meta) para envio e recebimento.
            O conteúdo das conversas é processado por modelos de linguagem de terceiros
            (Anthropic) para gerar respostas automatizadas. Nenhum dado é usado para treinar
            modelos de terceiros.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            5. Retenção e exclusão
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            Dados são mantidos enquanto durar o relacionamento comercial entre o lead e a loja.
            Solicitações de exclusão podem ser feitas diretamente à loja de origem da conversa.
          </p>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            6. LGPD
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            Tratamos os dados em conformidade com a Lei Geral de Proteção de Dados (Lei nº
            13.709/2018). Telefones e identificadores pessoais são mascarados em logs internos
            do sistema.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            7. Contato
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#ccc" }}>
            Dúvidas sobre esta política podem ser direcionadas à loja com quem você está
            conversando, ou diretamente à equipe do Vex Auto.
          </p>
        </section>
      </article>
    </main>
  );
}
