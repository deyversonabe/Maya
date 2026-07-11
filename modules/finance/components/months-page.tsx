"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, CalendarDays, PiggyBank, Repeat, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { formatCurrency } from "@/lib/utils";
import { getTransactionsByMonth } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { Transaction, TransactionType } from "../types";

const transactionTypeConfig: Record<
  TransactionType,
  {
    title: string;
    empty: string;
    icon: React.ReactNode;
    badgeTone: "success" | "warning" | "info" | "neutral";
  }
> = {
  income: {
    title: "Entradas",
    empty: "Nenhuma entrada cadastrada neste mes.",
    icon: <ArrowUpCircle className="size-4" />,
    badgeTone: "success"
  },
  expense: {
    title: "Saidas",
    empty: "Nenhuma saida cadastrada neste mes.",
    icon: <ArrowDownCircle className="size-4" />,
    badgeTone: "warning"
  },
  investment: {
    title: "Investimentos",
    empty: "Nenhum investimento cadastrado neste mes.",
    icon: <PiggyBank className="size-4" />,
    badgeTone: "info"
  },
  transfer: {
    title: "Transferencias",
    empty: "Nenhuma transferencia cadastrada neste mes.",
    icon: <Repeat className="size-4" />,
    badgeTone: "neutral"
  }
};

const transactionOrder: TransactionType[] = ["income", "expense", "investment", "transfer"];

