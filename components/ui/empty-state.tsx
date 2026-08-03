import { Sparkles } from "lucide-react";
import { Button } from "./button";

export function EmptyState({
  title,
  text,
  actionLabel,
  onAction
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-card border border-cyan-300/20 bg-cyan-300/10 p-5 text-cyan-50">
      <div className="mb-3 grid size-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10">
        <Sparkles className="size-4" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-xl font-bold text-cyan-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-90">{text}</p>
      {actionLabel && onAction ? (
        <Button variant="ghost" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
