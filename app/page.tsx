import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Vex Auto</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
        Sistema operacional.
      </p>
      <Link href="/leads" className="pill">
        → Painel de leads
      </Link>
    </main>
  );
}
