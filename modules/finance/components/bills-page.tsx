"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  FileImage,
  ReceiptText,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { cn, financialValueClass, formatCurrency, toInputDate } from "@/lib/utils";
import { expenseCategories } from "../data/defaults";
import {
  addMonths,
  buildBillAlerts,
  buildFinancialHealthAlerts,
  buildBillSummary,
  getBillEffectiveStatus
} from "../lib/calculations";
import { findBillDuplicateMatches, type BillDuplicateMatch } from "../lib/duplicates";
import { fileToFinanceAttachment, type FinanceAttachmentUpload } from "../lib/image-upload";
import { useFinanceStore } from "../lib/use-finance-store";
import type {
  BillStatus,
  FinancialDocumentDraft,
  PayableBill,
  PaymentMethod,
  Person
} from "../types";
import { DocumentItemsPanel } from "./document-items-panel";
import { FinancialDocumentReview } from "./financial-document-review";
import { AttachmentLink } from "./attachment-link";
import { FinanceNotificationPanel } from "./finance-notification-panel";

type BillPlan = "single" | "recurring" | "installment";

const personOptions: Person[] = ["Pessoa 1", "Pessoa 2", "Casal"];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  boleto: "Boleto",
  pix: "Pix copia e cola",
  card: "Cartao",
  other: "Outro"
};

const statusLabels: Record<BillStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado"
};

type BillDuplicateReview = {
  bills: Array<Omit<PayableBill, "id" | "createdAt">>;
  matches: BillDuplicateMatch[];
};

