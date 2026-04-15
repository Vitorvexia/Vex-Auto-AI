"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="lm-grad" x1="0" y1="30" x2="30" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="30" height="30" rx="7" fill="url(#lm-grad)" />
      <path d="M6 22 L11 13 L16 17 L22 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 7 L22 7 L22 11" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24" y="4.5" width="2.2" height="2.2" fill="rgba(186,230,253,0.85)" rx="0.5" />
      <rect x="24" y="7.8" width="2.2" height="2.2" fill="rgba(186,230,253,0.5)" rx="0.5" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/leads" className="header-logo">
          <LogoMark />
          <span className="header-logo-text">
            Vex<span className="logo-auto">Auto</span>
          </span>
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
        </nav>
      </div>
    </header>
  );
}
