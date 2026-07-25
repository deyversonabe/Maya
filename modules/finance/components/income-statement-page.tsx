"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Landmark, ListChecks, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, financialValueClass, formatCurrency, parseFinancialAmountInput, toInputDate } from "@/lib/utils";
import { DEFAULT_FINANCE_ACCOUNT_ID, incomeCategories } from "../data/defaults";
import { useFinanceStore } from "../lib/use-finance-store";
import type { FinanceAccount, FinanceAccountKind, PayableBill, Person, Transaction, TransactionType } from "../types";

type IncomePlan = "variable" | "monthly";

type StatementEntry = {
  id: string;
  date: string;
  description: string;
  category: string;
  person: Person;
  type: "opening" | "income" | "debit" | "transfer";
  amount: number;
  balanceAfter: number;
  accountId: string;
  accountName: string;
  source: "opening" | "transaction" | "bill";
};

type AccountSummary = {
  account: FinanceAccount;
  income: number;
  debit: number;
  balance: number;
};

const personOptions: Person[] = ["Pessoa 1", "Pessoa 2", "Casal"];
const accountKindOptions: Array<{ value: FinanceAccountKind; label: string }> = [
  { value: "checking", label: "Conta corrente" },
  { value: "cash", label: "Dinheiro" },
  { value: "wallet", label: "Carteira" },
  { value: "savings", label: "Reserva/poupanca" },
  { value: "other", label: "Outra" }
];

const accountColorOptions = ["#55f7ff", "#72ffb6", "#ffd27a", "#c46a43", "#ff5a7a"];

