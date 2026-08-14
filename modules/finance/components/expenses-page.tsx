"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Check, FileImage, FileText, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, formatCurrency, parseFinancialAmountInput, toInputDate } from "@/lib/utils";
import { DEFAULT_FINANCE_ACCOUNT_ID, expenseCategories, incomeCategories } from "../data/defaults";
import { addMonths, getTransactionsByMonth, getTransactionsByMonthUntil } from "../lib/calculations";
import { findTransactionDuplicateMatches, type TransactionDuplicateMatch } from "../lib/duplicates";
import { detectQrPayloadsFromImageDataUrl, fileToFinanceAttachment, type FinanceAttachmentUpload } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type {
  BankStatementDraft,
  FinancialDocumentDraft,
  PayableBill,
  PaymentMethod,
  Person,
  StatementTransactionDraft,
  Transaction,
  TransactionType
} from "../types";
import { DocumentItemsPanel } from "./document-items-panel";
import { FinancialDocumentReview } from "./financial-document-review";
import { AttachmentLink } from "./attachment-link";

type ExpensePlan = "single" | "recurring" | "installment";

const personOptions: Person[] = ["Deyverson", "Tom", "Casal"];

type ExpenseDuplicateReview = {
  transactions: Array<Omit<Transaction, "id" | "createdAt">>;
  matches: TransactionDuplicateMatch[];
  origin: "expense" | "statement";
  editId?: string;
  reconciliations?: BillReconciliationMatch[];
};

type BillReconciliationMatch = {
  bill: PayableBill;
  transaction: Omit<Transaction, "id" | "createdAt">;
  transactionIndex: number;
};

