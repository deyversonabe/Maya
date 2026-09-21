"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Inbox, Loader2, Pencil, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { mayaFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { expenseCategories, incomeCategories } from "@/modules/finance/data/defaults";
import { findTransactionDuplicateMatches } from "@/modules/finance/lib/duplicates";
import { useFinanceStore } from "@/modules/finance/lib/use-finance-store";
import type { FinancialDocumentDraft, Person, StatementTransactionDraft, Transaction } from "@/modules/finance/types";
import { validateBankStatementDraft, validateFinancialDocumentDraft } from "../validation";
import type { CaptureDraft, CaptureValidationReport, FinanceCaptureRecord } from "../types";

const persons: Person[] = ["Deyverson", "Tom", "Casal"];

export function CaptureInboxPage() {
  const { state, actions } = useFinanceStore();
  const [captures, setCaptures] = useState<FinanceCaptureRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("Tudo que veio da IA fica aqui ate voce revisar e confirmar.");

  const selected = useMemo(() => captures.find((capture) => capture.id === selectedId) ?? null, [captures, selectedId]);
  const validation = useMemo(() => draft ? validateDraft(draft) : selected?.validation, [draft, selected]);

  useEffect(() => { void loadCaptures(); }, []);
  useEffect(() => { if (selected) setDraft(structuredClone(selected.draft)); }, [selected]);

  async function loadCaptures() {
    setLoading(true);
    try {
      const response = await mayaFetch("/api/captures?status=pending", { cache: "no-store" });
      const result = (await response.json()) as { captures?: FinanceCaptureRecord[]; error?: string };
      if (!response.ok) throw new Error(result.error || "capture_load_failed");
      setCaptures(result.captures ?? []);
      setSelectedId((current) => current && result.captures?.some((item) => item.id === current) ? current : result.captures?.[0]?.id ?? null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar a Caixa de capturas.");
    } finally { setLoading(false); }
  }

  async function saveReview() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const response = await mayaFetch(`/api/captures/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft })
      });
      const result = (await response.json()) as { capture?: FinanceCaptureRecord; error?: string };
      if (!response.ok || !result.capture) throw new Error(result.error || "capture_save_failed");
      setCaptures((items) => items.map((item) => item.id === result.capture!.id ? result.capture! : item));
      setFeedback("Revisao salva. Nada foi lancado ainda.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Nao foi possivel salvar a revisao."); }
    finally { setSaving(false); }
  }

  async function confirmCapture() {
    if (!selected || !draft || !validation) return;
    if (validation.status === "blocked") {
      setFeedback("Existem campos bloqueados. Corrija antes de confirmar.");
      return;
    }

    const duplicateMessage = findDuplicateWarning(draft, state.transactions);
    if (duplicateMessage) {
      setFeedback(duplicateMessage);
      return;
    }

    setSaving(true);
    try {
      applyDraftToFinance(draft, actions);
      const response = await mayaFetch(`/api/captures/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed", draft })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "capture_confirm_failed");
      setCaptures((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId((current) => current === selected.id ? null : current);
      setDraft(null);
      setFeedback("Captura confirmada e lancada. O registro continua editavel nas telas normais do sistema.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel confirmar a captura.");
    } finally { setSaving(false); }
  }

  async function discardCapture() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await mayaFetch(`/api/captures/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "discarded" })
      });
      if (!response.ok) throw new Error("Nao foi possivel descartar.");
      setCaptures((items) => items.filter((item) => item.id !== selected.id));
      setSelectedId(null);
      setDraft(null);
      setFeedback("Captura descartada sem alterar seus dados financeiros.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Nao foi possivel descartar."); }
    finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader eyebrow="Controle humano" title="Caixa de capturas" description="WhatsApp, foto, PDF, audio e integracoes chegam como rascunho. Nada afeta saldo sem sua confirmacao." action={<Button variant="ghost" onClick={() => void loadCaptures()}><RefreshCw className="size-4" />Atualizar</Button>} />
          {loading ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" />Carregando...</p> : captures.length === 0 ? (
            <div className="rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 p-5 text-center">
              <Inbox className="mx-auto size-8 text-bronze" />
              <strong className="mt-3 block text-cream">Nenhum rascunho pendente</strong>
              <p className="mt-2 text-sm text-muted">Quando a MAYA receber algo para revisar, ele aparece aqui.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {captures.map((capture) => (
                <button key={capture.id} type="button" onClick={() => setSelectedId(capture.id)} className={`rounded-xl border p-3 text-left transition ${selectedId === capture.id ? "border-neon-cyan/50 bg-neon-cyan/10" : "border-cream/10 bg-cream/[0.03] hover:border-neon-cyan/25"}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-cream">{capture.title}</strong><ValidationBadge status={capture.validationStatus} score={capture.validationScore} /></div>
                  <p className="mt-1 text-xs text-muted">{sourceLabel(capture.source)} · {new Date(capture.createdAt).toLocaleString("pt-BR")}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {selected && draft && validation ? (
            <>
              <CardHeader eyebrow="Revisao obrigatoria" title={selected.title} description="Edite qualquer campo. 'Pronto' significa que os cruzamentos fecharam, nao que a IA pode salvar sozinha." action={<ValidationBadge status={validation.status} score={validation.score} />} />
              <ValidationPanel report={validation} />
              {draft.type === "financial_document" ? <FinancialDraftEditor draft={draft.value} onChange={(value) => setDraft({ type: "financial_document", value })} /> : <StatementDraftEditor draft={draft.value} onChange={(value) => setDraft({ type: "bank_statement", value })} />}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={saving} onClick={() => void saveReview()}><Pencil className="size-4" />Salvar revisao</Button>
                <Button disabled={saving || validation.status === "blocked"} onClick={() => void confirmCapture()}><CheckCircle2 className="size-4" />Confirmar e lancar</Button>
                <Button variant="danger" disabled={saving} onClick={() => void discardCapture()}><Trash2 className="size-4" />Descartar</Button>
              </div>
            </>
          ) : <div className="grid min-h-72 place-items-center text-center text-muted"><div><ShieldCheck className="mx-auto size-10 text-bronze" /><p className="mt-3">Selecione um rascunho para revisar.</p></div></div>}
        </Card>
      </div>
      <p className="mt-4 rounded-xl border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">{feedback}</p>
    </AppShell>
  );
}

function FinancialDraftEditor({ draft, onChange }: { draft: FinancialDocumentDraft; onChange: (value: FinancialDocumentDraft) => void }) {
  const categories = draft.kind === "income" ? incomeCategories : expenseCategories;
  const dateField = draft.kind === "bill" ? "dueDate" : draft.kind === "income" ? "entryDate" : "documentDate";
  const dateValue = draft[dateField] || "";
  return <div className="mt-4 grid gap-3">
    <div className="grid gap-3 md:grid-cols-3">
      <Label>Tipo<Select value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as FinancialDocumentDraft["kind"] })}><option value="expense">Despesa</option><option value="income">Receita</option><option value="bill">Conta a pagar</option></Select></Label>
      <Label>Pessoa<Select value={draft.person} onChange={(e) => onChange({ ...draft, person: e.target.value as Person })}>{persons.map((p) => <option key={p}>{p}</option>)}</Select></Label>
      <Label>Data<Input type="date" value={dateValue} onChange={(e) => onChange({ ...draft, [dateField]: e.target.value })} /></Label>
    </div>
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
      <Label>Descricao<Input value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} /></Label>
      <Label>Valor<Input inputMode="decimal" value={String(draft.amount || "")} onChange={(e) => onChange({ ...draft, amount: Number(e.target.value.replace(",", ".")) || 0 })} /></Label>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <Label>Categoria<Select value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Label>
      <Label>Nome/estabelecimento<Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} /></Label>
    </div>
    <Label>Observacoes<Textarea value={draft.notes ?? ""} onChange={(e) => onChange({ ...draft, notes: e.target.value })} /></Label>
  </div>;
}