export function IncomeStatementPage() {
  const { state, actions } = useFinanceStore();
  const [feedback, setFeedback] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<"all" | string>("all");
  const [form, setForm] = useState({
    plan: "variable" as IncomePlan,
    description: "",
    amount: "",
    category: incomeCategories[0] ?? "Salario",
    otherCategoryDescription: "",
    person: "Casal" as Person,
    accountId: DEFAULT_FINANCE_ACCOUNT_ID,
    date: toInputDate(new Date()),
    months: "12",
    notes: ""
  });
  const [accountForm, setAccountForm] = useState({
    id: "",
    name: "",
    kind: "checking" as FinanceAccountKind,
    owner: "Casal" as Person,
    openingBalance: "",
    openingBalanceDate: toInputDate(new Date()),
    color: accountColorOptions[0]
  });

  const accountSummaries = useMemo(
    () => buildAccountSummaries(state.accounts, state.transactions, state.bills),
    [state.accounts, state.bills, state.transactions]
  );
  const statement = useMemo(
    () => buildStatementEntries(state.accounts, state.transactions, state.bills, selectedAccountId),
    [selectedAccountId, state.accounts, state.bills, state.transactions]
  );
  const totalBalance = accountSummaries.reduce((total, summary) => total + summary.balance, 0);
  const selectedSummary =
    selectedAccountId === "all"
      ? null
      : accountSummaries.find((summary) => summary.account.id === selectedAccountId) ?? null;
  const currentBalance = selectedSummary?.balance ?? totalBalance;
  const month = form.date.slice(0, 7);
  const monthIncome = statement
    .filter((entry) => entry.type === "income" && entry.date.startsWith(month))
    .reduce((total, entry) => total + entry.amount, 0);
  const monthDebits = statement
    .filter((entry) => entry.type === "debit" && entry.date.startsWith(month))
    .reduce((total, entry) => total + Math.abs(entry.amount), 0);
  const pendingBills = state.bills
    .filter((bill) => bill.status !== "paid" && matchesSelectedAccount(bill.accountId, state.accounts, selectedAccountId))
    .reduce((total, bill) => total + bill.amount, 0);
  const projectedBalance = currentBalance - pendingBills;
  const safeIncomeAccountId = getEffectiveAccountId(form.accountId, state.accounts);

  function submitIncome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseFinancialAmountInput(form.amount);

    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setFeedback("Preencha descricao, valor e data para salvar a renda.");
      return;
    }

    const transactions = createIncomeTransactions({
      description: form.description.trim(),
      amount,
      category: form.category,
      otherCategoryDescription:
        form.category === "Outros" ? form.otherCategoryDescription.trim() || undefined : undefined,
      person: form.person,
      accountId: safeIncomeAccountId,
      date: form.date,
      plan: form.plan,
      months: Number(form.months),
      notes: form.notes.trim() || undefined
    });

    actions.addTransactions(transactions);
    setForm((current) => ({
      ...current,
      description: "",
      amount: "",
      otherCategoryDescription: "",
      notes: ""
    }));
    setFeedback(
      form.plan === "monthly"
        ? `Renda mensal registrada por ${transactions.length} mes(es).`
        : "Renda variavel registrada no extrato."
    );
  }

  function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const openingBalance = accountForm.openingBalance.trim()
      ? parseFinancialAmountInput(accountForm.openingBalance)
      : 0;

    if (!accountForm.name.trim() || !Number.isFinite(openingBalance) || !accountForm.openingBalanceDate) {
      setFeedback("Preencha nome, saldo inicial valido e data inicial da carteira.");
      return;
    }

    const payload = {
      name: accountForm.name.trim(),
      kind: accountForm.kind,
      owner: accountForm.owner,
      openingBalance,
      openingBalanceDate: accountForm.openingBalanceDate,
      color: accountForm.color
    };

    if (accountForm.id) {
      actions.updateAccount(accountForm.id, payload);
      setFeedback("Carteira atualizada e saldo recalculado.");
    } else {
      actions.addAccount(payload);
      setFeedback("Carteira criada para novos lancamentos.");
    }

    resetAccountForm();
  }

  function editAccount(account: FinanceAccount) {
    setAccountForm({
      id: account.id,
      name: account.name,
      kind: account.kind,
      owner: account.owner,
      openingBalance: account.openingBalance ? String(account.openingBalance) : "",
      openingBalanceDate: account.openingBalanceDate,
      color: account.color ?? accountColorOptions[0]
    });
  }

  function resetAccountForm() {
    setAccountForm({
      id: "",
      name: "",
      kind: "checking",
      owner: "Casal",
      openingBalance: "",
      openingBalanceDate: toInputDate(new Date()),
      color: accountColorOptions[0]
    });
  }

  return (
    <AppShell>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <Card>
            <CardHeader
              eyebrow="Conta financeira"
              title="Extrato de entradas e saidas"
              action={<Badge tone={currentBalance >= 0 ? "success" : "warning"}>{formatCurrency(currentBalance)}</Badge>}
            />
            <div className="grid gap-3 md:grid-cols-4">
              <StatementMetric label="Saldo atual" value={currentBalance} icon={<WalletCards className="size-5" />} />
              <StatementMetric label="Renda do mes" value={monthIncome} icon={<ArrowUpCircle className="size-5" />} />
              <StatementMetric label="Debitos do mes" value={-monthDebits} icon={<ArrowDownCircle className="size-5" />} />
              <StatementMetric label="Saldo projetado" value={projectedBalance} icon={<Landmark className="size-5" />} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <Label>
                Ver extrato de
                <Select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                  <option value="all">Todas as carteiras</option>
                  {state.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Label>
              <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-3">
                <span className="block text-xs font-black uppercase tracking-[0.14em] text-muted">Saldo geral</span>
                <strong className={cn("font-serif text-2xl", financialValueClass(totalBalance, "text-bronze"))}>
                  {formatCurrency(totalBalance)}
                </strong>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {accountSummaries.map((summary) => (
                <button
                  key={summary.account.id}
                  type="button"
                  className={cn(
                    "rounded-xl border bg-cream/[0.04] p-4 text-left transition hover:border-neon-cyan/45 hover:bg-neon-cyan/10",
                    selectedAccountId === summary.account.id ? "border-neon-cyan/45 shadow-neon" : "border-cream/10"
                  )}
                  onClick={() => setSelectedAccountId(summary.account.id)}
                >
                  <span
                    className="mb-3 block h-1.5 rounded-full"
                    style={{ backgroundColor: summary.account.color ?? "#55f7ff" }}
                  />
                  <strong className="block truncate text-cream">{summary.account.name}</strong>
                  <span className="text-xs font-bold text-muted">{summary.account.owner}</span>
                  <span className={cn("mt-2 block font-serif text-xl", financialValueClass(summary.balance, "text-bronze"))}>
                    {formatCurrency(summary.balance)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Extrato"
              title="Movimento como conta bancaria"
              action={<Badge tone="neutral">{statement.length} lanc.</Badge>}
            />
            {statement.length === 0 ? (
              <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
                Ainda nao ha entradas ou saidas cadastradas. Cadastre uma renda para iniciar o saldo.
              </p>
            ) : (
              <div className="grid gap-2">
                {statement
                  .slice()
                  .reverse()
                  .slice(0, 80)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-xl border border-cream/10 bg-cream/[0.04] p-4 md:grid-cols-[120px_minmax(0,1fr)_140px_150px]"
                    >
                      <span className="text-sm font-bold text-muted">{entry.date}</span>
                      <div className="min-w-0">
                        <strong className="block truncate text-cream">{entry.description}</strong>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                          {entry.category} - {entry.accountName} - {entry.source === "bill" ? "conta paga" : entry.source === "opening" ? "saldo inicial" : "lancamento"}
                        </span>
                      </div>
                      <strong className={cn("text-right", financialValueClass(entry.amount, "financial-positive"))}>
                        {formatCurrency(entry.amount)}
                      </strong>
                      <span className={cn("text-right text-sm font-black", financialValueClass(entry.balanceAfter, "text-cream"))}>
                        Saldo {formatCurrency(entry.balanceAfter)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4">
        <Card>
          <CardHeader eyebrow="Receitas" title="Adicionar renda" action={<Plus className="size-5 text-bronze" />} />
          <form className="grid gap-3" onSubmit={submitIncome}>
            <Label>
              Tipo de renda
              <Select value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as IncomePlan }))}>
                <option value="variable">Variavel ou unica</option>
                <option value="monthly">Mensal fixa</option>
              </Select>
            </Label>

            <Label>
              Descricao
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Ex: salario, servico, venda, extra"
              />
            </Label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Valor real
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Data de entrada
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
              </Label>
            </div>

            <Label>
              Carteira de entrada
              <Select
                value={safeIncomeAccountId}
                onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              >
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Categoria
                <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {incomeCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Pessoa
                <Select value={form.person} onChange={(event) => setForm((current) => ({ ...current, person: event.target.value as Person }))}>
                  {personOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
            </div>

            {form.category === "Outros" ? (
              <Label>
                Descrever outros
                <Input
                  value={form.otherCategoryDescription}
                  onChange={(event) => setForm((current) => ({ ...current, otherCategoryDescription: event.target.value }))}
                  placeholder="Opcional"
                />
              </Label>
            ) : null}

            {form.plan === "monthly" ? (
              <Label>
                Repetir por quantos meses
                <Input
                  inputMode="numeric"
                  value={form.months}
                  onChange={(event) => setForm((current) => ({ ...current, months: event.target.value }))}
                />
              </Label>
            ) : null}

            <Label>
              Observacoes
              <Input
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Opcional"
              />
            </Label>

            {feedback ? (
              <p className="rounded-lg border border-bronze/25 bg-bronze/10 px-3 py-2 text-sm font-bold text-cream">
                {feedback}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              <ListChecks className="size-4" aria-hidden="true" />
              Salvar renda no extrato
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Carteiras"
            title="Saldo inicial e contas"
            action={<CreditCard className="size-5 text-bronze" />}
          />
          <form className="grid gap-3" onSubmit={submitAccount}>
            <Label>
              Nome da carteira
              <Input
                value={accountForm.name}
                onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex: Nubank, Dinheiro, Caixa"
              />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Tipo
                <Select
                  value={accountForm.kind}
                  onChange={(event) => setAccountForm((current) => ({ ...current, kind: event.target.value as FinanceAccountKind }))}
                >
                  {accountKindOptions.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Responsavel
                <Select
                  value={accountForm.owner}
                  onChange={(event) => setAccountForm((current) => ({ ...current, owner: event.target.value as Person }))}
                >
                  {personOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Saldo inicial
                <Input
                  inputMode="decimal"
                  value={accountForm.openingBalance}
                  onChange={(event) => setAccountForm((current) => ({ ...current, openingBalance: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
              <Label>
                Data do saldo
                <Input
                  type="date"
                  value={accountForm.openingBalanceDate}
                  onChange={(event) => setAccountForm((current) => ({ ...current, openingBalanceDate: event.target.value }))}
                />
              </Label>
            </div>
            <Label>
              Cor visual
              <Select
                value={accountForm.color}
                onChange={(event) => setAccountForm((current) => ({ ...current, color: event.target.value }))}
              >
                {accountColorOptions.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </Select>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="submit" variant="secondary">
                {accountForm.id ? "Atualizar carteira" : "Criar carteira"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetAccountForm}>
                Limpar
              </Button>
            </div>
          </form>

          <div className="mt-4 grid gap-2">
            {accountSummaries.map((summary) => (
              <div key={summary.account.id} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-cream">{summary.account.name}</strong>
                    <span className="text-xs font-bold text-muted">
                      Saldo inicial {formatCurrency(summary.account.openingBalance)} em {summary.account.openingBalanceDate}
                    </span>
                  </div>
                  <Badge tone={summary.balance >= 0 ? "success" : "warning"}>{formatCurrency(summary.balance)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => editAccount(summary.account)}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Editar
                  </Button>
                  {summary.account.id !== DEFAULT_FINANCE_ACCOUNT_ID ? (
                    <Button
                      type="button"
                      variant="danger"
                      className="min-h-9 px-3 text-xs"
                      onClick={() => actions.removeAccount(summary.account.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remover
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
        </div>
      </section>
    </AppShell>
  );
}

function StatementMetric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan-200/15 bg-cream/[0.04] p-4">
      <div className="mb-3 inline-flex size-11 items-center justify-center rounded-lg border border-bronze/30 bg-bronze/10 text-bronze">
        {icon}
      </div>
      <span className="block text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</span>
      <strong className={cn("mt-2 block font-serif text-2xl", financialValueClass(value, "text-bronze"))}>
        {formatCurrency(value)}
      </strong>
    </div>
  );
}

function createIncomeTransactions({
  description,
  amount,
  category,
  otherCategoryDescription,
  person,
  accountId,
  date,
  plan,
  months,
  notes
}: {
  description: string;
  amount: number;
  category: string;
  otherCategoryDescription?: string;
  person: Person;
  accountId: string;
  date: string;
  plan: IncomePlan;
  months: number;
  notes?: string;
}): Array<Omit<Transaction, "id" | "createdAt">> {
  const count = plan === "monthly" ? clampCount(months, 1, 120) : 1;
  const groupId = `income_${crypto.randomUUID()}`;

  return Array.from({ length: count }, (_, index) => ({
    type: "income" as TransactionType,
    description: plan === "monthly" ? `${description} (${index + 1}/${count})` : description,
    amount,
    category,
    otherCategoryDescription,
    person,
    accountId,
    date: addMonths(date, index),
    recurring: plan === "monthly",
    recurrenceGroupId: plan === "monthly" ? groupId : undefined,
    source: "manual",
    notes
  }));
}

function buildAccountSummaries(accounts: FinanceAccount[], transactions: Transaction[], bills: PayableBill[]): AccountSummary[] {
  const summaries = normalizeAccountsForDisplay(accounts).map((account) => ({
    account,
    income: 0,
    debit: 0,
    balance: account.openingBalance
  }));
  const byId = new Map(summaries.map((summary) => [summary.account.id, summary]));

  transactions.forEach((transaction) => {
    const summary = byId.get(getEffectiveAccountId(transaction.accountId, accounts));

    if (!summary) {
      return;
    }

    const amount = getSignedTransactionAmount(transaction);
    summary.balance += amount;

    if (amount > 0) {
      summary.income += amount;
    } else if (amount < 0) {
      summary.debit += Math.abs(amount);
    }
  });

  bills
    .filter((bill) => bill.status === "paid")
    .forEach((bill) => {
      const summary = byId.get(getEffectiveAccountId(bill.accountId, accounts));

      if (!summary) {
        return;
      }

      summary.debit += bill.amount;
      summary.balance -= bill.amount;
    });

  return summaries;
}

function buildStatementEntries(
  accounts: FinanceAccount[],
  transactions: Transaction[],
  bills: PayableBill[],
  selectedAccountId: "all" | string
) {
  const displayAccounts = normalizeAccountsForDisplay(accounts);
  const accountById = new Map(displayAccounts.map((account) => [account.id, account]));
  const selectedAccounts = selectedAccountId === "all"
    ? displayAccounts
    : displayAccounts.filter((account) => account.id === selectedAccountId);
  const selectedIds = new Set(selectedAccounts.map((account) => account.id));
  const rawEntries = [
    ...selectedAccounts
      .filter((account) => account.openingBalance !== 0)
      .map((account) => ({
        id: `opening_${account.id}`,
        date: account.openingBalanceDate,
        description: `Saldo inicial - ${account.name}`,
        category: "Saldo inicial",
        person: account.owner,
        type: "opening" as const,
        amount: account.openingBalance,
        accountId: account.id,
        accountName: account.name,
        source: "opening" as const
      })),
    ...transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      person: transaction.person,
      type: mapTransactionToStatementType(transaction.type),
      amount: getSignedTransactionAmount(transaction),
      accountId: getEffectiveAccountId(transaction.accountId, accounts),
      accountName: accountById.get(getEffectiveAccountId(transaction.accountId, accounts))?.name ?? "Conta principal",
      source: "transaction" as const
    })).filter((entry) => selectedAccountId === "all" || selectedIds.has(entry.accountId)),
    ...bills
      .filter((bill) => bill.status === "paid")
      .map((bill) => ({
        id: `bill_${bill.id}`,
        date: bill.paidAt?.slice(0, 10) || bill.dueDate,
        description: bill.title,
        category: bill.category,
        person: bill.person,
        type: "debit" as const,
        amount: -bill.amount,
        accountId: getEffectiveAccountId(bill.accountId, accounts),
        accountName: accountById.get(getEffectiveAccountId(bill.accountId, accounts))?.name ?? "Conta principal",
        source: "bill" as const
      }))
      .filter((entry) => selectedAccountId === "all" || selectedIds.has(entry.accountId))
  ].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    return dateCompare !== 0 ? dateCompare : left.id.localeCompare(right.id);
  });

  let balance = 0;

  return rawEntries.map((entry): StatementEntry => {
    balance += entry.amount;

    return {
      ...entry,
      balanceAfter: balance
    };
  });
}

function normalizeAccountsForDisplay(accounts: FinanceAccount[]) {
  if (accounts.length > 0) {
    return accounts;
  }

  return [
    {
      id: DEFAULT_FINANCE_ACCOUNT_ID,
      name: "Conta principal",
      kind: "checking" as FinanceAccountKind,
      owner: "Casal" as Person,
      openingBalance: 0,
      openingBalanceDate: toInputDate(new Date()),
      color: "#55f7ff",
      createdAt: new Date().toISOString()
    }
  ];
}

function getEffectiveAccountId(accountId: string | undefined, accounts: FinanceAccount[]) {
  return accounts.some((account) => account.id === accountId) ? accountId ?? DEFAULT_FINANCE_ACCOUNT_ID : DEFAULT_FINANCE_ACCOUNT_ID;
}

function matchesSelectedAccount(accountId: string | undefined, accounts: FinanceAccount[], selectedAccountId: "all" | string) {
  return selectedAccountId === "all" || getEffectiveAccountId(accountId, accounts) === selectedAccountId;
}

function mapTransactionToStatementType(type: TransactionType): StatementEntry["type"] {
  if (type === "income") {
    return "income";
  }

  if (type === "transfer") {
    return "transfer";
  }

  return "debit";
}

function getSignedTransactionAmount(transaction: Transaction) {
  if (transaction.type === "income") {
    return transaction.amount;
  }

  if (transaction.type === "transfer") {
    return 0;
  }

  return -transaction.amount;
}

function addMonths(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function clampCount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}
