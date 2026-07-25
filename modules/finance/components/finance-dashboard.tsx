"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  CalendarDays,
  FileImage,
  HeartPulse,
  Download,
  LineChart,
  PiggyBank,
  Plus,
  RefreshCcw,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wallet
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { VisualMetric } from "@/components/ui/visual-metric";
import { cn, financialValueClass, formatCurrency, formatPercent, toInputDate } from "@/lib/utils";
import { getTransactionCategoriesByType } from "../data/defaults";
import {
  buildBudgetSummary,
  buildFinancialHealthAlerts,
  buildInsights,
  buildMayaLocalAnalysis,
  buildMonthlyFlow,
  calculateSummary,
  getGoalProgress
} from "../lib/calculations";
import { parseTransactionsCsv } from "../lib/csv";
import { findTransactionDuplicateMatches, type TransactionDuplicateMatch } from "../lib/duplicates";
import { fileToFinanceAttachment, type FinanceAttachmentUpload } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type {
  FinancialDocumentDraft,
  GoalPriority,
  GoalType,
  PaymentMethod,
  Person,
  Transaction,
  TransactionType
} from "../types";
import { DocumentItemsPanel } from "./document-items-panel";
import { FinancialHealthAlerts } from "./financial-health-alerts";
import { FinancialDocumentReview } from "./financial-document-review";
import { AttachmentLink } from "./attachment-link";

const transactionTypeLabel: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  investment: "Investimento",
  transfer: "Transferencia"
};

const personOptions: Person[] = ["Pessoa 1", "Pessoa 2", "Casal"];
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

type TransactionDuplicateReview = {
  transaction: Omit<Transaction, "id" | "createdAt">;
  matches: TransactionDuplicateMatch[];
};

type TransactionImportDuplicateReview = {
  transactions: Transaction[];
  matches: TransactionDuplicateMatch[];
};