export function BillsPage() {
  const { state, actions } = useFinanceStore();
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [feedback, setFeedback] = useState("Cadastre contas, boletos e Pix para acompanhar vencimentos.");
  const [documentDraft, setDocumentDraft] = useState<FinancialDocumentDraft | null>(null);
  const [duplicateReview, setDuplicateReview] = useState<BillDuplicateReview | null>(null);
  const [isReadingDocument, setIsReadingDocument] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    category: "Moradia",
    otherCategoryDescription: "",
    person: "Casal" as Person,
    dueDate: toInputDate(new Date()),
    paymentMethod: "boleto" as PaymentMethod,
    paymentCode: "",
    paymentRecipient: "",
    plan: "single" as BillPlan,
    months: "12",
    installments: "2",
    status: "pending" as BillStatus,
    notes: ""
  });

  const availableMonths = useMemo(() => buildAvailableBillMonths(state.bills), [state.bills]);
  const monthSummary = useMemo(() => buildBillSummary(state.bills, selectedMonth), [state.bills, selectedMonth]);
  const alerts = useMemo(() => buildBillAlerts(state.bills), [state.bills]);
  const healthAlerts = useMemo(() => buildFinancialHealthAlerts(state), [state]);
  const monthBills = monthSummary.monthBills
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));

  function applyDraft(draft: FinancialDocumentDraft) {
    setDocumentDraft(draft);
    setForm((current) => ({
      ...current,
      title: draft.title,
      description: draft.description,
      amount: draft.amount > 0 ? String(draft.amount) : current.amount,
      category: draft.category || current.category,
      otherCategoryDescription: draft.otherCategoryDescription ?? current.otherCategoryDescription,
      person: draft.person,
      dueDate: draft.dueDate || "",
      paymentMethod: draft.paymentMethod ?? current.paymentMethod,
      paymentCode: draft.paymentCode ?? "",
      paymentRecipient: draft.paymentRecipient ?? "",
      notes: draft.attachmentImageName ? `Anexo: ${draft.attachmentImageName}` : current.notes
    }));
  }

  function updateDocumentDraft(patch: Partial<FinancialDocumentDraft>) {
    setDocumentDraft((current) => {
      if (!current) {
        return current;
      }

      const updated = { ...current, ...patch };

      setForm((formCurrent) => ({
        ...formCurrent,
        title: "title" in patch ? updated.title : formCurrent.title,
        description: "description" in patch ? updated.description : formCurrent.description,
        amount: "amount" in patch ? (updated.amount > 0 ? String(updated.amount) : "") : formCurrent.amount,
        category: "category" in patch ? updated.category : formCurrent.category,
        otherCategoryDescription:
          "otherCategoryDescription" in patch
            ? updated.otherCategoryDescription ?? ""
            : formCurrent.otherCategoryDescription,
        person: "person" in patch ? updated.person : formCurrent.person,
        dueDate:
          "dueDate" in patch || "documentDate" in patch || "entryDate" in patch
            ? updated.dueDate || updated.documentDate || updated.entryDate || formCurrent.dueDate
            : formCurrent.dueDate,
        paymentMethod: "paymentMethod" in patch ? updated.paymentMethod ?? formCurrent.paymentMethod : formCurrent.paymentMethod,
        paymentCode: "paymentCode" in patch ? updated.paymentCode ?? "" : formCurrent.paymentCode,
        paymentRecipient: "paymentRecipient" in patch ? updated.paymentRecipient ?? "" : formCurrent.paymentRecipient,
        notes: "notes" in patch ? updated.notes ?? "" : formCurrent.notes
      }));

      return updated;
    });
  }

  async function handleDocumentFile(file: File) {
    setIsReadingDocument(true);
    setFeedback("MAYA esta lendo a conta e preenchendo o rascunho...");

    try {
      const attachment = await fileToFinanceAttachment(file);
      const response = await fetch("/api/maya/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: attachment.imageDataUrl,
          fileName: file.name,
          documentKind: "bill"
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
          : "Nao consegui ler a imagem. Preencha a conta manualmente."
      );
    } finally {
      setIsReadingDocument(false);
    }
  }

  function submitBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));

    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0 || !form.dueDate) {
      setFeedback("Preencha titulo, valor e vencimento antes de salvar.");
      return;
    }

    if (form.paymentMethod === "pix" && !form.paymentRecipient.trim()) {
      setFeedback("Quando a conta for Pix, informe para quem o Pix sera feito.");
      return;
    }

    const bills = createPlannedBills({
      title: form.title.trim(),
      description: form.description.trim(),
      amount,
      category: form.category,
      otherCategoryDescription: form.category === "Outros" ? form.otherCategoryDescription.trim() : undefined,
      person: form.person,
      dueDate: form.dueDate,
      paymentMethod: form.paymentMethod,
      paymentCode: form.paymentCode.trim(),
      paymentRecipient: form.paymentRecipient.trim(),
      plan: form.plan,
      months: Number(form.months),
      installments: Number(form.installments),
      status: form.status,
      notes: form.notes,
      attachmentImageName: documentDraft?.attachmentImageName,
      attachmentDataUrl: documentDraft?.attachmentDataUrl,
      attachmentStoragePath: documentDraft?.attachmentStoragePath,
      attachmentMimeType: documentDraft?.attachmentMimeType,
      attachmentSize: documentDraft?.attachmentSize,
      documentItems: documentDraft?.items,
      source: documentDraft ? "attachment" : "manual"
    });

    const duplicates = findBillDuplicateMatches(state.bills, bills);

    if (duplicates.length > 0) {
      setDuplicateReview({ bills, matches: duplicates });
      setFeedback("Suspeita de duplicidade encontrada. Aprove para computar ou exclua a nova conta.");
      return;
    }

    saveBills(bills);
  }

  function saveBills(bills: Array<Omit<PayableBill, "id" | "createdAt">>) {
    actions.addBills(bills);
    setSelectedMonth(form.dueDate.slice(0, 7));
    setDocumentDraft(null);
    setDuplicateReview(null);
    setFeedback(
      form.plan === "installment"
        ? `${bills.length} parcelas foram cadastradas por vencimento.`
        : form.plan === "recurring"
          ? `${bills.length} contas recorrentes foram cadastradas.`
          : "Conta cadastrada com sucesso."
    );
    setForm((current) => ({
      ...current,
      title: "",
      description: "",
      amount: "",
      otherCategoryDescription: "",
      paymentCode: "",
      paymentRecipient: "",
      plan: "single",
      status: "pending",
      notes: ""
    }));
  }

  async function copyPaymentCode(bill: PayableBill) {
    if (!bill.paymentCode) {
      setFeedback("Esta conta nao possui codigo para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(bill.paymentCode);
      setFeedback(`Codigo de ${paymentMethodLabels[bill.paymentMethod]} copiado.`);
    } catch {
      setFeedback("Nao consegui copiar automaticamente. Selecione o codigo manualmente.");
    }
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
          <div>
            <p className="eyebrow">Contas a pagar</p>
            <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-bronze">
              Vencimentos, boletos, Pix e alertas.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Cadastre contas manualmente ou anexe uma imagem para a MAYA preencher um rascunho revisavel.
            </p>
          </div>

          <div className="rounded-2xl border border-bronze/20 bg-bronze/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Resumo do mes</p>
            <strong className="mt-2 block font-serif text-4xl text-bronze">
              {formatCurrency(monthSummary.pendingTotal)}
            </strong>
            <p className="mt-2 text-sm leading-6 text-muted">
              {monthSummary.pending.length} pendente(s), {monthSummary.paid.length} paga(s) e{" "}
              {monthSummary.overdue.length} atrasada(s).
            </p>
          </div>
        </div>
      </LedPanel>

      <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          icon={<CalendarClock className="size-5" />}
          label="Resumo do dia"
          value={formatCurrency(monthSummary.dueTodayTotal)}
          detail={`${monthSummary.dueToday.length} conta(s) vencem hoje`}
          tone="warning"
        />
        <SummaryMetric
          icon={<BellRing className="size-5" />}
          label="Vencendo"
          value={String(monthSummary.upcoming.length)}
          detail="Alertas em ate 48h"
          tone="info"
        />
        <SummaryMetric
          icon={<AlertTriangle className="size-5" />}
          label="Atrasadas"
          value={formatCurrency(monthSummary.overdueTotal)}
          detail={`${monthSummary.overdue.length} conta(s)`}
          tone="critical"
        />
        <SummaryMetric
          icon={<CheckCircle2 className="size-5" />}
          label="Pagas no mes"
          value={formatCurrency(monthSummary.paidTotal)}
          detail={`${monthSummary.paid.length} baixa(s) confirmada(s)`}
          tone="success"
        />
      </section>

      <p className="mb-4 rounded-lg border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">
        {feedback}
      </p>

      {duplicateReview ? (
        <DuplicateBillReview
          matches={duplicateReview.matches}
          onCancel={() => {
            setDuplicateReview(null);
            setFeedback("Salvamento cancelado. Revise os dados antes de tentar novamente.");
          }}
          onConfirm={() => saveBills(duplicateReview.bills)}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader
            eyebrow="Cadastro"
            title="Nova conta"
            action={<Badge tone={documentDraft ? "success" : "neutral"}>{documentDraft ? "Anexo lido" : "Manual"}</Badge>}
          />

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => uploadRef.current?.click()} disabled={isReadingDocument}>
              <FileImage className="size-4" aria-hidden="true" />
              Anexar conta
            </Button>
            <Button variant="ghost" onClick={() => cameraRef.current?.click()} disabled={isReadingDocument}>
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
                  void handleDocumentFile(file);
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
                  void handleDocumentFile(file);
                }
                event.target.value = "";
              }}
            />
          </div>

          <form className="grid gap-4" onSubmit={submitBill}>
            {documentDraft ? (
              <FinancialDocumentReview
                draft={documentDraft}
                categories={expenseCategories}
                persons={personOptions}
                dateField="dueDate"
                dateLabel="Vencimento"
                titleLabel="Titulo"
                showPayment
                onChange={updateDocumentDraft}
              />
            ) : null}

            {documentDraft?.items?.length ? <DraftItems items={documentDraft.items} /> : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
              <Label>
                Titulo
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex: energia, aluguel, internet..."
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

            <Label>
              Descricao
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Detalhe opcional da conta"
              />
            </Label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Label>
                Vencimento
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </Label>
              <Label>
                Categoria
                <Select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Pessoa
                <Select
                  value={form.person}
                  onChange={(event) => setForm((current) => ({ ...current, person: event.target.value as Person }))}
                >
                  {personOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Status
                <Select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as BillStatus }))}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
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
                  placeholder="Opcional: detalhe a categoria"
                />
              </Label>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <Label>
                Tipo de pagamento
                <Select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))
                  }
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label>
                Codigo Pix/boleto
                <Input
                  value={form.paymentCode}
                  onChange={(event) => setForm((current) => ({ ...current, paymentCode: event.target.value }))}
                  placeholder="Cole aqui a linha digitavel ou Pix copia e cola"
                />
              </Label>
            </div>

            {form.paymentMethod === "pix" ? (
              <Label>
                Para quem sera feito
                <Input
                  value={form.paymentRecipient}
                  onChange={(event) => setForm((current) => ({ ...current, paymentRecipient: event.target.value }))}
                  placeholder="Nome da pessoa ou empresa"
                  required
                />
              </Label>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <Label>
                Recorrencia ou parcelas
                <Select
                  value={form.plan}
                  onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as BillPlan }))}
                >
                  <option value="single">Unica</option>
                  <option value="recurring">Recorrente mensal</option>
                  <option value="installment">Parcelada</option>
                </Select>
              </Label>
              {form.plan === "recurring" ? (
                <Label>
                  Meses
                  <Input
                    inputMode="numeric"
                    value={form.months}
                    onChange={(event) => setForm((current) => ({ ...current, months: event.target.value }))}
                  />
                </Label>
              ) : null}
              {form.plan === "installment" ? (
                <Label>
                  Parcelas
                  <Input
                    inputMode="numeric"
                    value={form.installments}
                    onChange={(event) => setForm((current) => ({ ...current, installments: event.target.value }))}
                  />
                </Label>
              ) : null}
            </div>

            <Label>
              Observacoes
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </Label>

            <Button type="submit" className="w-full sm:w-auto">
              <ReceiptText className="size-4" aria-hidden="true" />
              Salvar conta
            </Button>
          </form>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Alertas automaticos" title="Vencimentos" action={<Badge tone="info">{alerts.length}</Badge>} />
            <div className="grid gap-3">
              <FinanceNotificationPanel billAlerts={alerts} healthAlerts={healthAlerts} />
              {alerts.length === 0 ? (
                <p className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4 text-sm leading-6 text-muted">
                  Nenhuma conta vencendo em 48h, vencendo hoje ou atrasada.
                </p>
              ) : (
                alerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={alert.priority === "critical" ? "warning" : alert.priority === "warning" ? "warning" : "info"}>
                        {alert.title}
                      </Badge>
                      <strong className="text-cream">{formatCurrency(alert.bill.amount)}</strong>
                    </div>
                    <p className="text-sm leading-6 text-muted">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Mes" title="Boletos cadastrados" />
            <Label>
              Mes de vencimento
              <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </Select>
            </Label>
            <div className="mt-4 grid gap-3">
              <SummaryRow label="Total do mes" value={formatCurrency(monthSummary.total)} />
              <SummaryRow label="Pendente" value={formatCurrency(monthSummary.pendingTotal)} />
              <SummaryRow label="Pago" value={formatCurrency(monthSummary.paidTotal)} />
              <SummaryRow label="Atrasado" value={formatCurrency(monthSummary.overdueTotal)} />
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader
            eyebrow="Lista de contas vencendo"
            title={selectedMonth}
            action={<Badge tone="neutral">{monthBills.length} conta(s)</Badge>}
          />

          {monthBills.length === 0 ? (
            <EmptyState
              title="Nenhuma conta neste mes"
              text="Cadastre uma conta manualmente ou anexe uma imagem para organizar os vencimentos."
              actionLabel="Cadastrar conta"
              onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />
          ) : (
            <div className="grid gap-3">
              {monthBills.map((bill) => (
                <BillItem
                  key={bill.id}
                  bill={bill}
                  onCopy={() => void copyPaymentCode(bill)}
                  onPaid={() => {
                    actions.markBillPaid(bill.id);
                    setFeedback(`${bill.title} marcada como paga.`);
                  }}
                  onRemove={() => {
                    actions.removeBill(bill.id);
                    setFeedback(`${bill.title} removida.`);
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  );
}

function BillItem({
  bill,
  onCopy,
  onPaid,
  onRemove
}: {
  bill: PayableBill;
  onCopy: () => void;
  onPaid: () => void;
  onRemove: () => void;
}) {
  const status = getBillEffectiveStatus(bill);
  const badgeTone = status === "paid" ? "success" : status === "overdue" ? "warning" : "info";

  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={badgeTone}>{statusLabels[status]}</Badge>
            {bill.recurrence === "monthly" ? <Badge tone="info">Recorrente</Badge> : null}
            {bill.installmentTotal ? (
              <Badge tone="neutral">
                Parcela {bill.installmentNumber}/{bill.installmentTotal}
              </Badge>
            ) : null}
          </div>
          <h2 className="font-serif text-2xl font-bold text-bronze">{bill.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {bill.category} - {bill.person} - vencimento {bill.dueDate} - {paymentMethodLabels[bill.paymentMethod]}
            {bill.paymentMethod === "pix" && bill.paymentRecipient ? ` - Pix para ${bill.paymentRecipient}` : ""}
            {bill.otherCategoryDescription ? ` - ${bill.otherCategoryDescription}` : ""}
          </p>
          {bill.description ? <p className="mt-2 text-sm leading-6 text-muted">{bill.description}</p> : null}
          {bill.paymentCode ? (
            <p className="mt-3 break-all rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-50">
              {bill.paymentCode}
            </p>
          ) : null}
          <AttachmentLink
            dataUrl={bill.attachmentDataUrl}
            storagePath={bill.attachmentStoragePath}
            imageName={bill.attachmentImageName}
          />
          <DocumentItemsPanel items={bill.documentItems} title="Itens guardados da conta" />
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-80 lg:grid-cols-1">
          <div className="rounded-xl border border-bronze/20 bg-bronze/10 p-3 text-right sm:text-left lg:text-right">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Valor</p>
            <strong className="mt-1 block text-xl text-bronze">{formatCurrency(bill.amount)}</strong>
          </div>
          <Button variant="secondary" onClick={onCopy} disabled={!bill.paymentCode}>
            <Copy className="size-4" aria-hidden="true" />
            Copiar codigo
          </Button>
          <Button variant="ghost" onClick={onPaid} disabled={status === "paid"}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Marcar pago
          </Button>
          <Button variant="danger" onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remover
          </Button>
        </div>
      </div>
    </div>
  );
}

function DuplicateBillReview({
  matches,
  onCancel,
  onConfirm
}: {
  matches: BillDuplicateMatch[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4">
      <h3 className="font-serif text-xl font-bold text-amber-100">Suspeita de conta duplicada</h3>
      <p className="mt-2 text-sm leading-6 text-amber-50">
        Ja existe conta com o mesmo vencimento e mesmo valor. Escolha se deseja computar mesmo assim ou excluir a nova conta.
      </p>
      <div className="mt-3 grid gap-2">
        {matches.slice(0, 4).map((match) => (
          <div key={`${match.existing.id}_${match.incoming.dueDate}_${match.incoming.amount}`} className="rounded-lg border border-amber-200/20 bg-moss-950/40 p-3 text-sm">
            <strong className="text-cream">{match.existing.title}</strong>
            <p className="mt-1 text-amber-50">
              {match.existing.dueDate} - {formatCurrency(match.existing.amount)} - nova: {match.incoming.title}
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
          <div key={`${item.name}_${index}`} className="grid gap-1 rounded-lg border border-cyan-200/20 bg-moss-950/35 p-3 text-sm sm:grid-cols-[1fr_auto]">
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

function SummaryMetric({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "info" | "critical";
}) {
  const colorClass =
    tone === "success"
      ? "text-emerald-200"
      : tone === "critical"
        ? "text-red-200"
        : tone === "warning"
          ? "text-amber-200"
          : "text-cyan-200";

  return (
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
          <strong className={cn("mt-3 block font-serif text-3xl", financialValueClass(value, colorClass))}>{value}</strong>
          <p className="mt-2 text-sm text-muted">{detail}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan shadow-neon">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={cn("mt-2 block text-xl", financialValueClass(value))}>{value}</strong>
    </div>
  );
}

function createPlannedBills({
  title,
  description,
  amount,
  category,
  otherCategoryDescription,
  person,
  dueDate,
  paymentMethod,
  paymentCode,
  paymentRecipient,
  plan,
  months,
  installments,
  status,
  notes,
  attachmentImageName,
  attachmentDataUrl,
  attachmentStoragePath,
  attachmentMimeType,
  attachmentSize,
  documentItems,
  source
}: {
  title: string;
  description?: string;
  amount: number;
  category: string;
  otherCategoryDescription?: string;
  person: Person;
  dueDate: string;
  paymentMethod: PaymentMethod;
  paymentCode?: string;
  paymentRecipient?: string;
  plan: BillPlan;
  months: number;
  installments: number;
  status: BillStatus;
  notes?: string;
  attachmentImageName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  documentItems?: FinancialDocumentDraft["items"];
  source: "manual" | "attachment";
}): Array<Omit<PayableBill, "id" | "createdAt">> {
  const count = plan === "recurring" ? clampCount(months, 1, 60) : plan === "installment" ? clampCount(installments, 1, 120) : 1;
  const groupId = `${plan}_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  return Array.from({ length: count }, (_, index) => ({
    title: plan === "installment" ? `${title} (${index + 1}/${count})` : title,
    description,
    amount,
    category,
    otherCategoryDescription,
    person,
    dueDate: addMonths(dueDate, index),
    paymentMethod,
    paymentCode,
    paymentRecipient,
    recurrence: plan === "recurring" ? "monthly" : "none",
    recurrenceGroupId: plan === "recurring" ? groupId : undefined,
    installmentGroupId: plan === "installment" ? groupId : undefined,
    installmentNumber: plan === "installment" ? index + 1 : undefined,
    installmentTotal: plan === "installment" ? count : undefined,
    status,
    source,
    attachmentImageName,
    attachmentDataUrl,
    attachmentStoragePath,
    attachmentMimeType,
    attachmentSize,
    documentItems,
    notes,
    paidAt: status === "paid" ? now : undefined
  }));
}

function buildAvailableBillMonths(bills: PayableBill[]) {
  const months = new Set<string>();
  const current = new Date();

  for (let index = -12; index <= 24; index += 1) {
    const date = new Date(current);
    date.setMonth(current.getMonth() + index);
    months.add(date.toISOString().slice(0, 7));
  }

  bills.forEach((bill) => months.add(bill.dueDate.slice(0, 7)));
  return Array.from(months).sort();
}

function buildDraftFeedback(message?: string, draft?: FinancialDocumentDraft) {
  if (!draft || draft.missingFields.length === 0) {
    return message ?? "Rascunho criado. Revise antes de salvar.";
  }

  return `${message ?? "Rascunho criado."} Complete manualmente: ${draft.missingFields.join(", ")}.`;
}

function clampCount(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}
