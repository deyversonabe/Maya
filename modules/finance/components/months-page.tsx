"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, BellRing, CalendarDays, PiggyBank, Repeat, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, formatCurrency, toInputDate } from "@/lib/utils";
import { expenseCategories, incomeCategories } from "../data/defaults";
import {
  buildBillSummary,
  buildMonthSummaries,
  getBillEffectiveStatus,
  getPaidBillsByPaymentMonthUntil,
  getTransactionsByMonth,
  getTransactionsByMonthUntil
} from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { MonthSummary, PayableBill, Transaction, TransactionType } from "../types";
import { AttachmentLink } from "./attachment-link";
import { DocumentItemsPanel } from "./document-items-panel";

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
  const availableMonths = useMemo(() => buildAvailableMonths(state.transactions, state.bills), [state.transactions, state.bills]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [periodMode, setPeriodMode] = useState<"day" | "month">("month");
  const [periodStart, setPeriodStart] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`);
  const [periodEnd, setPeriodEnd] = useState(() => toInputDate(new Date()));
  const [periodStartMonth, setPeriodStartMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [periodEndMonth, setPeriodEndMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [incomeFilter, setIncomeFilter] = useState("Todos");
  const [expenseFilter, setExpenseFilter] = useState("Todos");
  const today = toInputDate(new Date());
  const monthTransactions = useMemo(
    () => getTransactionsByMonth(state.transactions, selectedMonth).sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions, selectedMonth]
  );
  const realizedMonthTransactions = useMemo(
    () => getTransactionsByMonthUntil(state.transactions, selectedMonth, today),
    [selectedMonth, state.transactions, today]
  );
  const billSummary = useMemo(() => buildBillSummary(state.bills, selectedMonth), [state.bills, selectedMonth]);
  const realizedBillTotal = useMemo(
    () => getPaidBillsByPaymentMonthUntil(state.bills, selectedMonth, today).reduce((total, bill) => total + bill.amount, 0),
    [selectedMonth, state.bills, today]
  );
  const totals = useMemo(() => calculateMonthTotals(monthTransactions, billSummary.total), [billSummary.total, monthTransactions]);
  const realizedTotals = useMemo(
    () => calculateMonthTotals(realizedMonthTransactions, realizedBillTotal),
    [realizedBillTotal, realizedMonthTransactions]
  );
  const grouped = useMemo(() => groupByType(monthTransactions), [monthTransactions]);
  const monthlySeries = useMemo(() => buildMonthSummaries(state.transactions, 12, state.bills), [state.bills, state.transactions]);
  const selectedPeriod = useMemo(
    () => getSelectedPeriod(periodMode, periodStart, periodEnd, periodStartMonth, periodEndMonth),
    [periodEnd, periodEndMonth, periodMode, periodStart, periodStartMonth]
  );
  const recurringGroups = useMemo(
    () => buildRecurringPaymentGroups(state.transactions, state.bills, selectedPeriod.start, selectedPeriod.end, expenseFilter),
    [expenseFilter, selectedPeriod.end, selectedPeriod.start, state.bills, state.transactions]
  );
  const incomeSummary = useMemo(
    () => buildIncomePeriodSummary(state.transactions, selectedPeriod.start, selectedPeriod.end, incomeFilter),
    [incomeFilter, selectedPeriod.end, selectedPeriod.start, state.transactions]
  );

  function changeSelectedMonth(month: string) {
    setSelectedMonth(month);
    setPeriodMode("month");
    setPeriodStartMonth(month);
    setPeriodEndMonth(month);
    setPeriodStart(`${month}-01`);
    setPeriodEnd(getMonthEndDate(month));
  }

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
              <Select value={selectedMonth} onChange={(event) => changeSelectedMonth(event.target.value)}>
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

      <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MonthMetric label="Entradas realizadas" value={formatCurrency(realizedTotals.income)} tone="success" icon={<ArrowUpCircle className="size-5" />} />
        <MonthMetric label="Saidas realizadas" value={formatCurrency(realizedTotals.expense)} tone="warning" icon={<ArrowDownCircle className="size-5" />} />
        <MonthMetric label="Investimentos realizados" value={formatCurrency(realizedTotals.investment)} tone="info" icon={<PiggyBank className="size-5" />} />
        <MonthMetric label="Contas previstas" value={formatCurrency(billSummary.total)} tone="warning" icon={<BellRing className="size-5" />} />
        <MonthMetric label="Saldo realizado" value={formatCurrency(realizedTotals.balance)} tone={realizedTotals.balance >= 0 ? "success" : "warning"} icon={<WalletCards className="size-5" />} />
        <MonthMetric label="Saldo previsto" value={formatCurrency(totals.balance)} tone={totals.balance >= 0 ? "success" : "warning"} icon={<CalendarDays className="size-5" />} />
      </section>

      <MonthlyLineChart summaries={monthlySeries} />

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
          <BillsMonthGroup bills={billSummary.monthBills} total={billSummary.total} />
        </div>

        <Card>
          <CardHeader eyebrow="Resumo" title={selectedMonth} action={<Badge tone="neutral">{monthTransactions.length} lanc.</Badge>} />
          <div className="grid gap-3">
            <SummaryRow label="Entradas realizadas" value={formatCurrency(realizedTotals.income)} />
            <SummaryRow label="Entradas previstas no mes" value={formatCurrency(totals.income)} />
            <SummaryRow label="Saidas realizadas" value={formatCurrency(realizedTotals.expense)} />
            <SummaryRow label="Saidas previstas no mes" value={formatCurrency(totals.expense)} />
            <SummaryRow label="Contas previstas no mes" value={formatCurrency(totals.bills)} />
            <SummaryRow label="Total investido realizado" value={formatCurrency(realizedTotals.investment)} />
            <SummaryRow label="Transferencias" value={formatCurrency(totals.transfer)} />
            <SummaryRow label="Saldo realizado ate hoje" value={formatCurrency(realizedTotals.balance)} highlight />
            <SummaryRow label="Saldo previsto do mes" value={formatCurrency(totals.balance)} />
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
            O saldo realizado considera apenas lancamentos com data ate hoje e contas pagas. O saldo previsto mostra o
            mes inteiro, incluindo vencimentos e recorrencias futuras daquele mes.
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Filtro por periodo"
            title="Pagamentos recorrentes"
            action={<Badge tone="warning">{formatCurrency(recurringGroups.reduce((total, group) => total + group.total, 0))}</Badge>}
          />
          <PeriodControls
            mode={periodMode}
            start={periodStart}
            end={periodEnd}
            startMonth={periodStartMonth}
            endMonth={periodEndMonth}
            onModeChange={setPeriodMode}
            onStartChange={setPeriodStart}
            onEndChange={setPeriodEnd}
            onStartMonthChange={setPeriodStartMonth}
            onEndMonthChange={setPeriodEndMonth}
          />
          <Label className="mt-3">
            Filtro de despesa
            <Select value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value)}>
              {["Todos", ...expenseCategories].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Label>
          <div className="mt-4 grid gap-3">
            {recurringGroups.length === 0 ? (
              <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
                Nenhum Pix, boleto, conta ou despesa encontrada no periodo.
              </p>
            ) : (
              recurringGroups.slice(0, 10).map((group) => (
                <div key={group.key} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="text-cream">{group.label}</strong>
                      <p className="mt-1 text-sm text-muted">
                        {group.count} lancamento(s) - {group.firstDate} a {group.lastDate}
                      </p>
                    </div>
                    <strong className="text-lg text-bronze">{formatCurrency(group.total)}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Renda"
            title="Quanto rendeu"
            action={<Badge tone="success">{formatCurrency(incomeSummary.total)}</Badge>}
          />
          <Label>
            Filtro de renda
            <Select value={incomeFilter} onChange={(event) => setIncomeFilter(event.target.value)}>
              {["Todos", ...incomeCategories].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Label>
          <div className="mt-4 grid gap-3">
            <SummaryRow label="Transacoes" value={String(incomeSummary.count)} />
            <SummaryRow label="Valor total" value={formatCurrency(incomeSummary.total)} highlight />
            {incomeSummary.groups.map((group) => (
              <div key={group.label} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong className="text-emerald-100">{group.label}</strong>
                    <p className="mt-1 text-sm text-muted">{group.count} entrada(s)</p>
                  </div>
                  <strong className="text-lg text-bronze">{formatCurrency(group.total)}</strong>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

function BillsMonthGroup({ bills, total }: { bills: PayableBill[]; total: number }) {
  return (
    <Card>
      <CardHeader eyebrow="Contas a pagar" title="Vencimentos do mes" action={<Badge tone="warning">{formatCurrency(total)}</Badge>} />

      {bills.length === 0 ? (
        <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
          Nenhuma conta cadastrada para vencimento neste mes.
        </p>
      ) : (
        <div className="grid gap-3">
          {bills
            .slice()
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((bill) => {
              const status = getBillEffectiveStatus(bill);
              return (
                <div key={bill.id} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <BellRing className="size-4 text-bronze" aria-hidden="true" />
                        <strong className="text-cream">{bill.title}</strong>
                        <Badge tone={status === "paid" ? "success" : status === "overdue" ? "warning" : "info"}>
                          {status === "paid" ? "Pago" : status === "overdue" ? "Atrasado" : "Pendente"}
                        </Badge>
                        {status !== "paid" && isFutureDate(bill.dueDate) ? <Badge tone="neutral">Futuro</Badge> : null}
                      </div>
                      <p className="text-sm leading-6 text-muted">
                        {bill.category} - {bill.person} - vencimento {bill.dueDate}
                        {bill.paymentMethod === "pix" && bill.paymentRecipient ? ` - Pix para ${bill.paymentRecipient}` : ""}
                        {bill.otherCategoryDescription ? ` - ${bill.otherCategoryDescription}` : ""}
                      </p>
                      <AttachmentLink
                        dataUrl={bill.attachmentDataUrl}
                        storagePath={bill.attachmentStoragePath}
                        imageName={bill.attachmentImageName}
                      />
                      <DocumentItemsPanel items={bill.documentItems} title="Itens guardados da conta" />
                    </div>
                    <strong className="text-lg text-bronze">{formatCurrency(bill.amount)}</strong>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Card>
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
          <strong className={cn("mt-3 block font-serif text-3xl", financialValueClass(value, colorClass))}>{value}</strong>
        </div>
        <div className="grid size-11 place-items-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-neon">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MonthlyLineChart({ summaries }: { summaries: MonthSummary[] }) {
  const width = 720;
  const height = 240;
  const padding = 34;
  const maxValue = Math.max(...summaries.flatMap((summary) => [summary.income, summary.expenses]), 1);
  const incomePoints = buildChartPoints(summaries.map((summary) => summary.income), maxValue, width, height, padding);
  const expensePoints = buildChartPoints(summaries.map((summary) => summary.expenses), maxValue, width, height, padding);

  return (
    <Card className="mb-4">
      <CardHeader
        eyebrow="Dashboard mensal"
        title="Altas e baixas entre meses"
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Renda</Badge>
            <Badge tone="warning">Despesa</Badge>
          </div>
        }
      />
      <div className="overflow-hidden rounded-xl border border-cream/10 bg-moss-950/35 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de linha com renda e despesa por mes" className="h-auto w-full">
          {[0, 1, 2, 3].map((line) => {
            const y = padding + ((height - padding * 2) / 3) * line;
            return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(245,239,223,0.12)" />;
          })}
          <polyline points={incomePoints} fill="none" stroke="#74f0bf" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={expensePoints} fill="none" stroke="#c46b43" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          {summaries.map((summary, index) => {
            const x = padding + ((width - padding * 2) / Math.max(1, summaries.length - 1)) * index;
            return (
              <text key={summary.month} x={x} y={height - 8} textAnchor="middle" fill="rgba(245,239,223,0.7)" fontSize="12">
                {summary.month.slice(5)}
              </text>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

function PeriodControls({
  mode,
  start,
  end,
  startMonth,
  endMonth,
  onModeChange,
  onStartChange,
  onEndChange,
  onStartMonthChange,
  onEndMonthChange
}: {
  mode: "day" | "month";
  start: string;
  end: string;
  startMonth: string;
  endMonth: string;
  onModeChange: (mode: "day" | "month") => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onStartMonthChange: (value: string) => void;
  onEndMonthChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Label>
        Tipo
        <Select value={mode} onChange={(event) => onModeChange(event.target.value as "day" | "month")}>
          <option value="month">Entre meses</option>
          <option value="day">Entre dias</option>
        </Select>
      </Label>
      {mode === "month" ? (
        <>
          <Label>
            Mes inicial
            <Input type="month" value={startMonth} onChange={(event) => onStartMonthChange(event.target.value)} />
          </Label>
          <Label>
            Mes final
            <Input type="month" value={endMonth} onChange={(event) => onEndMonthChange(event.target.value)} />
          </Label>
        </>
      ) : (
        <>
          <Label>
            Data inicial
            <Input type="date" value={start} onChange={(event) => onStartChange(event.target.value)} />
          </Label>
          <Label>
            Data final
            <Input type="date" value={end} onChange={(event) => onEndChange(event.target.value)} />
          </Label>
        </>
      )}
    </div>
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
                    {isFutureDate(transaction.date) ? <Badge tone="neutral">Futuro</Badge> : null}
                    {transaction.installmentTotal ? (
                      <Badge tone="neutral">
                        Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    {transaction.category} - {transaction.person} - {transaction.date}
                    {transaction.paymentMethod === "pix" && transaction.paymentRecipient
                      ? ` - Pix para ${transaction.paymentRecipient}`
                      : ""}
                    {transaction.otherCategoryDescription ? ` - ${transaction.otherCategoryDescription}` : ""}
                    {transaction.source === "receipt" ? " - nota/anexo" : ""}
                    {transaction.source === "statement" ? " - extrato" : ""}
                  </p>
                  {transaction.notes ? <p className="mt-2 text-sm leading-6 text-muted">{transaction.notes}</p> : null}
                  <AttachmentLink
                    dataUrl={transaction.attachmentDataUrl}
                    storagePath={transaction.attachmentStoragePath}
                    imageName={transaction.attachmentImageName}
                  />
                  <DocumentItemsPanel items={transaction.documentItems} title="Itens guardados do anexo" />
                </div>

                <div className="flex items-center justify-between gap-3 md:min-w-44 md:justify-end">
                  <strong className={cn("text-lg", financialValueClass(transaction.amount))}>{formatCurrency(transaction.amount)}</strong>
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
      <strong className={cn(highlight ? "mt-2 block text-2xl" : "mt-2 block text-lg", financialValueClass(value, highlight ? "financial-positive" : "text-cream"))}>{value}</strong>
    </div>
  );
}

function calculateMonthTotals(transactions: Transaction[], billsTotal: number) {
  const expenseTransactions = sumByType(transactions, "expense");
  const totals = {
    income: sumByType(transactions, "income"),
    expenseTransactions,
    bills: billsTotal,
    expense: expenseTransactions + billsTotal,
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

function buildChartPoints(values: number[], maxValue: number, width: number, height: number, padding: number) {
  return values
    .map((value, index) => {
      const x = padding + ((width - padding * 2) / Math.max(1, values.length - 1)) * index;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function getSelectedPeriod(
  mode: "day" | "month",
  start: string,
  end: string,
  startMonth: string,
  endMonth: string
) {
  if (mode === "month") {
    return {
      start: `${startMonth}-01`,
      end: getMonthEndDate(endMonth)
    };
  }

  return {
    start,
    end
  };
}

function buildRecurringPaymentGroups(
  transactions: Transaction[],
  bills: PayableBill[],
  start: string,
  end: string,
  categoryFilter: string
) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      total: number;
      count: number;
      firstDate: string;
      lastDate: string;
    }
  >();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .filter((transaction) => isDateInRange(transaction.date, start, end))
    .filter((transaction) => categoryFilter === "Todos" || transaction.category === categoryFilter)
    .forEach((transaction) => {
      const label = getPaymentGroupLabel(transaction);
      addPeriodGroup(groups, label, transaction.amount, transaction.date);
    });

  bills
    .filter((bill) => isDateInRange(bill.dueDate, start, end))
    .filter((bill) => categoryFilter === "Todos" || bill.category === categoryFilter)
    .forEach((bill) => {
      const label =
        bill.paymentMethod === "pix" && bill.paymentRecipient
          ? `Pix para ${bill.paymentRecipient}`
          : bill.paymentMethod === "boleto"
            ? `Boleto - ${bill.title}`
            : `Conta - ${bill.title}`;
      addPeriodGroup(groups, label, bill.amount, bill.dueDate);
    });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total || b.count - a.count);
}

function buildIncomePeriodSummary(transactions: Transaction[], start: string, end: string, categoryFilter: string) {
  const filtered = transactions
    .filter((transaction) => transaction.type === "income")
    .filter((transaction) => isDateInRange(transaction.date, start, end))
    .filter((transaction) => categoryFilter === "Todos" || transaction.category === categoryFilter);
  const groups = new Map<string, { label: string; total: number; count: number }>();

  filtered.forEach((transaction) => {
    const label =
      transaction.category === "Outros" && transaction.otherCategoryDescription
        ? `Outros - ${transaction.otherCategoryDescription}`
        : transaction.category;
    const current = groups.get(label) ?? { label, total: 0, count: 0 };
    groups.set(label, {
      ...current,
      total: current.total + transaction.amount,
      count: current.count + 1
    });
  });

  return {
    total: filtered.reduce((total, transaction) => total + transaction.amount, 0),
    count: filtered.length,
    groups: Array.from(groups.values()).sort((a, b) => b.total - a.total)
  };
}

function getPaymentGroupLabel(transaction: Transaction) {
  if (transaction.paymentMethod === "pix" && transaction.paymentRecipient) {
    return `Pix para ${transaction.paymentRecipient}`;
  }

  if (transaction.paymentMethod === "boleto") {
    return `Boleto - ${transaction.description.replace(/\s+\(\d+\/\d+\)$/u, "")}`;
  }

  if (transaction.recurring) {
    return `Recorrente - ${transaction.description}`;
  }

  if (transaction.installmentGroupId) {
    return `Parcelado - ${transaction.description.replace(/\s+\(\d+\/\d+\)$/u, "")}`;
  }

  return `${transaction.category} - ${transaction.description}`;
}

function addPeriodGroup(
  groups: Map<string, { key: string; label: string; total: number; count: number; firstDate: string; lastDate: string }>,
  label: string,
  amount: number,
  date: string
) {
  const key = normalizeGroupKey(label);
  const current = groups.get(key);

  if (!current) {
    groups.set(key, {
      key,
      label,
      total: amount,
      count: 1,
      firstDate: date,
      lastDate: date
    });
    return;
  }

  groups.set(key, {
    ...current,
    total: current.total + amount,
    count: current.count + 1,
    firstDate: current.firstDate < date ? current.firstDate : date,
    lastDate: current.lastDate > date ? current.lastDate : date
  });
}

function normalizeGroupKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function isFutureDate(date: string) {
  return date > toInputDate(new Date());
}

function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber, 0);

  return date.toISOString().slice(0, 10);
}

function buildAvailableMonths(transactions: Transaction[], bills: PayableBill[]) {
  const months = new Set<string>();
  const current = new Date();

  for (let index = -12; index <= 24; index += 1) {
    const date = new Date(current);
    date.setMonth(current.getMonth() + index);
    months.add(date.toISOString().slice(0, 7));
  }

  transactions.forEach((transaction) => months.add(transaction.date.slice(0, 7)));
  bills.forEach((bill) => months.add(bill.dueDate.slice(0, 7)));
  return Array.from(months).sort();
}
