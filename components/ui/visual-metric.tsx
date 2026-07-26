import { cn, financialValueClass } from "@/lib/utils";
import { Badge } from "./badge";

export function VisualMetric({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  className
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ReactNode;
  tone?: "success" | "warning" | "info" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "neon-card group p-3 transition duration-300 hover:-translate-y-0.5 hover:border-neon-cyan/35 hover:bg-cream/[0.07] sm:p-4",
        className
      )}
    >
      <span className="neon-topline opacity-60 transition group-hover:opacity-100" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
          <strong className={cn("relative mt-2 block font-serif text-2xl leading-none sm:mt-3 sm:text-3xl", financialValueClass(value))}>{value}</strong>
        </div>
        {icon ? (
          <div className="relative grid size-10 place-items-center overflow-hidden rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-neon transition group-hover:scale-105 group-hover:border-bronze/40 group-hover:text-bronze sm:size-11">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 hidden text-sm leading-6 text-muted sm:block">{detail}</p> : null}
      <Badge tone={tone} className="mt-3 sm:mt-4">
        {tone === "success" ? "Saudavel" : tone === "warning" ? "Atencao" : tone === "info" ? "Analise" : "Resumo"}
      </Badge>
    </div>
  );
}
