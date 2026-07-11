"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Check, FileImage, Plus, ReceiptText, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { formatCurrency, toInputDate } from "@/lib/utils";
import { transactionCategories } from "../data/defaults";
import { addMonths, getTransactionsByMonth } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { ExpenseDraft, Person, Transaction, TransactionType } from "../types";

type ExpensePlan = "single" | "recurring" | "installment";

const personOptions: Person[] = ["Pessoa 1", "Pessoa 2", "Casal"];

export function ExpensesPage() {
  const { state, actions } = useFinanceStore();
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const months = useMemo(() => buildAvailableMonths(state.transactions), [state.transactions]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [feedback, setFeedback] = useState("Cadastre despesas manualmente ou envie uma nota para a MAYA revisar.");
  const [receiptDraft, setReceiptDraft] = useState<ExpenseDraft | null>(null);
  const [isReadingReceipt, setIsReadingReceipt] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "Alimentacao",
    person: "Casal" as Person,
    date: toInputDate(new Date()),
    plan: "single" as ExpensePlan,
    months: "12",
    installments: "2",
    notes: ""
  });

  const monthTransactions = getTransactionsByMonth(state.transactions, selectedMonth).filter(
    (transaction) => transaction.type === "expense"
  );
  const monthTotal = monthTransactions.reduce((total, transaction) => total + transaction.amount, 0);

  function applyDraft(draft: ExpenseDraft) {
    setReceiptDraft(draft);
    setForm((current) => ({
      ...current,
      description: draft.description,
      amount: draft.amount > 0 ? String(draft.amount) : current.amount,
      category: draft.category || current.category,
      person: draft.person,
      date: draft.date || current.date,
      notes: draft.receiptImageName ? `Nota anexada: ${draft.receiptImageName}` : current.notes
    }));
  }

  async function handleReceiptFile(file: File) {
    setIsReadingReceipt(true);
    setFeedback("MAYA esta lendo o comprovante e preparando um rascunho...");

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const response = await fetch("/api/maya/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          fileName: file.name
        })
      });
      const result = (await response.json()) as {
        expenseDraft?: ExpenseDraft;
        message?: string;
      };

      if (result.expenseDraft) {
        applyDraft(result.expenseDraft);
      }

      setFeedback(result.message ?? "Rascunho criado. Revise antes de salvar.");
    } catch {
      setFeedback("Nao consegui ler a imagem. Voce pode preencher a despesa manualmente.");
    } finally {
      setIsReadingReceipt(false);
    }
  }

  function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));

    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFeedback("Preencha descricao e valor valido para salvar.");
      return;
    }

    const transactions = createPlannedExpenses({
      description: form.description.trim(),
      amount,
      category: form.category,
      person: form.person,
      date: form.date,
      plan: form.plan,
      months: Number(form.months),
      installments: Number(form.installments),
      notes: form.notes,
      receiptImageName: receiptDraft?.receiptImageName,
      source: receiptDraft ? "receipt" : "manual"
    });

    actions.addTransactions(transactions);
    setFeedback(
      form.plan === "installment"
        ? `${transactions.length} parcelas foram criadas nos meses futuros.`
        : form.plan === "recurring"
          ? `${transactions.length} despesas recorrentes foram criadas.`
          : "Despesa salva com sucesso."
    );
    setSelectedMonth(form.date.slice(0, 7));
    setReceiptDraft(null);
    setForm((current) => ({
      ...current,
      description: "",
      amount: "",
      notes: "",
      plan: "single"
    }));
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="bronze">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <p className="eyebrow">Despesas inteligentes</p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
              Manual, nota fiscal, recorrencia ou parcelas.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Cadastre compras sem nota, abra a camera no celular ou envie uma imagem para a MAYA criar um rascunho
              revisavel antes de salvar.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-50">
            <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">Mes selecionado</p>
            <strong className="mt-2 block font-serif text-4xl">{selectedMonth}</strong>
            <p className="mt-2 text-sm opacity-90">{formatCurrency(monthTotal)} em despesas registradas.</p>
          </div>
        </div>
      </LedPanel>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader
            eyebrow="Despesas"
            title="Cadastro inteligente"
            action={<Badge tone={receiptDraft ? "success" : "neutral"}>{receiptDraft ? "Rascunho MAYA" : "Manual ou nota"}</Badge>}
          />

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={isReadingReceipt}>
              <FileImage className="size-4" aria-hidden="true" />
              Anexar nota
            </Button>
            <Button variant="ghost" onClick={() => cameraRef.current?.click()} disabled={isReadingReceipt}>
              <Camera className="size-4" aria-hidden="true" />
              Abrir camera
            </Button>
            <input
              ref={uploadRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleReceiptFile(file);
                }
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleReceiptFile(file);
                }
                event.target.value = "";
              }}
            />
          </div>

          <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
            {feedback}
          </p>

          <form className="grid gap-4" onSubmit={submitExpense}>
            <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
              <Label>
                Descricao
                <Input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Ex: mercado, aluguel, financiamento..."
                />
              </Label>
              <Label>
                Valor
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0,00"
                />
              </Label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Label>
                Categoria
                <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {transactionCategories.map((category) => (
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
              <Label>
                Data inicial
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
              </Label>
              <Label>
                Tipo de lancamento
                <Select value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as ExpensePlan }))}>
                  <option value="single">Unica</option>
                  <option value="recurring">Recorrente mensal</option>
                  <option value="installment">Parcelada</option>
                </Select>
              </Label>
            </div>

            {form.plan !== "single" ? (
              <div className="grid gap-3 rounded-lg border border-cream/10 bg-cream/[0.04] p-4 md:grid-cols-2">
                {form.plan === "recurring" ? (
                  <Label>
                    Gerar por quantos meses?
                    <Input inputMode="numeric" value={form.months} onChange={(event) => setForm((current) => ({ ...current, months: event.target.value }))} />
                  </Label>
                ) : (
                  <Label>
                    Quantas parcelas?
                    <Input
                      inputMode="numeric"
                      value={form.installments}
                      onChange={(event) => setForm((current) => ({ ...current, installments: event.target.value }))}
                    />
                  </Label>
                )}
                <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-100">
                  {form.plan === "recurring"
                    ? "Exemplo: aluguel criado automaticamente em todos os meses do periodo."
                    : "Exemplo: financiamento aparece como parcela 1/12, 2/12 e assim por diante."}
                </div>
              </div>
            ) : null}

            <Label>
              Observacoes
              <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </Label>

            <Button type="submit" className="w-full sm:w-auto">
              <Check className="size-4" aria-hidden="true" />
              Confirmar despesa
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader eyebrow="Meses" title="Divisao mensal" />
          <Label>
            Mes em exibicao
            <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </Select>
          </Label>
          <div className="mt-4 rounded-xl border border-terracotta/20 bg-terracotta/10 p-4">
            <p className="text-sm font-bold text-muted">Total de despesas no mes</p>
            <strong className="mt-2 block font-serif text-4xl text-bronze">{formatCurrency(monthTotal)}</strong>
          </div>
          <div className="mt-4 grid gap-3">
            {monthTransactions.length === 0 ? (
              <EmptyState
                title="Mes limpo por enquanto"
                text="Cadastre uma despesa manualmente ou use a camera para a MAYA preparar um rascunho de nota."
                actionLabel="Adicionar agora"
                onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              />
            ) : (
              monthTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border border-cream/10 bg-cream/[0.04] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-cream">{transaction.description}</strong>
                      <p className="mt-1 text-sm text-muted">
                        {transaction.category} - {transaction.date}
                        {transaction.installmentTotal
                          ? ` - parcela ${transaction.installmentNumber}/${transaction.installmentTotal}`
                          : ""}
                        {transaction.recurring ? " - recorrente" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" className="min-h-9 px-3" onClick={() => actions.removeTransaction(transaction.id)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <strong className="mt-2 block text-bronze">{formatCurrency(transaction.amount)}</strong>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

function createPlannedExpenses({
  description,
  amount,
  category,
  person,
  date,
  plan,
  months,
  installments,
  notes,
  receiptImageName,
  source
}: {
  description: string;
  amount: number;
  category: string;
  person: Person;
  date: string;
  plan: ExpensePlan;
  months: number;
  installments: number;
  notes?: string;
  receiptImageName?: string;
  source: "manual" | "receipt";
}): Array<Omit<Transaction, "id" | "createdAt">> {
  const count = plan === "recurring" ? clampCount(months, 1, 60) : plan === "installment" ? clampCount(installments, 1, 120) : 1;
  const groupId = `${plan}_${crypto.randomUUID()}`;

  return Array.from({ length: count }, (_, index) => ({
    type: "expense" as TransactionType,
    description: plan === "installment" ? `${description} (${index + 1}/${count})` : description,
    amount,
    category,
    person,
    date: addMonths(date, index),
    recurring: plan === "recurring",
    recurrenceGroupId: plan === "recurring" ? groupId : undefined,
    installmentGroupId: plan === "installment" ? groupId : undefined,
    installmentNumber: plan === "installment" ? index + 1 : undefined,
    installmentTotal: plan === "installment" ? count : undefined,
    source,
    receiptImageName,
    notes
  }));
}

function buildAvailableMonths(transactions: Transaction[]) {
  const months = new Set<string>();
  const current = new Date();

  for (let index = -3; index <= 18; index += 1) {
    const date = new Date(current);
    date.setMonth(current.getMonth() + index);
    months.add(date.toISOString().slice(0, 7));
  }

  transactions.forEach((transaction) => months.add(transaction.date.slice(0, 7)));
  return Array.from(months).sort();
}

function clampCount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