export function ExpensesPage() {
  const { state, actions } = useFinanceStore();
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const statementRef = useRef<HTMLInputElement>(null);
  const months = useMemo(() => buildAvailableMonths(state.transactions), [state.transactions]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [feedback, setFeedback] = useState("Cadastre despesas manualmente ou envie uma nota para a MAYA revisar.");
  const [receiptDraft, setReceiptDraft] = useState<FinancialDocumentDraft | null>(null);
  const [statementDraft, setStatementDraft] = useState<BankStatementDraft | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<ExpenseDuplicateReview | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isReadingReceipt, setIsReadingReceipt] = useState(false);
  const [isReadingStatement, setIsReadingStatement] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "Alimentacao",
    otherCategoryDescription: "",
    person: "Casal" as Person,
    accountId: DEFAULT_FINANCE_ACCOUNT_ID,
    date: toInputDate(new Date()),
    paymentMethod: "other" as PaymentMethod,
    paymentRecipient: "",
    plan: "single" as ExpensePlan,
    months: "12",
    installments: "2",
    notes: ""
  });

  const today = toInputDate(new Date());
  const monthTransactions = getTransactionsByMonth(state.transactions, selectedMonth).filter(
    (transaction) => transaction.type === "expense"
  );
  const realizedMonthTransactions = getTransactionsByMonthUntil(state.transactions, selectedMonth, today).filter(
    (transaction) => transaction.type === "expense"
  );
  const monthTotal = realizedMonthTransactions.reduce((total, transaction) => total + transaction.amount, 0);
  const futureMonthTotal = monthTransactions
    .filter((transaction) => transaction.date > today)
    .reduce((total, transaction) => total + transaction.amount, 0);
  const selectedExpenseAccountId = state.accounts.some((account) => account.id === form.accountId)
    ? form.accountId
    : DEFAULT_FINANCE_ACCOUNT_ID;

  function applyDraft(draft: FinancialDocumentDraft) {
    const date = draft.documentDate || draft.dueDate || "";
    setReceiptDraft(draft);
    setForm((current) => ({
      ...current,
      description: draft.description || draft.title,
      amount: draft.amount > 0 ? String(draft.amount) : current.amount,
      category: draft.category || current.category,
      otherCategoryDescription: draft.otherCategoryDescription ?? current.otherCategoryDescription,
      person: draft.person,
      date,
      paymentMethod: draft.paymentMethod ?? current.paymentMethod,
      paymentRecipient: draft.paymentRecipient ?? current.paymentRecipient,
      notes: draft.attachmentImageName ? `Anexo: ${draft.attachmentImageName}` : current.notes
    }));
  }

  function updateReceiptDraft(patch: Partial<FinancialDocumentDraft>) {
    setReceiptDraft((current) => {
      if (!current) {
        return current;
      }

      const updated = { ...current, ...patch };

      setForm((formCurrent) => ({
        ...formCurrent,
        description:
          "description" in patch || "title" in patch
            ? updated.description || updated.title
            : formCurrent.description,
        amount: "amount" in patch ? (updated.amount > 0 ? String(updated.amount) : "") : formCurrent.amount,
        category: "category" in patch ? updated.category : formCurrent.category,
        otherCategoryDescription:
          "otherCategoryDescription" in patch
            ? updated.otherCategoryDescription ?? ""
            : formCurrent.otherCategoryDescription,
        person: "person" in patch ? updated.person : formCurrent.person,
        paymentMethod: "paymentMethod" in patch ? updated.paymentMethod ?? formCurrent.paymentMethod : formCurrent.paymentMethod,
        paymentRecipient:
          "paymentRecipient" in patch ? updated.paymentRecipient ?? "" : formCurrent.paymentRecipient,
        date:
          "documentDate" in patch || "dueDate" in patch || "entryDate" in patch
            ? updated.documentDate || updated.dueDate || updated.entryDate || formCurrent.date
            : formCurrent.date,
        notes: "notes" in patch ? updated.notes ?? "" : formCurrent.notes
      }));

      return updated;
    });
  }

  async function handleReceiptFile(file: File) {
    setIsReadingReceipt(true);
    setFeedback("MAYA esta lendo o comprovante e preparando um rascunho...");

    try {
      const attachment = await fileToFinanceAttachment(file);
      const qrPayloads = await detectQrPayloadsFromImageDataUrl(attachment.imageDataUrl);
      const response = await fetch("/api/maya/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileName: file.name,
          documentKind: "expense",
          qrPayloads
        })
      });
      const result = (await response.json()) as {
        financialDraft?: FinancialDocumentDraft;
        message?: string;
      };

      if (result.financialDraft) {
        applyDraft(withStoredAttachment(result.financialDraft, attachment));
      }

      setFeedback(buildDraftFeedback(result.message, result.financialDraft));
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message === "image_too_large"
          ? "A imagem ficou grande demais para leitura. Tente uma foto mais proxima, nitida e com menos fundo ao redor."
          : "Nao consegui ler a imagem. Voce pode preencher a despesa manualmente."
      );
    } finally {
      setIsReadingReceipt(false);
    }
  }

  async function handleStatementFile(file: File) {
    setIsReadingStatement(true);
    setFeedback("MAYA esta lendo o extrato e separando renda e despesas...");

    try {
      const attachment = await fileToFinanceAttachment(file);
      const response = await fetch("/api/maya/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileName: file.name
        })
      });
      const result = (await response.json()) as {
        statementDraft?: BankStatementDraft;
        message?: string;
      };

      if (result.statementDraft) {
        setStatementDraft(withStoredStatementAttachment(result.statementDraft, attachment));
      }

      setFeedback(
        result.message ??
          "Extrato revisavel criado. Confira as linhas, os valores e as duplicidades antes de importar."
      );
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message === "image_too_large"
          ? "A imagem do extrato ficou grande demais. Tente um print mais proximo e nitido."
          : "Nao consegui ler o extrato. Voce pode cadastrar as transacoes manualmente."
      );
    } finally {
      setIsReadingStatement(false);
    }
  }

  function updateStatementLine(index: number, patch: Partial<StatementTransactionDraft>) {
    setStatementDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
      };
    });
  }

  function removeStatementLine(index: number) {
    setStatementDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        lines: current.lines.filter((_line, lineIndex) => lineIndex !== index)
      };
    });
  }

  function importStatementLines() {
    if (!statementDraft || statementDraft.lines.length === 0) {
      setFeedback("Nao ha linhas confiaveis no extrato para importar.");
      return;
    }

    const transactions = buildTransactionsFromStatement(statementDraft);
    const missingPixRecipient = transactions.find(
      (transaction) => transaction.paymentMethod === "pix" && !transaction.paymentRecipient?.trim()
    );

    if (missingPixRecipient) {
      setFeedback(`Informe para quem foi feito o Pix em "${missingPixRecipient.description}" antes de importar.`);
      return;
    }

    const reconciliations = findBillReconciliationMatches(transactions, state.bills);
    const reconciledIndexes = new Set(reconciliations.map((match) => match.transactionIndex));
    const transactionsToImport = transactions.filter((_transaction, index) => !reconciledIndexes.has(index));
    const duplicates = findTransactionDuplicateMatches(state.transactions, transactionsToImport);
    const internalDuplicates = findInternalDuplicateMatches(transactionsToImport);

    if (duplicates.length > 0 || internalDuplicates.length > 0) {
      setDuplicateReview({ transactions: transactionsToImport, matches: duplicates, origin: "statement", reconciliations });
      setFeedback(
        internalDuplicates.length > 0
          ? "Suspeita de duplicidade no extrato. Aprove para computar ou exclua o lote antes de importar."
          : "Suspeita de duplicidade com dados ja salvos. Aprove para computar ou exclua o novo lancamento."
      );
      return;
    }

    saveStatementTransactions(transactionsToImport, reconciliations);
  }

  function saveStatementTransactions(
    transactions: Array<Omit<Transaction, "id" | "createdAt">>,
    reconciliations: BillReconciliationMatch[] = []
  ) {
    reconciliations.forEach((match) => {
      actions.updateBill(match.bill.id, {
        status: "paid",
        paidAt: `${match.transaction.date}T12:00:00.000Z`,
        notes: mergeReconciliationNote(match.bill.notes, match.transaction)
      });
    });

    if (transactions.length > 0) {
      actions.addTransactions(transactions);
    }

    setSelectedMonth(transactions[0]?.date.slice(0, 7) ?? reconciliations[0]?.transaction.date.slice(0, 7) ?? selectedMonth);
    setStatementDraft(null);
    setDuplicateReview(null);
    setFeedback(
      `${transactions.length} linha(s) do extrato foram salvas na nuvem.${
        reconciliations.length > 0 ? ` ${reconciliations.length} conta(s) foram conciliadas automaticamente.` : ""
      }`
    );
  }

  function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseFinancialAmountInput(form.amount);

    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setFeedback("Preencha descricao, valor e data para salvar.");
      return;
    }

    if (form.paymentMethod === "pix" && !form.paymentRecipient.trim()) {
      setFeedback("Quando a despesa for Pix, informe para quem foi feito antes de salvar.");
      return;
    }

    const transactions = createPlannedExpenses({
      description: form.description.trim(),
      amount,
      category: form.category,
      otherCategoryDescription: form.category === "Outros" ? form.otherCategoryDescription.trim() : undefined,
      person: form.person,
      accountId: selectedExpenseAccountId,
      date: form.date,
      paymentMethod: form.paymentMethod,
      paymentRecipient: form.paymentRecipient.trim(),
      plan: form.plan,
      months: Number(form.months),
      installments: Number(form.installments),
      notes: form.notes,
      attachmentImageName: receiptDraft?.attachmentImageName,
      attachmentDataUrl: receiptDraft?.attachmentDataUrl,
      attachmentStoragePath: receiptDraft?.attachmentStoragePath,
      attachmentMimeType: receiptDraft?.attachmentMimeType,
      attachmentSize: receiptDraft?.attachmentSize,
      documentItems: receiptDraft?.items,
      fiscalDocument: receiptDraft?.fiscalDocument,
      source: receiptDraft ? "receipt" : "manual"
    });

    const comparableTransactions = editingExpenseId
      ? state.transactions.filter((transaction) => transaction.id !== editingExpenseId)
      : state.transactions;
    const receiptAttachmentMatch =
      receiptDraft && !editingExpenseId && form.plan === "single"
        ? findSameDaySameAmountExpense(comparableTransactions, transactions[0])
        : null;

    if (receiptAttachmentMatch) {
      attachReceiptToExistingExpense(receiptAttachmentMatch, transactions[0]);
      return;
    }

    const duplicates = findTransactionDuplicateMatches(comparableTransactions, transactions);

    if (duplicates.length > 0) {
      setDuplicateReview({ transactions, matches: duplicates, origin: "expense", editId: editingExpenseId ?? undefined });
      setFeedback("Suspeita de duplicidade encontrada. Aprove para computar ou exclua a nova despesa.");
      return;
    }

    saveExpenses(transactions, editingExpenseId ?? undefined);
  }

  function attachReceiptToExistingExpense(
    existing: Transaction,
    incoming: Omit<Transaction, "id" | "createdAt">
  ) {
    actions.updateTransaction(existing.id, buildReceiptAttachmentPatch(existing, incoming));
    setSelectedMonth(existing.date.slice(0, 7));
    setReceiptDraft(null);
    setDuplicateReview(null);
    setEditingExpenseId(null);
    setFeedback(
      `Nota anexada a despesa existente "${existing.description}" sem gerar novo valor. Os itens lidos ficam disponiveis no detalhe do lancamento.`
    );
    setForm((current) => ({
      ...current,
      description: "",
      amount: "",
      otherCategoryDescription: "",
      paymentMethod: "other",
      paymentRecipient: "",
      notes: "",
      plan: "single"
    }));
  }

  function saveExpenses(transactions: Array<Omit<Transaction, "id" | "createdAt">>, editId?: string) {
    if (editId) {
      actions.updateTransaction(editId, transactions[0]);
    } else {
      actions.addTransactions(transactions);
    }

    setFeedback(
      editId
        ? "Despesa atualizada com sucesso."
        : form.plan === "installment"
        ? `${transactions.length} parcelas foram criadas nos meses futuros.`
        : form.plan === "recurring"
          ? `${transactions.length} despesas recorrentes foram criadas.`
          : "Despesa salva com sucesso."
    );
    setSelectedMonth(form.date.slice(0, 7));
    setReceiptDraft(null);
    setDuplicateReview(null);
    setEditingExpenseId(null);
    setForm((current) => ({
      ...current,
      description: "",
      amount: "",
      otherCategoryDescription: "",
      paymentMethod: "other",
      paymentRecipient: "",
      notes: "",
      plan: "single"
    }));
  }

  function editExpense(transaction: Transaction) {
    setEditingExpenseId(transaction.id);
    setReceiptDraft(null);
    setDuplicateReview(null);
    setStatementDraft(null);
    setForm((current) => ({
      ...current,
      description: transaction.description,
      amount: String(transaction.amount),
      category: transaction.category,
      otherCategoryDescription: transaction.otherCategoryDescription ?? "",
      person: transaction.person,
      accountId: transaction.accountId ?? DEFAULT_FINANCE_ACCOUNT_ID,
      date: transaction.date,
      paymentMethod: transaction.paymentMethod ?? "other",
      paymentRecipient: transaction.paymentRecipient ?? "",
      plan: "single",
      notes: transaction.notes ?? ""
    }));
    setFeedback("Editando despesa existente. Ao confirmar, ela sera atualizada na nuvem.");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <p className="mt-2 text-sm opacity-90">{formatCurrency(monthTotal)} em despesas realizadas.</p>
            {futureMonthTotal > 0 ? (
              <p className="mt-1 text-xs font-bold text-cyan-100">
                {formatCurrency(futureMonthTotal)} futuro(s) fora do saldo realizado.
              </p>
            ) : null}
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

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={isReadingReceipt}>
              <FileImage className="size-4" aria-hidden="true" />
              Anexar nota
            </Button>
            <Button variant="ghost" onClick={() => cameraRef.current?.click()} disabled={isReadingReceipt}>
              <Camera className="size-4" aria-hidden="true" />
              Abrir camera
            </Button>
            <Button variant="secondary" onClick={() => statementRef.current?.click()} disabled={isReadingStatement}>
              <FileText className="size-4" aria-hidden="true" />
              Anexar extrato
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
            <input
              ref={statementRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleStatementFile(file);
                }
                event.target.value = "";
              }}
            />
          </div>

          <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
            {feedback}
          </p>

          {duplicateReview ? (
            <DuplicateTransactionReview
              matches={duplicateReview.matches}
              onCancel={() => {
                setDuplicateReview(null);
                setFeedback("Salvamento cancelado. Revise os dados antes de tentar novamente.");
              }}
                  onConfirm={() =>
                    duplicateReview.origin === "statement"
                      ? saveStatementTransactions(duplicateReview.transactions, duplicateReview.reconciliations ?? [])
                      : saveExpenses(duplicateReview.transactions, duplicateReview.editId)
                  }
            />
          ) : null}

          {statementDraft ? (
            <StatementDraftReview
              draft={statementDraft}
              onChangeLine={updateStatementLine}
              onRemoveLine={removeStatementLine}
              onCancel={() => {
                setStatementDraft(null);
                setFeedback("Importacao do extrato cancelada.");
              }}
              onImport={importStatementLines}
            />
          ) : null}

          {receiptDraft ? (
            <FinancialDocumentReview
              draft={receiptDraft}
              categories={expenseCategories}
              persons={personOptions}
              dateField="documentDate"
              dateLabel="Data da nota"
              onChange={updateReceiptDraft}
            />
          ) : null}

          {receiptDraft?.items?.length ? <DraftItems items={receiptDraft.items} /> : null}

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

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Label>
                Categoria
                <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {expenseCategories.map((category) => (
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
                Carteira
                <Select
                  value={selectedExpenseAccountId}
                  onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
                >
                  {state.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
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

            {form.category === "Outros" ? (
              <Label>
                Descrever outros
                <Input
                  value={form.otherCategoryDescription}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, otherCategoryDescription: event.target.value }))
                  }
                  placeholder="Opcional: descreva a categoria"
                />
              </Label>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <Label>
                Forma
                <Select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))
                  }
                >
                  <option value="other">Outro</option>
                  <option value="cash">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="boleto">Boleto</option>
                  <option value="card">Cartao</option>
                </Select>
              </Label>
              {form.paymentMethod === "pix" ? (
                <Label>
                  Para quem foi feito
                  <Input
                    value={form.paymentRecipient}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, paymentRecipient: event.target.value }))
                    }
                    placeholder="Nome da pessoa ou empresa"
                    required
                  />
                </Label>
              ) : null}
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
              {editingExpenseId ? "Atualizar despesa" : "Confirmar despesa"}
            </Button>
            {editingExpenseId ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => {
                  setEditingExpenseId(null);
                  setFeedback("Edicao cancelada. Voce pode cadastrar uma nova despesa.");
                  setForm((current) => ({
                    ...current,
                    description: "",
                    amount: "",
                    otherCategoryDescription: "",
                    paymentMethod: "other",
                    paymentRecipient: "",
                    notes: "",
                    plan: "single"
                  }));
                }}
              >
                Cancelar edicao
              </Button>
            ) : null}
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
            <p className="text-sm font-bold text-muted">Total de despesas realizadas</p>
            <strong className={cn("mt-2 block font-serif text-4xl", financialValueClass(monthTotal))}>{formatCurrency(monthTotal)}</strong>
            {futureMonthTotal > 0 ? (
              <p className="mt-2 text-sm font-bold text-cyan-100">
                Futuro previsto neste mes: {formatCurrency(futureMonthTotal)}
              </p>
            ) : null}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-cream">{transaction.description}</strong>
                        {transaction.date > today ? <Badge tone="neutral">Futuro</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {transaction.category} - {transaction.date}
                        {transaction.paymentMethod === "pix" && transaction.paymentRecipient
                          ? ` - Pix para ${transaction.paymentRecipient}`
                          : ""}
                        {transaction.otherCategoryDescription ? ` - ${transaction.otherCategoryDescription}` : ""}
                        {transaction.installmentTotal
                          ? ` - parcela ${transaction.installmentNumber}/${transaction.installmentTotal}`
                          : ""}
                        {transaction.recurring ? " - recorrente" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" className="min-h-9 px-3" onClick={() => editExpense(transaction)}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" className="min-h-9 px-3" onClick={() => actions.removeTransaction(transaction.id)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <strong className={cn("mt-2 block", financialValueClass(transaction.amount))}>{formatCurrency(transaction.amount)}</strong>
                  <AttachmentLink
                    dataUrl={transaction.attachmentDataUrl}
                    storagePath={transaction.attachmentStoragePath}
                    imageName={transaction.attachmentImageName}
                  />
                  <DocumentItemsPanel items={transaction.documentItems} title="Itens guardados da nota/extrato" />
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
  otherCategoryDescription,
  person,
  accountId,
  date,
  paymentMethod,
  paymentRecipient,
  plan,
  months,
  installments,
  notes,
  attachmentImageName,
  attachmentDataUrl,
  attachmentStoragePath,
  attachmentMimeType,
  attachmentSize,
  documentItems,
  fiscalDocument,
  source
}: {
  description: string;
  amount: number;
  category: string;
  otherCategoryDescription?: string;
  person: Person;
  accountId: string;
  date: string;
  paymentMethod?: PaymentMethod;
  paymentRecipient?: string;
  plan: ExpensePlan;
  months: number;
  installments: number;
  notes?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  documentItems?: FinancialDocumentDraft["items"];
  fiscalDocument?: FinancialDocumentDraft["fiscalDocument"];
  source: "manual" | "receipt";
}): Array<Omit<Transaction, "id" | "createdAt">> {
  const count = plan === "recurring" ? clampCount(months, 1, 60) : plan === "installment" ? clampCount(installments, 1, 120) : 1;
  const groupId = `${plan}_${crypto.randomUUID()}`;

  return Array.from({ length: count }, (_, index) => ({
    type: "expense" as TransactionType,
    description: plan === "installment" ? `${description} (${index + 1}/${count})` : description,
    amount,
    category,
    otherCategoryDescription,
    person,
    accountId,
    date: addMonths(date, index),
    paymentMethod,
    paymentRecipient,
    recurring: plan === "recurring",
    recurrenceGroupId: plan === "recurring" ? groupId : undefined,
    installmentGroupId: plan === "installment" ? groupId : undefined,
    installmentNumber: plan === "installment" ? index + 1 : undefined,
    installmentTotal: plan === "installment" ? count : undefined,
    source,
    receiptImageName: attachmentImageName,
    attachmentImageName,
    attachmentDataUrl,
    attachmentStoragePath,
    attachmentMimeType,
    attachmentSize,
    documentItems,
    fiscalDocument,
    notes
  }));
}

function buildTransactionsFromStatement(draft: BankStatementDraft): Array<Omit<Transaction, "id" | "createdAt">> {
  return draft.lines.map((line) => ({
    type: line.type,
    description: line.description,
    amount: line.amount,
    category: line.category,
    otherCategoryDescription: line.otherCategoryDescription,
    person: line.person,
    date: line.date,
    recurring: false,
    source: "statement",
    paymentMethod: line.paymentMethod,
    paymentRecipient: line.paymentRecipient,
    attachmentImageName: draft.attachmentImageName,
    attachmentDataUrl: draft.attachmentDataUrl,
    attachmentStoragePath: draft.attachmentStoragePath,
    attachmentMimeType: draft.attachmentMimeType,
    attachmentSize: draft.attachmentSize,
    documentItems: [
      {
        name: line.description,
        amount: line.amount,
        date: line.date,
        type: line.type,
        category: line.category,
        paymentMethod: line.paymentMethod,
        paymentRecipient: line.paymentRecipient
      }
    ],
    notes: line.notes || draft.notes
  }));
}

function findSameDaySameAmountExpense(
  existingTransactions: Transaction[],
  incoming?: Omit<Transaction, "id" | "createdAt">
) {
  if (!incoming || incoming.type !== "expense") {
    return null;
  }

  return (
    existingTransactions.find(
      (existing) =>
        existing.type === "expense" &&
        existing.date === incoming.date &&
        areSameMoneyForReconciliation(existing.amount, incoming.amount)
    ) ?? null
  );
}

function buildReceiptAttachmentPatch(
  existing: Transaction,
  incoming: Omit<Transaction, "id" | "createdAt">
): Partial<Omit<Transaction, "id" | "createdAt">> {
  return {
    description: chooseReceiptEnhancedDescription(existing.description, incoming.description, existing.source),
    category: incoming.category || existing.category,
    otherCategoryDescription: incoming.otherCategoryDescription || existing.otherCategoryDescription,
    paymentMethod: incoming.paymentMethod || existing.paymentMethod,
    paymentRecipient: incoming.paymentRecipient || existing.paymentRecipient,
    source: incoming.source || existing.source || "receipt",
    receiptImageName: incoming.receiptImageName || existing.receiptImageName,
    attachmentImageName: incoming.attachmentImageName || existing.attachmentImageName,
    attachmentDataUrl: incoming.attachmentDataUrl || existing.attachmentDataUrl,
    attachmentStoragePath: incoming.attachmentStoragePath || existing.attachmentStoragePath,
    attachmentMimeType: incoming.attachmentMimeType || existing.attachmentMimeType,
    attachmentSize: incoming.attachmentSize || existing.attachmentSize,
    documentItems: mergeDocumentItems(incoming.documentItems, existing.documentItems),
    fiscalDocument: incoming.fiscalDocument || existing.fiscalDocument,
    notes: mergeReceiptAttachmentNotes(existing.notes, incoming)
  };
}

function chooseReceiptEnhancedDescription(existingDescription: string, incomingDescription?: string, existingSource?: string) {
  const candidate = incomingDescription?.trim();

  if (!candidate) {
    return existingDescription;
  }

  const normalizedExisting = normalizeReconciliationText(existingDescription);
  const normalizedCandidate = normalizeReconciliationText(candidate);

  if (!normalizedExisting || normalizedExisting === normalizedCandidate || normalizedExisting.includes(normalizedCandidate)) {
    return existingDescription;
  }

  if (normalizedCandidate.includes(normalizedExisting)) {
    return candidate;
  }

  if (existingSource === "statement") {
    return candidate;
  }

  const genericDescriptions = new Set(["despesa", "compra", "mercado", "pagamento", "pix", "boleto", "cartao", "nota", "sem descricao"]);
  return genericDescriptions.has(normalizedExisting) ? candidate : existingDescription;
}

function mergeDocumentItems(
  existingItems: Transaction["documentItems"],
  incomingItems: Transaction["documentItems"]
) {
  const merged = new Map<string, NonNullable<Transaction["documentItems"]>[number]>();

  [...(existingItems ?? []), ...(incomingItems ?? [])].forEach((item) => {
    const key = [
      normalizeReconciliationText(item.name),
      item.amount ?? "",
      item.quantity ?? "",
      item.code ?? "",
      item.ean ?? ""
    ].join("|");

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values());
}

function mergeReceiptAttachmentNotes(existingNotes: string | undefined, incoming: Omit<Transaction, "id" | "createdAt">) {
  const receiptName = incoming.attachmentImageName || incoming.receiptImageName;
  const itemCount = incoming.documentItems?.length ?? 0;
  const note = [
    "Nota conciliada com lancamento ja existente.",
    receiptName ? `Anexo: ${receiptName}.` : "",
    itemCount > 0 ? `${itemCount} item(ns) da nota foram adicionados ao lancamento.` : "",
    incoming.fiscalDocument?.accessKey ? `Chave fiscal: ${incoming.fiscalDocument.accessKey}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return [existingNotes, note].filter(Boolean).join("\n");
}

function findBillReconciliationMatches(
  transactions: Array<Omit<Transaction, "id" | "createdAt">>,
  bills: PayableBill[]
): BillReconciliationMatch[] {
  const usedBillIds = new Set<string>();
  const matches: BillReconciliationMatch[] = [];

  transactions.forEach((transaction, transactionIndex) => {
    if (transaction.type !== "expense") {
      return;
    }

    const bill = bills.find((candidate) => {
      if (usedBillIds.has(candidate.id) || candidate.status === "paid") {
        return false;
      }

      return isStrongBillReconciliationMatch(transaction, candidate);
    });

    if (!bill) {
      return;
    }

    usedBillIds.add(bill.id);
    matches.push({ bill, transaction, transactionIndex });
  });

  return matches;
}

function isStrongBillReconciliationMatch(
  transaction: Omit<Transaction, "id" | "createdAt">,
  bill: PayableBill
) {
  if (!areSameMoneyForReconciliation(transaction.amount, bill.amount)) {
    return false;
  }

  const daysFromDueDate = Math.abs(diffDateDays(transaction.date, bill.dueDate));

  if (daysFromDueDate > 3) {
    return false;
  }

  const transactionDescription = normalizeReconciliationText(transaction.description);
  const billTitle = normalizeReconciliationText(bill.title);
  const transactionRecipient = normalizeReconciliationText(transaction.paymentRecipient ?? "");
  const billRecipient = normalizeReconciliationText(bill.paymentRecipient ?? "");
  const recipientMatch = Boolean(
    transactionRecipient &&
      billRecipient &&
      (transactionRecipient.includes(billRecipient) || billRecipient.includes(transactionRecipient))
  );
  const titleMatch = Boolean(
    transactionDescription &&
      billTitle &&
      (transactionDescription.includes(billTitle) || billTitle.includes(transactionDescription))
  );
  const methodMatch = Boolean(
    transaction.paymentMethod &&
      bill.paymentMethod &&
      transaction.paymentMethod === bill.paymentMethod &&
      bill.paymentMethod !== "other"
  );

  return recipientMatch || titleMatch || (methodMatch && daysFromDueDate <= 1);
}

function mergeReconciliationNote(
  existingNotes: string | undefined,
  transaction: Omit<Transaction, "id" | "createdAt">
) {
  const reconciliationNote = `Conciliada automaticamente pelo extrato em ${transaction.date}: ${transaction.description}.`;
  return [existingNotes, reconciliationNote].filter(Boolean).join("\n");
}

function areSameMoneyForReconciliation(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

function diffDateDays(left: string, right: string) {
  const leftTime = Date.parse(`${left}T12:00:00`);
  const rightTime = Date.parse(`${right}T12:00:00`);

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((leftTime - rightTime) / 86_400_000);
}

function normalizeReconciliationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findInternalDuplicateMatches(transactions: Array<Omit<Transaction, "id" | "createdAt">>) {
  const seen = new Map<string, Omit<Transaction, "id" | "createdAt">>();
  const matches: Array<[Omit<Transaction, "id" | "createdAt">, Omit<Transaction, "id" | "createdAt">]> = [];

  transactions.forEach((transaction) => {
    const key = `${transaction.date}_${normalizeAmountKey(transaction.amount)}`;
    const existing = seen.get(key);

    if (existing) {
      matches.push([existing, transaction]);
      return;
    }

    seen.set(key, transaction);
  });

  return matches;
}

function StatementDraftReview({
  draft,
  onChangeLine,
  onRemoveLine,
  onCancel,
  onImport
}: {
  draft: BankStatementDraft;
  onChangeLine: (index: number, patch: Partial<StatementTransactionDraft>) => void;
  onRemoveLine: (index: number) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const totals = draft.lines.reduce(
    (accumulator, line) => {
      accumulator[line.type] += line.amount;
      return accumulator;
    },
    { income: 0, expense: 0 }
  );
  const repeated = findInternalDuplicateMatches(
    draft.lines.map((line) => ({
      type: line.type,
      description: line.description,
      amount: line.amount,
      category: line.category,
      person: line.person,
      date: line.date,
      recurring: false
    }))
  );

  return (
    <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl font-bold text-cyan-50">Extrato lido pela MAYA</h3>
            <Badge tone="info">{draft.lines.length} linha(s)</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-cyan-100">
            Confira entradas, saidas, Pix e categorias antes de importar para a nuvem.
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-72">
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <span className="text-muted">Renda</span>
            <strong className="block text-emerald-100">{formatCurrency(totals.income)}</strong>
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
            <span className="text-muted">Despesa</span>
            <strong className="block text-amber-100">{formatCurrency(totals.expense)}</strong>
          </div>
        </div>
      </div>

      {repeated.length > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
          Existem {repeated.length} valor(es) repetidos no mesmo dia dentro do extrato. Confirme antes de importar.
        </p>
      ) : null}

      {draft.lines.length === 0 ? (
        <p className="rounded-lg border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
          Nenhuma linha confiavel foi encontrada neste extrato.
        </p>
      ) : (
        <div className="grid gap-3">
          {draft.lines.map((line, index) => {
            const categories = line.type === "income" ? incomeCategories : expenseCategories;

            return (
              <div key={index} className="rounded-lg border border-cyan-200/20 bg-moss-950/35 p-3">
                <div className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_130px]">
                  <Label>
                    Tipo
                    <Select
                      value={line.type}
                      onChange={(event) => {
                        const type = event.target.value as StatementTransactionDraft["type"];
                        onChangeLine(index, {
                          type,
                          category: type === "income" ? incomeCategories[0] : expenseCategories[0]
                        });
                      }}
                    >
                      <option value="income">Renda</option>
                      <option value="expense">Despesa</option>
                    </Select>
                  </Label>
                  <Label>
                    Descricao
                    <Input
                      value={line.description}
                      onChange={(event) => onChangeLine(index, { description: event.target.value })}
                    />
                  </Label>
                  <Label>
                    Valor
                    <Input
                      inputMode="decimal"
                      value={line.amount > 0 ? String(line.amount) : ""}
                      onChange={(event) => onChangeLine(index, { amount: parseMoney(event.target.value) })}
                    />
                  </Label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Label>
                    Data
                    <Input type="date" value={line.date} onChange={(event) => onChangeLine(index, { date: event.target.value })} />
                  </Label>
                  <Label>
                    Categoria
                    <Select value={line.category} onChange={(event) => onChangeLine(index, { category: event.target.value })}>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <Label>
                    Pessoa
                    <Select
                      value={line.person}
                      onChange={(event) => onChangeLine(index, { person: event.target.value as Person })}
                    >
                      {personOptions.map((person) => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <Label>
                    Forma
                    <Select
                      value={line.paymentMethod ?? "other"}
                      onChange={(event) => onChangeLine(index, { paymentMethod: event.target.value as PaymentMethod })}
                    >
                      <option value="other">Outro</option>
                      <option value="cash">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="boleto">Boleto</option>
                      <option value="card">Cartao</option>
                    </Select>
                  </Label>
                  <Button variant="danger" className="self-end" onClick={() => onRemoveLine(index)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remover
                  </Button>
                </div>
                {line.paymentMethod === "pix" ? (
                  <Label className="mt-3">
                    Para quem foi feito
                    <Input
                      value={line.paymentRecipient ?? ""}
                      onChange={(event) => onChangeLine(index, { paymentRecipient: event.target.value })}
                      placeholder="Nome da pessoa ou empresa"
                      required
                    />
                  </Label>
                ) : null}
                {line.category === "Outros" ? (
                  <Label className="mt-3">
                    Descrever outros
                    <Input
                      value={line.otherCategoryDescription ?? ""}
                      onChange={(event) => onChangeLine(index, { otherCategoryDescription: event.target.value })}
                      placeholder="Opcional: detalhe a categoria"
                    />
                  </Label>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar extrato
        </Button>
        <Button onClick={onImport} disabled={draft.lines.length === 0}>
          <Check className="size-4" aria-hidden="true" />
          Importar linhas
        </Button>
      </div>
    </div>
  );
}

function buildDraftFeedback(message?: string, draft?: FinancialDocumentDraft) {
  if (!draft || draft.missingFields.length === 0) {
    return message ?? "Rascunho criado. Revise antes de salvar.";
  }

  return `${message ?? "Rascunho criado."} Complete manualmente: ${draft.missingFields.join(", ")}.`;
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

function parseMoney(value: string) {
  const number = parseFinancialAmountInput(value);

  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeAmountKey(value: number) {
  return Number.isFinite(value) ? String(value) : "invalid";
}

function DuplicateTransactionReview({
  matches,
  onCancel,
  onConfirm
}: {
  matches: TransactionDuplicateMatch[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4">
      <h3 className="font-serif text-xl font-bold text-amber-100">Suspeita de duplicidade</h3>
      <p className="mt-2 text-sm leading-6 text-amber-50">
        {matches.length > 0
          ? "Ja existe lancamento com valor igual em data igual ou proxima. Escolha se deseja computar mesmo assim ou excluir o novo lancamento."
          : "O lote possui valores repetidos no mesmo dia. Escolha se deseja computar mesmo assim ou excluir o lote novo."}
      </p>
      <div className="mt-3 grid gap-2">
        {matches.slice(0, 4).map((match) => (
          <div key={`${match.existing.id}_${match.incoming.date}_${match.incoming.amount}`} className="rounded-lg border border-amber-200/20 bg-moss-950/40 p-3 text-sm">
            <strong className="text-cream">{match.existing.description}</strong>
            <p className="mt-1 text-amber-50">
              {match.existing.date} - {formatCurrency(match.existing.amount)} - novo: {match.incoming.description}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Excluir novo
        </Button>
        <Button onClick={onConfirm}>Computar mesmo assim</Button>
      </div>
    </div>
  );
}

function DraftItems({ items }: { items: NonNullable<FinancialDocumentDraft["items"]> }) {
  return (
    <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <h3 className="font-serif text-xl font-bold text-cyan-50">Itens lidos pela MAYA</h3>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 8).map((item, index) => (
          <div key={`${item.name}_${index}`} className="grid gap-1 rounded-lg border border-cyan-200/20 bg-moss-950/35 p-3 text-sm sm:grid-cols-[1fr_auto]">
            <span className="text-cyan-50">{item.name}</span>
            <strong className={typeof item.amount === "number" ? financialValueClass(item.amount) : "text-bronze"}>
              {typeof item.amount === "number" ? formatCurrency(item.amount) : "valor nao lido"}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function withStoredAttachment(
  draft: FinancialDocumentDraft,
  attachment: FinanceAttachmentUpload
): FinancialDocumentDraft {
  return {
    ...draft,
    attachmentImageName: attachment.fileName,
    attachmentDataUrl: attachment.storagePath ? undefined : attachment.imageDataUrl,
    attachmentStoragePath: attachment.storagePath,
    attachmentMimeType: attachment.mimeType,
    attachmentSize: attachment.size
  };
}

function withStoredStatementAttachment(
  draft: BankStatementDraft,
  attachment: FinanceAttachmentUpload
): BankStatementDraft {
  return {
    ...draft,
    attachmentImageName: attachment.fileName,
    attachmentDataUrl: attachment.storagePath ? undefined : attachment.imageDataUrl,
    attachmentStoragePath: attachment.storagePath,
    attachmentMimeType: attachment.mimeType,
    attachmentSize: attachment.size
  };
}

function clampCount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}
