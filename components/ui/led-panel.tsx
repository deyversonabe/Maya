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
        "relative overflow-hidden rounded-card border border-bronze/20 bg-moss-950/75 shadow-soft backdrop-blur-xl",
        glow === "bronze" && "before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-bronze before:to-transparent",
        glow === "cyan" && "before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-cyan-300 before:to-transparent",
        className
      )}
    >
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(184,121,69,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(73,198,192,.10)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative">{children}</div>
    </section>
  );
}
