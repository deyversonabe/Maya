import Link from "next/link";
import { Landmark } from "lucide-react";
import { HomeScreen } from "@/modules/finance/components/home-screen";

export default function HomePage() {
  return (
    <>
      <HomeScreen />
      <Link
        href="/income"
        className="fixed bottom-24 right-4 z-40 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-neon-cyan/35 bg-moss-950/90 px-4 text-sm font-black text-cyan-50 shadow-[0_0_28px_rgba(85,247,255,0.18)] backdrop-blur transition hover:border-bronze hover:text-bronze md:bottom-6"
      >
        <Landmark className="size-4" aria-hidden="true" />
        Receitas e extrato
      </Link>
    </>
  );
}