function StatementDraftEditor({ draft, onChange }: { draft: Extract<CaptureDraft, { type: "bank_statement" }>["value"]; onChange: (value: Extract<CaptureDraft, { type: "bank_statement" }>["value"]) => void }) {
  function updateLine(index: number, patch: Partial<StatementTransactionDraft>) { onChange({ ...draft, lines: draft.lines.map((line, i) => i === index ? { ...line, ...patch } : line) }); }
  return <div className="mt-4 grid gap-3">
    <div className="grid gap-3 md:grid-cols-4">
      <Label>Saldo inicial<Input inputMode="decimal" value={draft.openingBalance ?? ""} onChange={(e) => onChange({ ...draft, openingBalance: numericOrUndefined(e.target.value) })} /></Label>
      <Label>Entradas informadas<Input inputMode="decimal" value={draft.totalIncome ?? ""} onChange={(e) => onChange({ ...draft, totalIncome: numericOrUndefined(e.target.value) })} /></Label>
      <Label>Saidas informadas<Input inputMode="decimal" value={draft.totalExpenses ?? ""} onChange={(e) => onChange({ ...draft, totalExpenses: numericOrUndefined(e.target.value) })} /></Label>
      <Label>Saldo final<Input inputMode="decimal" value={draft.closingBalance ?? ""} onChange={(e) => onChange({ ...draft, closingBalance: numericOrUndefined(e.target.value) })} /></Label>
    </div>
    <div className="grid gap-2">
      {draft.lines.map((line, index) => <div key={`${index}-${line.date}-${line.description}`} className="grid gap-2 rounded-xl border border-cream/10 bg-cream/[0.03] p-3 md:grid-cols-[105px_120px_minmax(0,1fr)_140px_44px]">
        <Select value={line.type} onChange={(e) => updateLine(index, { type: e.target.value as "income" | "expense" })}><option value="expense">Saida</option><option value="income">Entrada</option></Select>
        <Input type="date" value={line.date} onChange={(e) => updateLine(index, { date: e.target.value })} />
        <Input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
        <Input inputMode="decimal" value={String(line.amount)} onChange={(e) => updateLine(index, { amount: Number(e.target.value.replace(",", ".")) || 0 })} />
        <Button variant="danger" className="px-2" onClick={() => onChange({ ...draft, lines: draft.lines.filter((_l, i) => i !== index) })}><Trash2 className="size-4" /></Button>
      </div>)}
    </div>
  </div>;
}

