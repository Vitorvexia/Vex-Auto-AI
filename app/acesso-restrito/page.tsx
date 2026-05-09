import Link from "next/link";

export default function AcessoRestritoPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Acesso Restrito</h1>
      <p style={{ color: "#666", maxWidth: "360px" }}>
        Esta área é restrita à equipe Vex. Se você chegou aqui por engano,
        acesse o sistema normalmente.
      </p>
      <Link
        href="/leads"
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.5rem",
          background: "#111",
          color: "#fff",
          borderRadius: "6px",
          textDecoration: "none",
          fontSize: "0.9rem",
        }}
      >
        Voltar ao sistema
      </Link>
    </main>
  );
}
