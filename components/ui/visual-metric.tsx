import { cn } from "@/lib/utils";
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
        "group rounded-card border border-cream/10 bg-cream/[0.045] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-bronze/40 hover:bg-cream/[0.07]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
          <strong className="mt-3 block font-serif text-3xl leading-none text-bronze">{value}</strong>
        </div>
        {icon ? (
          <div className="grid size-11 place-items-center rounded-xl border border-bronze/20 bg-bronze/10 text-bronze transition group-hover:scale-105">
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
