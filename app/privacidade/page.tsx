// Parâmetros da política — trocar aqui quando a loja confirmar o e-mail de contato.
const CONTATO_EMAIL = "privacidade@speedmotos.com.br";
const RETENCAO_MESES = 24;

export const metadata = {
  title: "Política de Privacidade — Vex Auto",
};

export default function PrivacidadePage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="container" style={{ maxWidth: "760px" }}>
        <h1
          style={{
            fontFamily: "var(--font-barlow), var(--font-exo2), sans-serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "28px",
            color: "var(--text-strong)",
            marginBottom: "6px",
          }}
        >
          Política de Privacidade
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "36px" }}>
          Última atualização: julho de 2026
        </p>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            1. Quem trata os seus dados
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            A loja com quem você está conversando é a controladora dos seus dados
            pessoais, nos termos da LGPD (Lei nº 13.709/2018) — é dela o número de
            WhatsApp, o CNPJ e a decisão sobre as finalidades do tratamento. O Vex
            Auto atua como operador: trata os dados em nome da loja, seguindo as
            instruções dela, e não usa suas informações para finalidade própria.
          </p>
        </section>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            2. Atendimento com inteligência artificial
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            Parte do atendimento é feita por um assistente automatizado. Você é
            avisado logo no início da conversa de que está falando com uma IA e
            pode pedir para falar com um atendente humano a qualquer momento.
            Decisões de negociação, preço e fechamento de venda são sempre
            validadas por uma pessoa — a IA nunca fecha uma venda sozinha.
          </p>
        </section>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            3. Quais dados coletamos
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            Nome, telefone/WhatsApp, o conteúdo das mensagens trocadas e os dados
            que você mesmo informa sobre veículo de interesse ou moto de troca
            (modelo, ano, quilometragem). A IA não pede dado sensível durante o
            atendimento. Se em alguma etapa for necessário CPF (por exemplo, para
            simulação de financiamento), a coleta é conduzida por um atendente
            humano, com sua ciência.
          </p>
        </section>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            4. Para que usamos seus dados
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            Para responder seu atendimento, apresentar veículos disponíveis e
            retomar contato quando uma conversa fica em aberto. Não vendemos nem
            compartilhamos seus dados com terceiros para fins de publicidade.
          </p>
        </section>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            5. Por quanto tempo guardamos
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            Seus dados ficam armazenados durante o atendimento e por até{" "}
            {RETENCAO_MESES} meses após o último contato. Depois desse prazo, são
            excluídos ou anonimizados, exceto quando a lei exigir um prazo de
            guarda maior.
          </p>
        </section>

        <section style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 800,
              fontStyle: "italic",
              color: "var(--text-strong)",
              marginBottom: "8px",
            }}
          >
            6. Seus direitos (LGPD)
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text)" }}>
            Você pode solicitar acesso, correção ou exclusão dos seus dados, além
            de pedir esclarecimento sobre com quem eles são compartilhados. Fale
            com a loja pelo próprio WhatsApp ou entre em contato por{" "}
            <a href={`mailto:${CONTATO_EMAIL}`} style={{ color: "var(--accent)", textDecoration: "underline" }}>
              {CONTATO_EMAIL}
            </a>
            .
          </p>
        </section>

        <p
          style={{
            fontSize: "12px",
            color: "var(--muted)",
            borderTop: "1px solid var(--border)",
            paddingTop: "16px",
            lineHeight: 1.6,
          }}
        >
          Este atendimento é operado pela plataforma Vex Auto em nome da loja,
          que é a responsável pelo tratamento dos seus dados pessoais.
        </p>
      </div>
    </main>
  );
}
