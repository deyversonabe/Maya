"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, Bot, CalendarDays, Database, Home, ReceiptText, Target, WalletCards } from "lucide-react";
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
  { href: "/maya", label: "MAYA", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-container pb-28 md:pb-8">
      <div className="sticky top-3 z-30 mb-4 flex flex-col gap-4 rounded-card border border-bronze/20 bg-moss-950/80 p-3 shadow-soft backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
                  className="group flex min-h-16 items-center justify-center rounded-xl border border-bronze/10 bg-gradient-to-br from-cream/[0.07] to-bronze/[0.05] px-3 py-2 transition hover:border-bronze/40 hover:bg-bronze/10 focus:outline-none focus:ring-4 focus:ring-bronze/25"
          aria-label="Voltar para o inicio"
          title="Voltar para o inicio"
        >
          <Image
            src="/brand/juntos-maya-logo.png"
            alt="Juntos Maya"
            width={180}
            height={180}
            priority
                                  className="h-36 w-60 object-contain drop-shadow-[0_0_18px_rgba(196,106,67,0.35)] transition group-hover:scale-[1.03]"
          />
        </Link>

        <nav className="hidden gap-2 md:grid md:grid-cols-4 xl:grid-cols-9" aria-label="Navegacao principal">
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
                    ? "border-bronze/50 bg-bronze/15 text-bronze shadow-lg shadow-bronze/10"
                    : "border-cream/10 bg-cream/[0.04] text-muted hover:border-bronze/30 hover:text-bronze"
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

      <nav className="fixed inset-x-2 bottom-3 z-40 grid grid-cols-8 gap-1 rounded-2xl border border-bronze/20 bg-moss-950/92 p-2 shadow-soft backdrop-blur-2xl md:hidden" aria-label="Navegacao mobile">
        {navItems
          .filter((item) => ["/", "/months", "/expenses", "/bills", "/budgets", "/goals", "/data", "/maya"].includes(item.href))
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
                    ? "border-bronze/40 bg-bronze/15 text-bronze"
                    : "border-transparent text-muted hover:bg-cream/[0.05] hover:text-bronze"
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

  return label;
}

