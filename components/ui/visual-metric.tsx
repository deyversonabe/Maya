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
        "neon-card group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-neon-cyan/35 hover:bg-cream/[0.07]",
        className
      )}
    >
      <span className="neon-topline opacity-60 transition group-hover:opacity-100" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
          <strong className={cn("relative mt-3 block font-serif text-3xl leading-none", financialValueClass(value))}>{value}</strong>
        </div>
        {icon ? (
          <div className="relative grid size-11 place-items-center overflow-hidden rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-neon transition group-hover:scale-105 group-hover:border-bronze/40 group-hover:text-bronze">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 text-sm leading-6 text-muted">{detail}</p> : null}
      <Badge tone={tone} className="mt-4">
        {tone === "success" ? "Saudavel" : tone === "warning" ? "Atencao" : tone === "info" ? "Analise" : "Resumo"}
      </Badge>
    </div>
  );
}
