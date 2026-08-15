"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, Bot, CalendarDays, Clock3, Database, FileText, Home, Landmark, LogOut, Menu, ReceiptText, Scissors, ShieldCheck, Target, WalletCards, X } from "lucide-react";
import { useMayaAdminAccess } from "@/lib/auth/use-maya-admin-access";
import { cn } from "@/lib/utils";
import { SyncStatusBanner } from "./sync-status-banner";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/income", label: "Receitas", icon: Landmark },
  { href: "/salon", label: "Salao", icon: Scissors },
  { href: "/months", label: "Meses", icon: CalendarDays },
  { href: "/expenses", label: "Despesas", icon: ReceiptText },
  { href: "/bills", label: "Contas", icon: BellRing },
  { href: "/budgets", label: "Orcamentos", icon: WalletCards },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/fiscal", label: "Fiscal", icon: FileText },
  { href: "/hours", label: "Horas", icon: Clock3 },
  { href: "/data", label: "Dados", icon: Database, adminOnly: true },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { href: "/maya", label: "MAYA", icon: Bot }
];

const mobilePrimaryHrefs = ["/", "/income", "/expenses", "/bills", "/maya"];
const mobileMenuHrefs = ["/dashboard", "/salon", "/months", "/budgets", "/goals", "/fiscal", "/hours", "/data", "/admin"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { email, isAdmin, signOut } = useMayaAdminAccess();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );
  const activeItem = visibleNavItems.find((item) => isActivePath(pathname, item.href)) ?? navItems[0];
  const mobilePrimaryItems = visibleNavItems.filter((item) => mobilePrimaryHrefs.includes(item.href));
  const mobileMenuItems = visibleNavItems.filter((item) => mobileMenuHrefs.includes(item.href));

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <main className="app-container pb-[calc(6.7rem+env(safe-area-inset-bottom))] md:pb-8">
      <SyncStatusBanner />
      <header className="glass-panel sticky top-[calc(0.5rem+env(safe-area-inset-top))] z-40 mb-3 flex items-center justify-between gap-3 rounded-2xl p-2 backdrop-blur-2xl md:hidden">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-neon-cyan/10 focus:outline-none focus:ring-4 focus:ring-neon-cyan/25"
          aria-label="Voltar para o inicio"
          title="Voltar para o inicio"
        >
          <Image
            src="/brand/maya-logo.png"
            alt="Maya"
            width={80}
            height={80}
            priority
            className="size-10 rounded-full object-cover object-top drop-shadow-[0_0_18px_rgba(85,247,255,0.2)]"
          />
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase text-muted">Maya</span>
            <strong className="block truncate font-serif text-xl leading-none text-bronze">{activeItem.label}</strong>
          </span>
        </Link>

        <button
          type="button"
          className="grid size-12 shrink-0 place-items-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-cyan-100 shadow-neon transition hover:border-bronze/50 hover:text-bronze focus:outline-none focus:ring-4 focus:ring-neon-cyan/25"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="glass-panel sticky top-3 z-30 mb-4 hidden flex-col gap-4 rounded-card p-3 backdrop-blur-2xl md:flex lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
          className="group flex min-h-16 items-center justify-center rounded-xl border border-neon-cyan/15 bg-gradient-to-br from-cream/[0.07] via-neon-cyan/[0.04] to-bronze/[0.08] px-3 py-2 transition hover:border-neon-cyan/45 hover:bg-neon-cyan/10 focus:outline-none focus:ring-4 focus:ring-neon-cyan/25"
          aria-label="Voltar para o inicio"
          title="Voltar para o inicio"
        >
          <Image
            src="/brand/maya-logo.png"
            alt="Maya"
            width={180}
            height={180}
            priority
            className="h-16 w-16 rounded-full object-cover drop-shadow-[0_0_20px_rgba(85,247,255,0.24)] transition group-hover:scale-[1.03] group-hover:drop-shadow-[0_0_24px_rgba(196,106,67,0.45)]"
          />
          <span className="ml-3 font-serif text-3xl font-bold text-bronze drop-shadow-[0_0_18px_rgba(184,121,69,0.26)]">Maya</span>
        </Link>

        <nav className="hidden gap-2 md:grid md:grid-cols-5 xl:grid-cols-[repeat(14,minmax(0,1fr))]" aria-label="Navegacao principal">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition",
                  active
                    ? "border-neon-cyan/45 bg-neon-cyan/15 text-cyan-100 shadow-neon"
                    : "border-cream/10 bg-cream/[0.04] text-muted hover:border-neon-cyan/30 hover:bg-neon-cyan/10 hover:text-cyan-100"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {email ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cream/10 bg-cream/[0.04] px-3 text-sm font-black text-muted transition hover:border-alert-red/40 hover:bg-alert-red/10 hover:text-red-100 focus:outline-none focus:ring-4 focus:ring-alert-red/20"
            onClick={() => void signOut()}
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        ) : null}
      </div>

      {children}

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-moss-950/82 px-3 pt-[calc(4.9rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu do aplicativo"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="glass-panel max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-2xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-muted">Menu</p>
                <h2 className="font-serif text-2xl font-bold text-bronze">Outras areas</h2>
              </div>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-xl border border-cream/10 bg-cream/[0.04] text-muted transition hover:border-neon-cyan/35 hover:text-cyan-100 focus:outline-none focus:ring-4 focus:ring-neon-cyan/25"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {mobileMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-xl border px-3 text-sm font-black transition",
                      active
                        ? "border-neon-cyan/45 bg-neon-cyan/15 text-cyan-100 shadow-neon"
                        : "border-cream/10 bg-cream/[0.04] text-muted hover:border-neon-cyan/35 hover:bg-neon-cyan/10 hover:text-cyan-100"
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{getMenuLabel(item.label)}</span>
                  </Link>
                );
              })}
            </div>

            {email ? (
              <div className="mt-4 rounded-xl border border-cream/10 bg-cream/[0.04] p-3">
                <p className="truncate text-xs font-bold text-muted">{email}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-alert-red/35 bg-alert-red/10 px-3 text-sm font-black text-red-100 transition hover:bg-alert-red/15 focus:outline-none focus:ring-4 focus:ring-alert-red/20"
                  onClick={() => void signOut()}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-[1.35rem] border border-neon-cyan/20 bg-moss-950/94 px-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5 shadow-neon backdrop-blur-2xl md:hidden"
        aria-label="Navegacao mobile"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid min-h-14 place-items-center rounded-2xl border px-1 text-[0.68rem] font-black transition",
                active
                  ? "border-neon-cyan/45 bg-neon-cyan/15 text-cyan-100 shadow-[0_0_18px_rgba(85,247,255,0.16)]"
                  : "border-transparent text-muted hover:bg-neon-cyan/10 hover:text-cyan-100"
              )}
            >
              <Icon className="mb-1 size-5" aria-hidden="true" />
              <span>{getMobileLabel(item.label)}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function getMobileLabel(label: string) {
  if (label === "Despesas") {
    return "Despesa";
  }

  if (label === "Receitas") {
    return "Extrato";
  }

  return label;
}

function getMenuLabel(label: string) {
  if (label === "Orcamentos") {
    return "Orcamentos";
  }

  return label;
}