export function FinanceDashboard() {
  const { state, isHydrated, actions } = useFinanceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transactionImageRef = useRef<HTMLInputElement>(null);
  const [transactionDraft, setTransactionDraft] = useState<FinancialDocumentDraft | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<TransactionDuplicateReview | null>(null);
  const [importDuplicateReview, setImportDuplicateReview] = useState<TransactionImportDuplicateReview | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    type: "expense" as TransactionType,
    description: "",
    amount: "",
    category: "Alimentacao",
    otherCategoryDescription: "",
    person: "Casal" as Person,
    date: toInputDate(new Date()),
    paymentMethod: "other" as PaymentMethod,
    paymentRecipient: "",
    recurring: false
  });
  const [goalForm, setGoalForm] = useState({
    name: "",
    type: "reserve" as GoalType,
    targetAmount: "",
    currentAmount: "",
    dueDate: toInputDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)),
    priority: "medium" as GoalPriority
  });
  const [feedback, setFeedback] = useState("Dados salvos automaticamente.");

  const summary = useMemo(() => calculateSummary(state), [state]);
  const flow = useMemo(() => buildMonthlyFlow(state.transactions), [state.transactions]);
  const insights = useMemo(() => buildInsights(state), [state]);
  const maya = useMemo(() => buildMayaLocalAnalysis(state), [state]);
  const budgetSummary = useMemo(() => buildBudgetSummary(state, summary.currentMonth), [state, summary.currentMonth]);
  const healthAlerts = useMemo(() => buildFinancialHealthAlerts(state), [state]);
  const activeCategories = useMemo(
    () => getTransactionCategoriesByType(transactionForm.type),
    [transactionForm.type]
  );
  const maxFlowValue = Math.max(...flow.flatMap((item) => [item.income, item.expenses, item.investments]), 1);

  async function importTransactionImage(file: File) {
    setFeedback("MAYA esta lendo o anexo e preparando um rascunho...");

    try {
      const attachment = await fileToFinanceAttachment(file);
      const documentKind = transactionForm.type === "income" ? "income" : "expense";
      const response = await fetch("/api/maya/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileName: file.name,
          documentKind
        })
      });
      const result = (await response.json()) as {
        financialDraft?: FinancialDocumentDraft;
        message?: string;
      };

      if (!result.financialDraft) {
        setFeedback(result.message ?? "Nao consegui ler o anexo. Preencha manualmente.");
        return;
      }

      const draft = withStoredAttachment(result.financialDraft, attachment);
      const date = draft.entryDate || draft.documentDate || draft.dueDate || "";
      setTransactionDraft(draft);
      setTransactionForm((current) => ({
        ...current,
        type: draft.kind === "income" ? "income" : draft.kind === "expense" ? "expense" : current.type,
        description: draft.description || draft.title,
        amount: draft.amount > 0 ? String(draft.amount) : current.amount,
        category: draft.category || current.category,
        otherCategoryDescription: draft.otherCategoryDescription ?? current.otherCategoryDescription,
        person: draft.person,
        date,
        paymentMethod: draft.paymentMethod ?? current.paymentMethod,
        paymentRecipient: draft.paymentRecipient ?? current.paymentRecipient
      }));
      setFeedback(buildDraftFeedback(result.message, draft));
    } catch (error) {
      setFeedback(
        error instanceof Error && error.message === "image_too_large"
          ? "A imagem ficou grande demais para leitura. Tente uma foto mais proxima, nitida e com menos fundo ao redor."
          : "Nao consegui ler o anexo. Preencha a transacao manualmente."
      );
    }
  }

  function updateTransactionDraft(patch: Partial<FinancialDocumentDraft>) {
    setTransactionDraft((current) => {
      if (!current) {
        return current;
      }

      const updated = { ...current, ...patch };

      setTransactionForm((formCurrent) => ({
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
          "entryDate" in patch || "documentDate" in patch || "dueDate" in patch
            ? updated.entryDate || updated.documentDate || updated.dueDate || formCurrent.date
            : formCurrent.date
      }));

      return updated;
    });
  }

  function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(transactionForm.amount.replace(",", "."));

    if (!transactionForm.description.trim() || !Number.isFinite(amount) || amount <= 0 || !transactionForm.date) {
      setFeedback("Preencha descricao, valor e data para salvar a transacao.");
      return;
    }

    if (transactionForm.type === "expense" && transactionForm.paymentMethod === "pix" && !transactionForm.paymentRecipient.trim()) {
      setFeedback("Quando a despesa for Pix, informe para quem foi feito antes de salvar.");
      return;
    }

    const transaction = {
      type: transactionForm.type,
      description: transactionForm.description.trim(),
      amount,
      category: transactionForm.category,
      otherCategoryDescription:
        transactionForm.category === "Outros" ? transactionForm.otherCategoryDescription.trim() : undefined,
      person: transactionForm.person,
      date: transactionForm.date,
      recurring: transactionForm.recurring,
      source: transactionDraft ? "receipt" : "manual",
      paymentMethod: transactionForm.type === "expense" ? transactionForm.paymentMethod : undefined,
      paymentRecipient:
        transactionForm.type === "expense" ? transactionForm.paymentRecipient.trim() || undefined : undefined,
      receiptImageName: transactionDraft?.attachmentImageName,
      attachmentImageName: transactionDraft?.attachmentImageName,
      attachmentDataUrl: transactionDraft?.attachmentDataUrl,
      attachmentStoragePath: transactionDraft?.attachmentStoragePath,
      attachmentMimeType: transactionDraft?.attachmentMimeType,
      attachmentSize: transactionDraft?.attachmentSize,
      documentItems: transactionDraft?.items,
      notes: transactionDraft?.notes
    } satisfies Omit<Transaction, "id" | "createdAt">;

    const duplicates = findTransactionDuplicateMatches(state.transactions, [transaction]);

    if (duplicates.length > 0) {
      setDuplicateReview({ transaction, matches: duplicates });
      setFeedback("Suspeita de duplicidade encontrada. Aprove para computar ou exclua o novo lancamento.");
      return;
    }

    saveTransaction(transaction);
  }

  function saveTransaction(transaction: Omit<Transaction, "id" | "createdAt">) {
    actions.addTransaction(transaction);
    setTransactionDraft(null);
    setDuplicateReview(null);
    setTransactionForm((current) => ({
      ...current,
      description: "",
      amount: "",
      otherCategoryDescription: "",
      paymentMethod: "other",
      paymentRecipient: ""
    }));
    setFeedback("Transacao salva e indicadores recalculados.");
  }

  function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = Number(goalForm.targetAmount.replace(",", "."));
    const currentAmount = Number(goalForm.currentAmount.replace(",", ".") || 0);

    if (!goalForm.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFeedback("Preencha nome e valor alvo valido para salvar a meta.");
      return;
    }

    actions.addGoal({
      name: goalForm.name.trim(),
      type: goalForm.type,
      targetAmount,
      currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
      dueDate: goalForm.dueDate,
      priority: goalForm.priority
    });

    setGoalForm((current) => ({
      ...current,
      name: "",
      targetAmount: "",
      currentAmount: ""
    }));
    setFeedback("Meta criada com sucesso.");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maya-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("Backup exportado em JSON.");
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const transactions = parseTransactionsCsv(text);

    if (transactions.length === 0) {
      setFeedback("Nenhuma transacao valida foi encontrada no CSV.");
      return;
    }

    const duplicateCandidates = transactions.map(({ id: _id, createdAt: _createdAt, ...transaction }) => transaction);
    const duplicates = findTransactionDuplicateMatches(state.transactions, duplicateCandidates);

    if (duplicates.length > 0) {
      setImportDuplicateReview({ transactions, matches: duplicates });
      setFeedback("Suspeita de duplicidade no extrato importado. Aprove para computar ou exclua o lote novo.");
      return;
    }

    actions.importTransactions(transactions);
    setFeedback(`${transactions.length} transacao(oes) importada(s) do CSV.`);
  }

  return (
    <AppShell>
      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="glass-panel flex flex-col rounded-card p-5 lg:min-h-[calc(100vh-2rem)]">
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl border border-terracotta/40 bg-terracotta/10 text-terracotta">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-serif text-4xl font-bold leading-none text-bronze">Maya</p>
                <p className="text-xs font-bold text-muted">Organizar hoje. Construir o amanha.</p>
              </div>
            </div>
            <Badge tone="info">Sem dados ficticios</Badge>
          </div>

          <nav className="grid gap-2" aria-label="Modulos do Maya">
            {[
              ["Dashboard", Wallet],
              ["Transacoes", LineChart],
              ["Metas", Target],
              ["Viagens", CalendarDays],
              ["Insights", Sparkles]
            ].map(([label, Icon]) => (
              <a
                key={label as string}
                href={`#${String(label).toLowerCase()}`}
                className="flex min-h-12 items-center gap-3 rounded-lg border border-transparent px-3 text-sm font-black text-muted transition hover:border-bronze/30 hover:bg-cream/[0.05] hover:text-bronze"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label as string}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border border-bronze/20 bg-cream/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-terracotta">Privacidade</p>
            <p className="mt-2 text-sm text-muted">
              Exporte um backup sempre que quiser guardar uma copia dos dados.
            </p>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          <header className="glass-panel rounded-card p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="eyebrow">Dashboard financeiro do casal</p>
                <h1 className="mt-1 font-serif text-4xl font-bold leading-tight text-bronze md:text-5xl">
                  Uma visao clara para decidir com calma.
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
                  Cadastre receitas, despesas e metas. O Maya recalcula os indicadores e transforma informacao
                  financeira em proximos passos praticos.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={exportBackup}>
                  <Download className="size-4" aria-hidden="true" />
                  Exportar
                </Button>
                <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" aria-hidden="true" />
                  Importar CSV
                </Button>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void importCsv(file);
                      event.target.value = "";
                    }
                  }}
                />
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
              {isHydrated ? feedback : "Carregando dados..."}
            </p>
            {duplicateReview ? (
              <DuplicateTransactionReview
                matches={duplicateReview.matches}
                onCancel={() => {
                  setDuplicateReview(null);
                  setFeedback("Salvamento cancelado. Revise os dados antes de tentar novamente.");
                }}
                onConfirm={() => saveTransaction(duplicateReview.transaction)}
              />
            ) : null}
            {importDuplicateReview ? (
              <DuplicateTransactionReview
                matches={importDuplicateReview.matches}
                onCancel={() => {
                  setImportDuplicateReview(null);
                  setFeedback("Importacao cancelada. Revise o extrato antes de tentar novamente.");
                }}
                onConfirm={() => {
                  actions.importTransactions(importDuplicateReview.transactions);
                  setImportDuplicateReview(null);
                  setFeedback(`${importDuplicateReview.transactions.length} transacao(oes) importada(s) do CSV.`);
                }}
              />
            ) : null}
          </header>

          <LedPanel className="p-5" glow="cyan">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
              <div>
                <p className="eyebrow">Resumo do casal</p>
                <h2 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
                  {maya.trend === "growth" ? "O mes esta evoluindo." : maya.trend === "drop" ? "Hora de ajustar a rota." : "Cenario estavel e previsivel."}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{maya.message}</p>
              </div>
              <div className="rounded-2xl border border-bronze/20 bg-bronze/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Saude financeira</p>
                <strong className="mt-2 block font-serif text-5xl text-bronze">{maya.healthScore}/100</strong>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Orcamento usado: {budgetSummary.totalLimit > 0 ? formatPercent(budgetSummary.usedPercent) : "sem limites cadastrados"}.
                </p>
              </div>
            </div>
          </LedPanel>

          <FinancialHealthAlerts alerts={healthAlerts} />

          <section id="dashboard" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <VisualMetric
              icon={<Wallet className="size-5" />}
              label="Saldo disponivel"
              value={formatCurrency(summary.availableBalance)}
              tone={summary.availableBalance >= 0 ? "success" : "warning"}
            />
            <VisualMetric
              icon={<ArrowUpCircle className="size-5" />}
              label="Receitas do mes"
              value={formatCurrency(summary.income)}
              tone="success"
            />
            <VisualMetric
              icon={<ArrowDownCircle className="size-5" />}
              label="Despesas do mes"
              value={formatCurrency(summary.expenses)}
              tone="warning"
            />
            <VisualMetric
              icon={<PiggyBank className="size-5" />}
              label="Taxa de economia"
              value={formatPercent(summary.savingsRate)}
              tone={summary.savingsRate >= 20 ? "success" : "warning"}
            />
            <VisualMetric
              icon={<HeartPulse className="size-5" />}
              label="Orcamento do mes"
              value={budgetSummary.totalLimit > 0 ? formatPercent(budgetSummary.usedPercent) : "Novo"}
              detail={budgetSummary.totalLimit > 0 ? `${formatCurrency(budgetSummary.remaining)} restantes` : "Crie limites por categoria"}
              tone={budgetSummary.exceededCount > 0 ? "warning" : "info"}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card id="transacoes">
              <CardHeader
                eyebrow="Fluxo de caixa"
                title="Transacoes"
                action={<Badge tone="neutral">{state.transactions.length} registros</Badge>}
              />
              <form className="grid gap-3 rounded-lg border border-cream/10 bg-cream/[0.04] p-4" onSubmit={submitTransaction}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-muted">
                    Cadastre manualmente ou anexe uma imagem para a MAYA preencher um rascunho revisavel.
                  </p>
                  <Button variant="secondary" onClick={() => transactionImageRef.current?.click()}>
                    <FileImage className="size-4" aria-hidden="true" />
                    Ler anexo
                  </Button>
                  <input
                    ref={transactionImageRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void importTransactionImage(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
                {transactionDraft ? (
                  <FinancialDocumentReview
                    draft={transactionDraft}
                    categories={getTransactionCategoriesByType(transactionDraft.kind === "income" ? "income" : "expense")}
                    persons={personOptions}
                    dateField={transactionDraft.kind === "income" ? "entryDate" : "documentDate"}
                    dateLabel={transactionDraft.kind === "income" ? "Data de entrada" : "Data da nota"}
                    onChange={updateTransactionDraft}
                  />
                ) : null}

                {transactionDraft?.items?.length ? <DraftItems items={transactionDraft.items} /> : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Label>
                    Tipo
                    <Select
                      value={transactionForm.type}
                      onChange={(event) =>
                        setTransactionForm((current) => {
                          const type = event.target.value as TransactionType;
                          const categories = getTransactionCategoriesByType(type);

                          return {
                            ...current,
                            type,
                            category: categories.includes(current.category) ? current.category : categories[0]
                          };
                        })
                      }
                    >
                      {Object.entries(transactionTypeLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <Label className="xl:col-span-2">
                    Descricao
                    <Input
                      value={transactionForm.description}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Ex: mercado, salario, aporte..."
                    />
                  </Label>
                  <Label>
                    Valor
                    <Input
                      inputMode="decimal"
                      value={transactionForm.amount}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, amount: event.target.value }))
                      }
                      placeholder="0,00"
                    />
                  </Label>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Label>
                    Categoria
                    <Select
                      value={transactionForm.category}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, category: event.target.value }))
                      }
                    >
                      {activeCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <Label>
                    Pessoa
                    <Select
                      value={transactionForm.person}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, person: event.target.value as Person }))
                      }
                    >
                      {personOptions.map((person) => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ))}
                    </Select>
                  </Label>
                  <Label>
                    Data
                    <Input
                      type="date"
                      value={transactionForm.date}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </Label>
                  <label className="flex min-h-11 items-center gap-3 rounded-lg border border-cream/10 bg-cream/[0.04] px-3 text-sm font-bold text-muted xl:mt-7">
                    <input
                      type="checkbox"
                      checked={transactionForm.recurring}
                      onChange={(event) =>
                        setTransactionForm((current) => ({ ...current, recurring: event.target.checked }))
                      }
                    />
                    Recorrente
                  </label>
                  <Button type="submit" className="xl:mt-7">
                    <Plus className="size-4" aria-hidden="true" />
                    Salvar
                  </Button>
                </div>
                {transactionForm.category === "Outros" ? (
                  <Label>
                    Descrever outros
                    <Input
                      value={transactionForm.otherCategoryDescription}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          otherCategoryDescription: event.target.value
                        }))
                      }
                      placeholder="Opcional: descreva a categoria"
                    />
                  </Label>
                ) : null}
                {transactionForm.type === "expense" ? (
                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <Label>
                      Forma
                      <Select
                        value={transactionForm.paymentMethod}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            paymentMethod: event.target.value as PaymentMethod
                          }))
                        }
                      >
                        <option value="other">Outro</option>
                        <option value="pix">Pix</option>
                        <option value="boleto">Boleto</option>
                        <option value="card">Cartao</option>
                      </Select>
                    </Label>
                    {transactionForm.paymentMethod === "pix" ? (
                      <Label>
                        Para quem foi feito
                        <Input
                          value={transactionForm.paymentRecipient}
                          onChange={(event) =>
                            setTransactionForm((current) => ({
                              ...current,
                              paymentRecipient: event.target.value
                            }))
                          }
                          placeholder="Nome da pessoa ou empresa"
                          required
                        />
                      </Label>
                    ) : null}
                  </div>
                ) : null}
              </form>

              <div className="mt-5 grid gap-3">
                <AnimatePresence initial={false}>
                  {state.transactions.slice(0, 8).map((transaction) => (
                    <motion.div
                      key={transaction.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid gap-3 rounded-lg border border-cream/10 bg-cream/[0.04] p-3 md:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-cream">{transaction.description}</strong>
                          <Badge tone={transaction.type === "income" ? "success" : transaction.type === "expense" ? "warning" : "info"}>
                            {transactionTypeLabel[transaction.type]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {transaction.category} - {transaction.person} - {transaction.date}
                          {transaction.paymentMethod === "pix" && transaction.paymentRecipient
                            ? ` - Pix para ${transaction.paymentRecipient}`
                            : ""}
                          {transaction.otherCategoryDescription ? ` - ${transaction.otherCategoryDescription}` : ""}
                          {transaction.recurring ? " - recorrente" : ""}
                        </p>
                        <AttachmentLink
                          dataUrl={transaction.attachmentDataUrl}
                          storagePath={transaction.attachmentStoragePath}
                          imageName={transaction.attachmentImageName}
                        />
                        <DocumentItemsPanel items={transaction.documentItems} title="Itens guardados do anexo" />
                      </div>
                      <strong className={cn("self-center text-lg", financialValueClass(transaction.amount))}>{formatCurrency(transaction.amount)}</strong>
                      <Button
                        variant="ghost"
                        className="self-center px-3"
                        aria-label={`Remover ${transaction.description}`}
                        onClick={() => actions.removeTransaction(transaction.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>

            <div className="grid gap-4">
              <Card id="metas">
                <CardHeader eyebrow="Sonhos em numeros" title="Metas" />
                <form className="grid gap-3" onSubmit={submitGoal}>
                  <Label>
                    Nome da meta
                    <Input
                      value={goalForm.name}
                      onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ex: viagem, reserva, casa..."
                    />
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Label>
                      Tipo
                      <Select
                        value={goalForm.type}
                        onChange={(event) => setGoalForm((current) => ({ ...current, type: event.target.value as GoalType }))}
                      >
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
                        value={goalForm.priority}
                        onChange={(event) =>
                          setGoalForm((current) => ({ ...current, priority: event.target.value as GoalPriority }))
                        }
                      >
                        {priorities.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </Select>
                    </Label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Label>
                      Alvo
                      <Input
                        inputMode="decimal"
                        value={goalForm.targetAmount}
                        onChange={(event) =>
                          setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))
                        }
                        placeholder="0,00"
                      />
                    </Label>
                    <Label>
                      Atual
                      <Input
                        inputMode="decimal"
                        value={goalForm.currentAmount}
                        onChange={(event) =>
                          setGoalForm((current) => ({ ...current, currentAmount: event.target.value }))
                        }
                        placeholder="0,00"
                      />
                    </Label>
                    <Label>
                      Prazo
                      <Input
                        type="date"
                        value={goalForm.dueDate}
                        onChange={(event) => setGoalForm((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </Label>
                  </div>
                  <Button type="submit">
                    <Target className="size-4" aria-hidden="true" />
                    Criar meta
                  </Button>
                </form>

                <div className="mt-5 grid gap-3">
                  {state.goals.map((goal) => {
                    const progress = getGoalProgress(goal);
                    return (
                      <div key={goal.id} className="rounded-lg border border-cream/10 bg-cream/[0.04] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <strong className="text-cream">{goal.name}</strong>
                            <p className="mt-1 text-sm text-muted">
                              {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            className="min-h-9 px-3"
                            aria-label={`Remover meta ${goal.name}`}
                            onClick={() => actions.removeGoal(goal.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-cream/10">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-bronze to-terracotta"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
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
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card id="viagens">
              <CardHeader eyebrow="Tendencia" title="Fluxo dos ultimos meses" />
              <div className="grid gap-4">
                {flow.map((month) => (
                  <div key={month.month} className="grid gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <strong className="text-cream">{month.month}</strong>
                      <span className={cn("text-muted", financialValueClass(month.income - month.expenses - month.investments, "text-muted"))}>
                        {formatCurrency(month.income - month.expenses - month.investments)}
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <FlowBar label="Receitas" value={month.income} max={maxFlowValue} className="bg-emerald-300" />
                      <FlowBar label="Despesas" value={month.expenses} max={maxFlowValue} className="bg-terracotta" />
                      <FlowBar label="Invest." value={month.investments} max={maxFlowValue} className="bg-bronze" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card id="insights">
              <CardHeader
                eyebrow="Assistente financeiro"
                title="Insights"
                action={<Badge tone="info">MAYA</Badge>}
              />
              <div className="grid gap-3">
                {insights.map((insight) => (
                  <div key={insight.title} className="rounded-lg border border-cream/10 bg-cream/[0.04] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <BadgeCheck className="size-4 text-bronze" aria-hidden="true" />
                      <strong className="text-cream">{insight.title}</strong>
                    </div>
                    <p className="text-sm leading-6 text-muted">{insight.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Quanto mais dados reais forem cadastrados, melhor a MAYA consegue comparar meses, categorias e metas.
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Dados e seguranca</p>
                <h2 className="section-title">Backup e limpeza</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Exporte backups antes de limpar dados ou trocar de dispositivo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={exportBackup}>
                  <Download className="size-4" aria-hidden="true" />
                  Backup
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    actions.reset();
                    setFeedback("Cadastros limpos. Cadastre informacoes reais para iniciar a analise.");
                  }}
                >
                  <RefreshCcw className="size-4" aria-hidden="true" />
                  Limpar cadastros
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <Card className="min-h-36">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted">{label}</p>
          <strong className={cn("mt-3 block font-serif text-3xl", financialValueClass(value))}>{value}</strong>
        </div>
        <div className="grid size-11 place-items-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-neon">
          {icon}
        </div>
      </div>
      <Badge tone={tone} className="mt-4">
        {tone === "success" ? "Saudavel" : "Revisar"}
      </Badge>
    </Card>
  );
}

function FlowBar({
  label,
  value,
  max,
  className
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)_6rem] items-center gap-3 text-xs text-muted">
      <span>{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-cream/10">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
      </div>
      <strong className={cn("text-right", financialValueClass(value, "text-cream"))}>{formatCurrency(value)}</strong>
    </div>
  );
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
    <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4">
      <h3 className="font-serif text-xl font-bold text-amber-100">Suspeita de duplicidade</h3>
      <p className="mt-2 text-sm leading-6 text-amber-50">
        Ja existe lancamento com valor igual em data igual ou proxima. Escolha se deseja computar mesmo assim ou excluir o novo lancamento.
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
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <h3 className="font-serif text-xl font-bold text-cyan-50">Itens ou linhas lidas pela MAYA</h3>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 8).map((item, index) => (
          <div key={`${item.name}_${index}`} className="grid gap-1 rounded-lg border border-cyan-200/20 bg-moss-950/35 p-3 text-sm md:grid-cols-[1fr_auto]">
            <span className="text-cyan-50">
              {item.date ? `${item.date} - ` : ""}
              {item.name}
              {item.category ? ` - ${item.category}` : ""}
            </span>
            <strong className="text-bronze">{typeof item.amount === "number" ? formatCurrency(item.amount) : "valor nao lido"}</strong>
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

function buildDraftFeedback(message?: string, draft?: FinancialDocumentDraft) {
  if (!draft || draft.missingFields.length === 0) {
    return message ?? "Rascunho criado. Revise antes de salvar.";
  }

  return `${message ?? "Rascunho criado."} Complete manualmente: ${draft.missingFields.join(", ")}.`;
}
