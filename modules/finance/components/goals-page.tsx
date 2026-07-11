"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { formatCurrency, toInputDate } from "@/lib/utils";
import { getGoalProgress } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { GoalPriority, GoalType } from "../types";

const goalTypes: Array<{ value: GoalType; label: string }> = [
  { value: "reserve", label: "Reserva" },
  { value: "travel", label: "Viagem" },
  { value: "asset", label: "Patrimonio" },
  { value: "retirement", label: "Aposentadoria" },
  { value: "dream", label: "Sonho" }
];

const priorities: Array<{ value: GoalPriority; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" }
];

export function GoalsPage() {
  const { state, actions } = useFinanceStore();
  const [feedback, setFeedback] = useState("Cadastre metas reais do casal para acompanhar progresso.");
  const [form, setForm] = useState({
    name: "",
    type: "reserve" as GoalType,
    targetAmount: "",
    currentAmount: "",
    dueDate: toInputDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)),
    priority: "medium" as GoalPriority
  });

  const totals = useMemo(() => {
    const target = state.goals.reduce((total, goal) => total + goal.targetAmount, 0);
    const current = state.goals.reduce((total, goal) => total + goal.currentAmount, 0);
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;

    return { target, current, progress };
  }, [state.goals]);

  function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = Number(form.targetAmount.replace(",", "."));
    const currentAmount = Number(form.currentAmount.replace(",", ".") || 0);

    if (!form.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFeedback("Preencha nome e valor alvo valido para salvar a meta.");
      return;
    }

    actions.addGoal({
      name: form.name.trim(),
      type: form.type,
      targetAmount,
      currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
      dueDate: form.dueDate,
      priority: form.priority
    });

    setForm((current) => ({
      ...current,
      name: "",
      targetAmount: "",
      currentAmount: ""
    }));
    setFeedback("Meta salva. A MAYA ja pode considerar esse objetivo nas proximas leituras.");
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="bronze">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="min-w-0">
            <p className="eyebrow">Metas do casal</p>
            <h1 className="mt-2 max-w-full font-serif text-3xl font-bold leading-tight text-bronze sm:text-4xl">
              Transforme planos em acompanhamento claro.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Registre reserva, viagem, patrimonio, aposentadoria ou outros sonhos. Os valores so aparecem quando voces
              cadastrarem dados reais.
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-bronze/20 bg-bronze/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Progresso geral</p>
            <strong className="mt-2 block font-serif text-5xl text-bronze">{Math.round(totals.progress)}%</strong>
            <p className="mt-2 text-sm text-muted">
              {formatCurrency(totals.current)} de {formatCurrency(totals.target)}
            </p>
          </div>
        </div>
      </LedPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader
            eyebrow="Cadastro"
            title="Nova meta"
            action={<Badge tone={state.goals.length > 0 ? "success" : "neutral"}>{state.goals.length} meta(s)</Badge>}
          />
          <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
            {feedback}
          </p>

          <form className="grid gap-4" onSubmit={submitGoal}>
            <Label>
              Nome da meta
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex: reserva de emergencia, viagem, entrada do imovel..."
              />
            </Label>

            <div className="grid gap-3 md:grid-cols-2">
              <Label>
                Tipo
                <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as GoalType }))}>
                  {goalTypes.map((goalType) => (
                    <option key={goalType.value} value={goalType.value}>
                      {goalType.label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Prioridade
                <Select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as GoalPriority }))}
                >
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </Select>
              </Label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Label>
                Valor alvo
                <Input
                  inputMode="decimal"
                  value={form.targetAmount}
                  onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Valor atual
                <Input
                  inputMode="decimal"
                  value={form.currentAmount}
                  onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Prazo
                <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
              </Label>
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Salvar meta
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader eyebrow="Resumo" title="Saude das metas" />
          <div className="grid gap-3">
            <GoalMetric label="Valor alvo" value={formatCurrency(totals.target)} />
            <GoalMetric label="Valor atual" value={formatCurrency(totals.current)} />
            <GoalMetric label="Falta conquistar" value={formatCurrency(Math.max(0, totals.target - totals.current))} />
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
            A MAYA usa essas metas como contexto, mas nao cria previsoes financeiras sem receitas e despesas reais.
          </div>
        </Card>
      </section>

      <section className="mt-4">
        {state.goals.length === 0 ? (
          <EmptyState
            title="Nenhuma meta cadastrada"
            text="Comece por um objetivo real do casal. Depois, a MAYA consegue cruzar metas com receitas, despesas e orcamentos."
            actionLabel="Criar primeira meta"
            onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.goals.map((goal) => {
              const progress = getGoalProgress(goal);

              return (
                <Card key={goal.id}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-3 grid size-11 place-items-center rounded-xl border border-bronze/20 bg-bronze/10 text-bronze">
                        <Target className="size-5" aria-hidden="true" />
                      </div>
                      <h2 className="section-title">{goal.name}</h2>
                      <p className="mt-2 text-sm text-muted">
                        {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => actions.removeGoal(goal.id)} aria-label={`Remover meta ${goal.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-cream/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-bronze to-terracotta" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Input
                      inputMode="decimal"
                      defaultValue={goal.currentAmount}
                      aria-label={`Valor atual da meta ${goal.name}`}
                      onBlur={(event) => {
                        const value = Number(event.target.value.replace(",", "."));
                        if (Number.isFinite(value) && value >= 0) {
                          actions.updateGoalAmount(goal.id, value);
                        }
                      }}
                    />
                    <Badge tone={progress >= 70 ? "success" : "warning"}>{Math.round(progress)}%</Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="size-4 text-bronze" aria-hidden="true" />
                    Prazo: {goal.dueDate}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className="mt-2 block text-xl text-bronze">{value}</strong>
    </div>
  );
}