function ValidationPanel({ report }: { report: CaptureValidationReport }) {
  return <div className="rounded-xl border border-cream/10 bg-moss-950/35 p-3"><div className="grid gap-2 md:grid-cols-2">{report.checks.map((check) => <div key={check.code} className="flex items-start gap-2 text-sm">{check.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />}<span><strong className="text-cream">{check.label}</strong>{check.detail ? <span className="block text-xs text-muted">{check.detail}</span> : null}</span></div>)}</div>{report.issues.length ? <div className="mt-3 grid gap-1">{report.issues.map((issue, i) => <p key={`${issue.code}-${i}`} className={`text-xs font-bold ${issue.level === "error" ? "text-red-200" : issue.level === "warning" ? "text-amber-100" : "text-cyan-100"}`}>{issue.message}</p>)}</div> : null}</div>;
}

function ValidationBadge({ status, score }: { status: FinanceCaptureRecord["validationStatus"]; score: number }) {
  const label = status === "ready" ? "Pronto" : status === "blocked" ? "Bloqueado" : "Revisar";
  return <Badge tone={status === "ready" ? "success" : status === "blocked" ? "danger" : "warning"}>{label} · {score}</Badge>;
}

function validateDraft(draft: CaptureDraft) { return draft.type === "bank_statement" ? validateBankStatementDraft(draft.value) : validateFinancialDocumentDraft(draft.value); }
function sourceLabel(source: FinanceCaptureRecord["source"]) { return source === "whatsapp" ? "WhatsApp" : source === "open_finance" ? "Open Finance" : source === "ofx" ? "OFX" : "App"; }
function numericOrUndefined(value: string) { const n = Number(value.replace(",", ".")); return Number.isFinite(n) ? n : undefined; }

function findDuplicateWarning(draft: CaptureDraft, existing: Transaction[]) {
  const incoming = captureTransactions(draft);
  const matches = findTransactionDuplicateMatches(existing, incoming);
  if (!matches.length) return "";
  const first = matches[0];
  return `Possivel duplicidade encontrada com \"${first.existing.description}\" (${formatCurrency(first.existing.amount)}). Revise antes de confirmar.`;
}

function captureTransactions(draft: CaptureDraft): Array<Omit<Transaction, "id" | "createdAt">> {
  if (draft.type === "bank_statement") {
    return draft.value.lines.map((line) => ({
      type: line.type, description: line.description, amount: line.amount, category: line.category, person: line.person,
      date: line.date, recurring: false, source: "statement", paymentMethod: line.paymentMethod, paymentRecipient: line.paymentRecipient,
      otherCategoryDescription: line.otherCategoryDescription, notes: line.notes
    }));
  }
  const value = draft.value;
  if (value.kind === "bill") return [];
  const date = value.kind === "income" ? value.entryDate || value.documentDate : value.documentDate || value.entryDate;
  return [{
    type: value.kind === "income" ? "income" : "expense", description: value.description || value.title, amount: value.amount, category: value.category || "Outros",
    person: value.person, date: date || "", recurring: false, source: "receipt", paymentMethod: value.paymentMethod,
    paymentRecipient: value.paymentRecipient, otherCategoryDescription: value.otherCategoryDescription,
    attachmentImageName: value.attachmentImageName, attachmentDataUrl: value.attachmentDataUrl, attachmentStoragePath: value.attachmentStoragePath,
    attachmentMimeType: value.attachmentMimeType, attachmentSize: value.attachmentSize, documentItems: value.items, fiscalDocument: value.fiscalDocument,
    notes: value.notes
  }];
}

function applyDraftToFinance(draft: CaptureDraft, actions: ReturnType<typeof useFinanceStore>["actions"]) {
  if (draft.type === "bank_statement") {
    actions.addTransactions(captureTransactions(draft));
    return;
  }
  const value = draft.value;
  if (value.kind === "bill") {
    actions.addBill({
      title: value.title || value.description, description: value.description, amount: value.amount, category: value.category || "Outros",
      person: value.person, dueDate: value.dueDate || value.documentDate || "", paymentMethod: value.paymentMethod ?? "other",
      paymentCode: value.paymentCode, paymentRecipient: value.paymentRecipient, otherCategoryDescription: value.otherCategoryDescription,
      recurrence: "none", status: "pending", source: "attachment", attachmentImageName: value.attachmentImageName,
      attachmentDataUrl: value.attachmentDataUrl, attachmentStoragePath: value.attachmentStoragePath, attachmentMimeType: value.attachmentMimeType,
      attachmentSize: value.attachmentSize, documentItems: value.items, fiscalDocument: value.fiscalDocument, notes: value.notes
    });
    return;
  }
  const transaction = captureTransactions(draft)[0];
  actions.addTransaction(transaction);
}
