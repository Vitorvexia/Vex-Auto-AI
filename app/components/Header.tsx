"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Header({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/leads" className="header-logo" aria-label="VexAuto — início">
          <Image src="/favicon.png" alt="VexAuto" width={34} height={34} style={{ display: "block", flexShrink: 0 }} />
        </Link>

        <nav className="header-nav">
          <Link
            href="/inicio"
            className={`header-nav-link${pathname === "/inicio" || pathname === "/" ? " active" : ""}`}
          >
            Início
          </Link>
          <Link
            href="/leads"
            className={`header-nav-link${pathname.startsWith("/leads") ? " active" : ""}`}
          >
            Leads
          </Link>
          <Link
            href="/conversations"
            className={`header-nav-link${pathname.startsWith("/conversations") ? " active" : ""}`}
          >
            WhatsApp
          </Link>
          <Link
            href="/estoque"
            className={`header-nav-link${pathname.startsWith("/estoque") ? " active" : ""}`}
          >
            Estoque
          </Link>
          <Link
            href="/equipe"
            className={`header-nav-link${pathname.startsWith("/equipe") ? " active" : ""}`}
          >
            Equipe
          </Link>
          <Link
            href="/analytics"
            className={`header-nav-link${pathname.startsWith("/analytics") ? " active" : ""}`}
          >
            Analytics
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className={`header-nav-link${pathname.startsWith("/admin") ? " active" : ""}`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="header-user-wrap" ref={dropRef}>
          <button
            className={`header-user-btn${dropOpen ? " open" : ""}`}
            onClick={() => setDropOpen((v) => !v)}
            aria-label="Menu do usuário"
            aria-expanded={dropOpen}
          >
            <IconUser />
          </button>
          {dropOpen && (
            <div className="header-dropdown" role="menu">
              <Link href="/configuracoes" className="header-dropdown-item" onClick={() => setDropOpen(false)}>
                <IconSettings /> Configurações
              </Link>
              <a href="mailto:suporte@vexauto.com.br" className="header-dropdown-item" onClick={() => setDropOpen(false)}>
                <IconMail /> Contato
              </a>
              <div className="header-dropdown-sep" />
              <button className="header-dropdown-item danger" onClick={() => setDropOpen(false)}>
                <IconLogout /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
