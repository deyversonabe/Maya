import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { financialValueClass, formatCurrency } from "@/lib/utils";
import type { FinancialDocumentItem } from "../types";

export function DocumentItemsPanel({
  items,
  title = "Itens do anexo",
  limit = 12
}: {
  items?: FinancialDocumentItem[];
  title?: string;
  limit?: number;
}) {
  if (!items?.length) {
    return null;
  }

  const visibleItems = items.slice(0, limit);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <details className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-black text-cyan-50">
        <FileText className="size-4" aria-hidden="true" />
        {title}
        <Badge tone="info">{items.length}</Badge>
      </summary>
      <div className="mt-3 grid gap-2">
        {visibleItems.map((item, index) => (
          <div
            key={`${item.name}_${item.date ?? "sem-data"}_${index}`}
            className="grid gap-1 rounded-lg border border-cyan-200/20 bg-moss-950/35 p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span className="min-w-0 text-cyan-50">
              {item.date ? `${item.date} - ` : ""}
              {item.name}
              {item.category ? ` - ${item.category}` : ""}
              {item.paymentMethod === "pix" && item.paymentRecipient ? ` - Pix: ${item.paymentRecipient}` : ""}
            </span>
            <strong className={typeof item.amount === "number" ? financialValueClass(item.amount) : "text-bronze"}>
              {typeof item.amount === "number" ? formatCurrency(item.amount) : "valor nao lido"}
            </strong>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <p className="rounded-lg border border-cream/10 bg-cream/[0.04] p-3 text-sm text-muted">
            Mais {hiddenCount} item(ns) guardados neste anexo.
          </p>
        ) : null}
      </div>
    </details>
  );
}
