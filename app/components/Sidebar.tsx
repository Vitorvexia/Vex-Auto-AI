"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconFunnel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16l-6.5 7.5v6L10.5 20v-7.5z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.8a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3a8.4 8.4 0 0 1 8.4 8.4z" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.5 9.4 8 11 4.5-1.6 8-6 8-11V5z" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V11" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-4" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      <circle cx="12" cy="12" r="3" />
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
function IconSun() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

const THEME_STORAGE_KEY = "vex-theme";
const SIDEBAR_STORAGE_KEY = "vex-sidebar";
type Theme = "dark" | "light";

function IconPanelToggle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/inicio", label: "Início", icon: IconHome, match: (p: string) => p === "/inicio" || p === "/" },
  { href: "/leads", label: "Leads", icon: IconFunnel, match: (p: string) => p.startsWith("/leads") },
  { href: "/conversations", label: "WhatsApp", icon: IconChat, match: (p: string) => p.startsWith("/conversations") },
  { href: "/estoque", label: "Estoque", icon: IconBox, match: (p: string) => p.startsWith("/estoque") },
  { href: "/equipe", label: "Equipe", icon: IconUsers, match: (p: string) => p.startsWith("/equipe") },
  { href: "/renave", label: "RENAVE", icon: IconShield, match: (p: string) => p.startsWith("/renave") },
  { href: "/agenda", label: "Agenda", icon: IconCalendar, match: (p: string) => p.startsWith("/agenda") },
  { href: "/analytics", label: "Analytics", icon: IconChart, match: (p: string) => p.startsWith("/analytics") },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  // Default "light" no primeiro render, casando com o default real
  // (DL-0016) — o script bloqueante em app/layout.tsx já aplicou o
  // atributo verdadeiro no <html> antes do paint, este estado só
  // precisa sincronizar no mount pra o ícone/label do toggle não
  // ficarem errados por um frame.
  const [theme, setTheme] = useState<Theme>("light");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    setCollapsed(document.documentElement.getAttribute("data-sidebar") === "collapsed");
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage indisponível (modo privado/bloqueio) — preferência só
      // dura a sessão atual, sem quebrar o toggle em si.
    }
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) {
      document.documentElement.setAttribute("data-sidebar", "collapsed");
    } else {
      document.documentElement.removeAttribute("data-sidebar");
    }
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // idem — sem localStorage, preferência não sobrevive a reload
    }
  }

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
  }

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

  // Wizard de onboarding (BL-0026) roda em tela cheia, sem nav do app —
  // dono_loja com onboarding pendente nunca deveria ver as outras seções
  // mesmo antes de terminar o setup.
  if (pathname === "/onboarding") return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/leads" className="sidebar-logo" aria-label="VexAuto — início">
          <Image
            src="/favicon.png"
            alt="VexAuto"
            width={28}
            height={28}
            style={{ display: "block", flexShrink: 0, objectFit: "cover", borderRadius: "50%" }}
          />
        </Link>
        <button
          className="sidebar-toggle-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
          aria-expanded={!collapsed}
        >
          <IconPanelToggle />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-nav-link${match(pathname) ? " active" : ""}`}
          >
            <span className="sidebar-nav-icon"><Icon /></span>
            <span className="sidebar-nav-label">{label}</span>
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={`sidebar-nav-link${pathname.startsWith("/admin") ? " active" : ""}`}
          >
            <span className="sidebar-nav-icon"><IconGear /></span>
            <span className="sidebar-nav-label">Admin</span>
          </Link>
        )}
      </nav>

      <div className="sidebar-footer" ref={dropRef}>
        <button
          className={`sidebar-user-btn${dropOpen ? " open" : ""}`}
          onClick={() => setDropOpen((v) => !v)}
          aria-label="Menu do usuário"
          aria-expanded={dropOpen}
        >
          <IconUser />
          <span className="sidebar-nav-label">Conta</span>
        </button>
        {dropOpen && (
          <div className="sidebar-dropdown" role="menu">
            <button
              className="sidebar-dropdown-item"
              onClick={() => { toggleTheme(); setDropOpen(false); }}
            >
              {theme === "light" ? <IconMoon /> : <IconSun />}
              {theme === "light" ? "Tema escuro" : "Tema claro"}
            </button>
            <div className="sidebar-dropdown-sep" />
            <Link href="/configuracoes" className="sidebar-dropdown-item" onClick={() => setDropOpen(false)}>
              <IconSettings /> Configurações
            </Link>
            <a href="mailto:suporte@vexauto.com.br" className="sidebar-dropdown-item" onClick={() => setDropOpen(false)}>
              <IconMail /> Contato
            </a>
            <div className="sidebar-dropdown-sep" />
            <button
              className="sidebar-dropdown-item danger"
              onClick={() => { setDropOpen(false); handleLogout(); }}
            >
              <IconLogout /> Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