export function MonthsPage() {
  const { state, actions } = useFinanceStore();
  const availableMonths = useMemo(() => buildAvailableMonths(state.transactions), [state.transactions]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const monthTransactions = useMemo(
    () => getTransactionsByMonth(state.transactions, selectedMonth).sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions, selectedMonth]
  );
  const totals = useMemo(() => calculateMonthTotals(monthTransactions), [monthTransactions]);
  const grouped = useMemo(() => groupByType(monthTransactions), [monthTransactions]);

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="bronze">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
          <div>
            <p className="eyebrow">Divisao por mes</p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
              Entradas, saidas e resumo mensal.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Selecione um mes para ver tudo discriminado: receitas, despesas, investimentos, transferencias, somas e
              saldo calculado do periodo.
            </p>
          </div>

          <div className="rounded-2xl border border-bronze/20 bg-bronze/10 p-4">
            <Label>
              Mes em exibicao
              <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </Select>
            </Label>
          </div>
        </div>
      </LedPanel>

      <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MonthMetric label="Entradas" value={formatCurrency(totals.income)} tone="success" icon={<ArrowUpCircle className="size-5" />} />
        <MonthMetric label="Saidas" value={formatCurrency(totals.expense)} tone="warning" icon={<ArrowDownCircle className="size-5" />} />
        <MonthMetric label="Investimentos" value={formatCurrency(totals.investment)} tone="info" icon={<PiggyBank className="size-5" />} />
        <MonthMetric label="Transferencias" value={formatCurrency(totals.transfer)} tone="neutral" icon={<Repeat className="size-5" />} />
        <MonthMetric label="Saldo do mes" value={formatCurrency(totals.balance)} tone={totals.balance >= 0 ? "success" : "warning"} icon={<WalletCards className="size-5" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          {monthTransactions.length === 0 ? (
            <EmptyState
              title="Nenhum lancamento neste mes"
              text="Cadastre receitas, despesas ou parcelas para que este mes ganhe um resumo financeiro completo."
              actionLabel="Cadastrar despesa"
              onAction={() => {
                window.location.href = "/expenses";
              }}
            />
          ) : (
            transactionOrder.map((type) => (
              <TransactionGroup
                key={type}
                type={type}
                transactions={grouped[type]}
                total={totals[type]}
                onRemove={(id) => actions.removeTransaction(id)}
              />
            ))
          )}
        </div>

        <Card>
          <CardHeader eyebrow="Resumo" title={selectedMonth} action={<Badge tone="neutral">{monthTransactions.length} lanc.</Badge>} />
          <div className="grid gap-3">
            <SummaryRow label="Total de entradas" value={formatCurrency(totals.income)} />
            <SummaryRow label="Total de saidas" value={formatCurrency(totals.expense)} />
            <SummaryRow label="Total investido" value={formatCurrency(totals.investment)} />
            <SummaryRow label="Transferencias" value={formatCurrency(totals.transfer)} />
            <SummaryRow label="Saldo final" value={formatCurrency(totals.balance)} highlight />
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
            O saldo considera entradas menos saidas e investimentos. Transferencias aparecem separadas para nao inflar
            o resultado do mes.
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

function MonthMetric({
  label,
  value,
  tone,
  icon
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "info" | "neutral";
  icon: React.ReactNode;
}) {
  const colorClass =
    tone === "success"
      ? "text-emerald-200"
      : tone === "warning"
        ? "text-terracotta"
        : tone === "info"
          ? "text-cyan-200"
          : "text-bronze";

  return (
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
          <strong className={`mt-3 block font-serif text-3xl ${colorClass}`}>{value}</strong>
        </div>
        <div className="grid size-11 place-items-center rounded-xl border border-bronze/20 bg-bronze/10 text-bronze">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function TransactionGroup({
  type,
  transactions,
  total,
  onRemove
}: {
  type: TransactionType;
  transactions: Transaction[];
  total: number;
  onRemove: (id: string) => void;
}) {
  const config = transactionTypeConfig[type];

  return (
    <Card>
      <CardHeader
        eyebrow="Lancamentos"
        title={config.title}
        action={<Badge tone={config.badgeTone}>{formatCurrency(total)}</Badge>}
      />

      {transactions.length === 0 ? (
        <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
          {config.empty}
        </p>
      ) : (
        <div className="grid gap-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-bronze">{config.icon}</span>
                    <strong className="text-cream">{transaction.description}</strong>
                    {transaction.recurring ? <Badge tone="info">Recorrente</Badge> : null}
                    {transaction.installmentTotal ? (
                      <Badge tone="neutral">
                        Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    {transaction.category} - {transaction.person} - {transaction.date}
                    {transaction.source === "receipt" ? " - nota/anexo" : ""}
                  </p>
                  {transaction.notes ? <p className="mt-2 text-sm leading-6 text-muted">{transaction.notes}</p> : null}
                </div>

                <div className="flex items-center justify-between gap-3 md:min-w-44 md:justify-end">
                  <strong className="text-lg text-bronze">{formatCurrency(transaction.amount)}</strong>
                  <Button variant="ghost" className="min-h-9 px-3" onClick={() => onRemove(transaction.id)} aria-label={`Remover ${transaction.description}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-xl border border-bronze/30 bg-bronze/10 p-4" : "rounded-xl border border-cream/10 bg-cream/[0.04] p-4"}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={highlight ? "mt-2 block text-2xl text-bronze" : "mt-2 block text-lg text-cream"}>{value}</strong>
    </div>
  );
}

function calculateMonthTotals(transactions: Transaction[]) {
  const totals = {
    income: sumByType(transactions, "income"),
    expense: sumByType(transactions, "expense"),
    investment: sumByType(transactions, "investment"),
    transfer: sumByType(transactions, "transfer")
  };

  return {
    ...totals,
    balance: totals.income - totals.expense - totals.investment
  };
}

function groupByType(transactions: Transaction[]) {
  return transactionOrder.reduce<Record<TransactionType, Transaction[]>>(
    (groups, type) => {
      groups[type] = transactions.filter((transaction) => transaction.type === type);
      return groups;
    },
    {
      income: [],
      expense: [],
      investment: [],
      transfer: []
    }
  );
}

function sumByType(transactions: Transaction[], type: TransactionType) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function buildAvailableMonths(transactions: Transaction[]) {
  const months = new Set<string>();
  const current = new Date();

  for (let index = -12; index <= 24; index += 1) {
    const date = new Date(current);
    date.setMonth(current.getMonth() + index);
    months.add(date.toISOString().slice(0, 7));
  }

  transactions.forEach((transaction) => months.add(transaction.date.slice(0, 7)));
  return Array.from(months).sort();
}
