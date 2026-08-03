import { cn } from "@/lib/utils";

type BadgeTone = "success" | "warning" | "info" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "border-neon-green/40 bg-neon-green/10 text-emerald-100 shadow-[0_0_18px_rgba(114,255,182,0.12)]",
  warning: "border-neon-amber/45 bg-neon-amber/10 text-amber-100 shadow-[0_0_18px_rgba(255,210,122,0.12)]",
  info: "border-neon-cyan/45 bg-neon-cyan/10 text-cyan-100 shadow-[0_0_18px_rgba(85,247,255,0.12)]",
  neutral: "border-bronze/45 bg-bronze/10 text-bronze shadow-[0_0_18px_rgba(184,121,69,0.12)]"
};

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
