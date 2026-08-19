"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("redirectTo") ?? "/inicio";
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inicio";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Estado à parte de `loading` — cobre o intervalo entre o botão voltar ao
  // normal (regra já testada: nunca fica preso em "Entrando...") e a
  // próxima página de fato pintar. Nunca é resetado a false no sucesso:
  // o componente desmonta com a navegação, não precisa.
  const [navigating, setNavigating] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Configuração de autenticação ausente.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient(url, key);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      setNavigating(true);
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Fundo ofuscado — mostra só um recorte da imagem (lado da logo),
          desfocado o bastante pra virar textura ambiente, nunca foto legível. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-40px",
          backgroundImage: "url(/login-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "78% center",
          filter: "blur(6px) brightness(0.75)",
          transform: "scale(1.05)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(10,10,10,.25) 0%, rgba(10,10,10,.65) 70%)",
        }}
      />

      <form
        onSubmit={handleLogin}
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(17,17,17,0.92)",
          backdropFilter: "blur(6px)",
          border: "1px solid #222",
          borderRadius: "12px",
          padding: "40px",
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Image
            src="/logo-vex-auto.png"
            alt="Vex Auto"
            width={72}
            height={72}
            style={{
              display: "block",
              borderRadius: "50%",
              marginBottom: "12px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.14), 0 0 20px rgba(0,91,254,0.25)",
            }}
          />
          <div style={{ fontSize: "13px", color: "#666" }}>
            Acesse sua conta
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", color: "#888", fontWeight: 600 }}>
            E-MAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "10px 12px",
              color: "#fff",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", color: "#888", fontWeight: 600 }}>
            SENHA
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "10px 40px 10px 12px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                width: "100%",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#888",
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "#f87171",
              fontSize: "13px",
              background: "#1c0a0a",
              border: "1px solid #3b1010",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? "#333" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: "4px",
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {navigating && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            background: "rgba(10,10,10,0.75)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.18)",
              borderTopColor: "#2563eb",
              animation: "vex-login-spin 0.7s linear infinite",
            }}
          />
          <div style={{ fontSize: "13px", color: "#aaa" }}>Entrando…</div>
        </div>
      )}
      <style>{`@keyframes vex-login-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
