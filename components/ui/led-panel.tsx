import { cn } from "@/lib/utils";

export function LedPanel({
  children,
  className,
  glow = "bronze"
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "bronze" | "cyan" | "none";
}) {
  return (
    <section
      className={cn(
        "led-panel relative overflow-hidden rounded-card border border-cyan-200/15 bg-moss-950/75 shadow-neon backdrop-blur-xl",
        glow === "bronze" && "before:absolute before:inset-x-8 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-bronze before:to-transparent before:shadow-[0_0_20px_rgba(184,121,69,0.55)]",
        glow === "cyan" && "before:absolute before:inset-x-8 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-neon-cyan before:to-transparent before:shadow-[0_0_22px_rgba(85,247,255,0.55)]",
        className
      )}
    >
      <div className="absolute inset-0 animate-maya-grid opacity-25 [background-image:linear-gradient(rgba(85,247,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(184,121,69,.14)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neon-pink/50 to-transparent" aria-hidden="true" />
      <div className="relative">{children}</div>
    </section>
  );
}
