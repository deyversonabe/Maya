import { cn } from "@/lib/utils";

type BadgeTone = "success" | "warning" | "info" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-300/40 bg-amber-400/10 text-amber-200",
  info: "border-cyan-300/40 bg-cyan-400/10 text-cyan-200",
  neutral: "border-bronze/40 bg-bronze/10 text-bronze"
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
