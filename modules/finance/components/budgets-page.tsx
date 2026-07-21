"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, financialValueClass, formatCurrency, formatPercent } from "@/lib/utils";
import { expenseCategories } from "../data/defaults";
import { buildBudgetSummary } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { BudgetUsage } from "../types";

export function BudgetsPage() {
  const { state, actions } = useFinanceStore();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    category: "Alimentacao",
    limitAmount: "",
    notes: ""
  });
  const summary = useMemo(() => buildBudgetSummary(state, month), [state, month]);
  const availableMonths = useMemo(() => buildBudgetMonths(), []);

  function submitBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limitAmount = Number(form.limitAmount.replace(",", "."));

    if (!Number.isFinite(limitAmount) || limitAmount <= 0) {
      return;
    }

    actions.addBudget({
      month,
      category: form.category,
      limitAmount,
      notes: form.notes.trim() || undefined
    });
    setForm((current) => ({ ...current, limitAmount: "", notes: "" }));
  }

  return (
    <AppShell>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader
            eyebrow="Planejamento"
            title="Orcamentos mensais"
            action={<Badge tone={summary.exceededCount > 0 ? "warning" : "success"}>{summary.usages.length} limites</Badge>}
          />

          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <BudgetMetric label="Limite do mes" value={formatCurrency(summary.totalLimit)} />
            <BudgetMetric label="Gasto realizado" value={formatCurrency(summary.totalSpent)} />
            <BudgetMetric label="Saldo restante" value={formatCurrency(summary.remaining)} tone={summary.remaining >= 0 ? "good" : "bad"} />
            <BudgetMetric label="Consumo" value={formatPercent(summary.usedPercent)} tone={summary.usedPercent <= 80 ? "good" : "bad"} />
          </div>

          <form className="grid gap-3 rounded-xl border border-cream/10 bg-cream/[0.04] p-4" onSubmit={submitBudget}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Label>
                Mes
                <Select value={month} onChange={(event) => setMonth(event.target.value)}>
                  {availableMonths.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Categoria
                <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {expenseCategories
                    .filter((category) => !category.toLowerCase().includes("receita"))
                    .map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </Select>
              </Label>
              <Label>
                Limite
                <Input
                  inputMode="decimal"
                  value={form.limitAmount}
                  onChange={(event) => setForm((current) => ({ ...current, limitAmount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Button type="submit" className="md:mt-7">
                <Plus className="size-4" aria-hidden="true" />
                Salvar limite
              </Button>
            </div>
            <Label>
              Observacao
              <Input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ex: mercado, delivery e feira entram aqui"
              />
            </Label>
          </form>

          <div className="mt-5 grid gap-3">
            {summary.usages.length === 0 ? (
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-50">
                Ainda nao ha orcamentos para este mes. Comece pelas categorias que mais variam: alimentacao,
                lazer, transporte e tecnologia.
              </div>
            ) : (
              summary.usages.map((usage) => (
                <BudgetUsageCard key={usage.budget.id} usage={usage} onRemove={() => actions.removeBudget(usage.budget.id)} />
              ))
            )}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="MAYA observa" title="Alertas" />
            <div className="grid gap-3">
              {summary.exceededCount > 0 ? (
                <AlertCard
                  tone="danger"
                  title="Limite excedido"
                  text={`${summary.exceededCount} categoria(s) passaram do limite. Pause gastos variaveis nelas antes de novas compras.`}
                />
              ) : null}
              {summary.attentionCount > 0 ? (
                <AlertCard
                  tone="warning"
                  title="Perto do limite"
                  text={`${summary.attentionCount} categoria(s) ja consumiram mais de 80% do limite.`}
                />
              ) : null}
              {summary.usages.length > 0 && summary.exceededCount === 0 && summary.attentionCount === 0 ? (
                <AlertCard
                  tone="success"
                  title="Ritmo saudavel"
                  text="Os orcamentos do mes estao sob controle. Continue acompanhando antes de compras maiores."
                />
              ) : null}
              {summary.usages.length === 0 ? (
                <AlertCard
                  tone="neutral"
                  title="Sem limites ainda"
                  text="Cadastrar limites transforma a MAYA em uma assistente mais preventiva."
                />
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Metodo simples" title="Como usar" />
            <ol className="grid gap-3 text-sm leading-6 text-muted">
              <li>1. Escolha o mes que quer planejar.</li>
              <li>2. Defina limite para categorias que mais mudam.</li>
              <li>3. Cadastre despesas normalmente.</li>
              <li>4. Volte aqui para ver saldo restante e alertas.</li>
            </ol>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function BudgetMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-neon-cyan/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={cn("mt-2 block text-xl", financialValueClass(value, tone === "bad" ? "text-red-200" : tone === "good" ? "text-emerald-200" : "financial-positive"))}>
        {value}
      </strong>
    </div>
  );
}

function BudgetUsageCard({ usage, onRemove }: { usage: BudgetUsage; onRemove: () => void }) {
  const barColor =
    usage.status === "exceeded" ? "bg-terracotta" : usage.status === "attention" ? "bg-amber-300" : "bg-emerald-300";
  const tone = usage.status === "exceeded" ? "warning" : usage.status === "attention" ? "warning" : "success";

  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-lg text-cream">{usage.budget.category}</strong>
            <Badge tone={tone}>{usage.status === "exceeded" ? "Excedido" : usage.status === "attention" ? "Atencao" : "Saudavel"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatCurrency(usage.spent)} de {formatCurrency(usage.budget.limitAmount)} usados
          </p>
          {usage.budget.notes ? <p className="mt-2 text-sm leading-6 text-muted">{usage.budget.notes}</p> : null}
        </div>
        <Button variant="ghost" className="min-h-9 px-3" onClick={onRemove} aria-label={`Remover orcamento ${usage.budget.category}`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream/10">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(2, usage.usedPercent))}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">{formatPercent(usage.usedPercent)} consumido</span>
        <strong className={usage.remaining >= 0 ? "text-emerald-200" : "financial-negative"}>
          {usage.remaining >= 0 ? `${formatCurrency(usage.remaining)} restante` : `${formatCurrency(Math.abs(usage.remaining))} acima`}
        </strong>
      </div>
    </div>
  );
}

function AlertCard({ title, text, tone }: { title: string; text: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "neutral" ? WalletCards : AlertTriangle;
  const className =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
      : tone === "danger"
        ? "border-terracotta/30 bg-terracotta/10 text-orange-50"
        : tone === "warning"
          ? "border-amber-300/25 bg-amber-300/10 text-amber-50"
          : "border-cyan-300/20 bg-cyan-300/10 text-cyan-50";

  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2 font-black">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </div>
      <p className="text-sm leading-6 opacity-90">{text}</p>
    </div>
  );
}

function buildBudgetMonths() {
  const months = new Set<string>();
  const current = new Date();

  for (let index = -2; index <= 12; index += 1) {
    const date = new Date(current);
    date.setMonth(current.getMonth() + index);
    months.add(date.toISOString().slice(0, 7));
  }

  return Array.from(months).sort();
}
