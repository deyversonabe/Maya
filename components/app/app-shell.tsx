"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, Bot, CalendarDays, Database, Home, ReceiptText, ShieldCheck, Target, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/months", label: "Meses", icon: CalendarDays },
  { href: "/expenses", label: "Despesas", icon: ReceiptText },
  { href: "/bills", label: "Contas", icon: BellRing },
  { href: "/budgets", label: "Orcamentos", icon: WalletCards },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/data", label: "Dados", icon: Database },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/maya", label: "MAYA", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-container pb-28 md:pb-8">
      <div className="glass-panel sticky top-3 z-30 mb-4 flex flex-col gap-4 rounded-card p-3 backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
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

        <nav className="hidden gap-2 md:grid md:grid-cols-5 xl:grid-cols-10" aria-label="Navegacao principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

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
      </div>

      {children}

      <Link
        href="/expenses"
        className="fixed bottom-[5.8rem] right-4 z-40 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-terracotta/70 bg-gradient-to-br from-terracotta via-bronze to-[#7d3d2b] px-4 text-xs font-black text-cream shadow-neon md:hidden"
        aria-label="Nova despesa"
      >
        <ReceiptText className="size-4" aria-hidden="true" />
        Nova despesa
      </Link>

      <nav className="fixed inset-x-2 bottom-3 z-40 grid grid-cols-9 gap-1 rounded-2xl border border-neon-cyan/20 bg-moss-950/92 p-2 shadow-neon backdrop-blur-2xl md:hidden" aria-label="Navegacao mobile">
        {navItems
          .filter((item) => ["/", "/months", "/expenses", "/bills", "/budgets", "/goals", "/data", "/admin", "/maya"].includes(item.href))
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "grid min-h-14 place-items-center rounded-xl border px-1 text-[0.62rem] font-black transition",
                  active
                    ? "border-neon-cyan/40 bg-neon-cyan/15 text-cyan-100"
                    : "border-transparent text-muted hover:bg-neon-cyan/10 hover:text-cyan-100"
                )}
              >
                <Icon className="mb-1 size-4" aria-hidden="true" />
                <span>{getMobileLabel(item.label)}</span>
              </Link>
            );
          })}
      </nav>
    </main>
  );
}

function getMobileLabel(label: string) {
  if (label === "Orcamentos") {
    return "Orc.";
  }

  if (label === "Despesas") {
    return "Desp.";
  }

  if (label === "Admin") {
    return "Adm.";
  }

  return label;
}
