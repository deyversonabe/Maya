"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, FileCode2, KeyRound, Loader2, QrCode, Save } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { toInputDate } from "@/lib/utils";
import { expenseCategories, DEFAULT_FINANCE_ACCOUNT_ID } from "../data/defaults";
import { parseBrazilianFiscalXml, type FiscalNoteImportResult } from "../lib/fiscal-note-import";
import { useFinanceStore } from "../lib/use-finance-store";
import type { FinancialDocumentDraft, Person } from "../types";
import { DocumentItemsPanel } from "./document-items-panel";
import { FinancialDocumentReview } from "./financial-document-review";

const people: Person[] = ["Deyverson", "Tom", "Casal"];

export function FiscalNoteImportPage() {
  const { state, actions } = useFinanceStore();
  const qrImageRef = useRef<HTMLInputElement>(null);
  const xmlRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [person, setPerson] = useState<Person>("Casal");
  const [accountId, setAccountId] = useState(DEFAULT_FINANCE_ACCOUNT_ID);
  const [draft, setDraft] = useState<FinancialDocumentDraft | null>(null);
  const [feedback, setFeedback] = useState("Leia o QR Code, cole a chave de 44 digitos ou importe o XML da nota.");
  const [isLoading, setIsLoading] = useState(false);

  async function consultNote(value = input) {
    const trimmed = value.trim();
    if (!trimmed) {
      setFeedback("Informe o conteudo do QR Code ou a chave de acesso.");
      return;
    }
    setIsLoading(true);
    setFeedback("Consultando a nota fiscal...");
    try {
      const response = await fetch("/api/maya/fiscal-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: /^\d{44}$/.test(trimmed.replace(/\D/g, "")) ? trimmed.replace(/\D/g, "") : undefined,
          qrContent: /^\d{44}$/.test(trimmed.replace(/\D/g, "")) ? undefined : trimmed
        })
      });
      const result = (await response.json()) as FiscalNoteImportResult & {
        error?: string;
        requiresProvider?: boolean;
        accessKey?: string;
        consultationUrl?: string;
      };
      if (!response.ok) throw new Error(result.error || "Falha na consulta.");
      if (result.financialDraft) {
        setDraft({ ...result.financialDraft, person });
        setFeedback(result.message);
      } else {
        setFeedback(result.message || "Nota identificada, mas sem dados completos.");
        if (result.accessKey) setInput(result.accessKey);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel consultar a nota.");
    } finally {
      setIsLoading(false);
    }
  }

  async function readQrFromImage(file: File | undefined) {
    if (!file) return;
    setIsLoading(true);
    setFeedback("Lendo o QR Code da imagem...");
    try {
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect(source: ImageBitmap): Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!Detector) throw new Error("Este navegador nao possui leitura nativa de QR Code. Use Chrome/Edge atualizado ou cole a chave de acesso.");
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
      bitmap.close();
      const value = codes[0]?.rawValue;
      if (!value) throw new Error("Nao encontrei um QR Code legivel nessa imagem.");
      setInput(value);
      await consultNote(value);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel ler o QR Code.");
      setIsLoading(false);
    }
  }

  async function importXml(file: File | undefined) {
    if (!file) return;
    setIsLoading(true);
    setFeedback("Lendo o XML e organizando os itens...");
    try {
      const result = parseBrazilianFiscalXml(await file.text(), person);
      setDraft(result.financialDraft);
      setInput(result.financialDraft.fiscalDocument?.accessKey ?? "");
      setFeedback(result.message);
    } catch {
      setFeedback("XML invalido ou fora do padrao NF-e/NFC-e.");
    } finally {
      setIsLoading(false);
      if (xmlRef.current) xmlRef.current.value = "";
    }
  }

  function saveExpense() {
    if (!draft || draft.amount <= 0 || !(draft.documentDate || draft.entryDate || draft.dueDate)) {
      setFeedback("Confira valor e data antes de salvar a despesa.");
      return;
    }
    const date = draft.documentDate || draft.entryDate || draft.dueDate || toInputDate(new Date());
    actions.addTransaction({
      type: "expense",
      description: draft.description || draft.title,
      amount: draft.amount,
      category: draft.category,
      person: draft.person,
      date,
      recurring: false,
      source: "import",
      paymentMethod: draft.paymentMethod,
      paymentRecipient: draft.paymentRecipient,
      otherCategoryDescription: draft.otherCategoryDescription,
      documentItems: draft.items,
      fiscalDocument: draft.fiscalDocument,
      notes: draft.notes,
      accountId
    });
    setDraft(null);
    setInput("");
    setFeedback("Despesa salva com os dados da nota fiscal.");
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="info">Nova implantacao</Badge><Badge tone="success">Sem foto longa</Badge></div>
            <h1 className="mt-3 font-serif text-4xl font-bold text-cream">Importar despesa pela nota</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Use QR Code, chave de acesso ou XML. A MAYA cria um rascunho e so salva depois da sua conferencia.</p>
          </div>
          <Link href="/expenses" className="text-sm font-bold text-bronze hover:underline">Voltar para despesas</Link>
        </div>

        <LedPanel>{feedback}</LedPanel>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader eyebrow="Opcao 1" title="Ler QR Code" description="Fotografe somente o quadrado do QR Code, sem precisar enquadrar a nota inteira." />
            <input ref={qrImageRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void readQrFromImage(event.target.files?.[0])} />
            <Button className="w-full" onClick={() => qrImageRef.current?.click()} disabled={isLoading}><Camera className="h-4 w-4" /> Abrir camera</Button>
          </Card>

          <Card>
            <CardHeader eyebrow="Opcao 2" title="Chave ou link" description="Cole a chave de 44 numeros ou o conteudo completo do QR Code." />
            <Label>Chave/URL<Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="44 digitos ou URL da NFC-e" /></Label>
            <Button className="mt-3 w-full" onClick={() => void consultNote()} disabled={isLoading}><QrCode className="h-4 w-4" /> Consultar nota</Button>
          </Card>

          <Card>
            <CardHeader eyebrow="Opcao 3" title="Importar XML" description="Metodo mais completo e confiavel para trazer todos os produtos da nota." />
            <input ref={xmlRef} className="hidden" type="file" accept=".xml,text/xml,application/xml" onChange={(event) => void importXml(event.target.files?.[0])} />
            <Button className="w-full" onClick={() => xmlRef.current?.click()} disabled={isLoading}><FileCode2 className="h-4 w-4" /> Selecionar XML</Button>
          </Card>
        </div>

        <Card>
          <CardHeader eyebrow="Destino" title="Quem pagou e de qual conta" />
          <div className="grid gap-3 md:grid-cols-2">
            <Label>Pessoa<Select value={person} onChange={(event) => { const next = event.target.value as Person; setPerson(next); setDraft((current) => current ? { ...current, person: next } : current); }}>{people.map((item) => <option key={item}>{item}</option>)}</Select></Label>
            <Label>Conta<Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Label>
          </div>
        </Card>

        {isLoading ? <div className="flex items-center justify-center gap-2 rounded-xl border border-cream/10 p-8 text-cream"><Loader2 className="h-5 w-5 animate-spin" /> Processando nota fiscal...</div> : null}

        {draft ? (
          <div>
            <FinancialDocumentReview draft={draft} categories={expenseCategories} persons={people} dateField="documentDate" dateLabel="Data da compra" showPayment onChange={(patch) => setDraft((current) => current ? { ...current, ...patch } : current)} />
            {draft.items?.length ? <DocumentItemsPanel items={draft.items} /> : null}
            <Button className="w-full sm:w-auto" onClick={saveExpense}><Save className="h-4 w-4" /> Confirmar e salvar despesa</Button>
          </div>
        ) : null}

        <Card className="border-amber-300/20">
          <div className="flex gap-3"><KeyRound className="mt-1 h-5 w-5 text-amber-200" /><p className="text-sm leading-6 text-muted"><strong className="text-cream">Importante:</strong> o XML funciona imediatamente. Para a consulta automatica pelo QR Code/chave, configure no servidor uma API fiscal autorizada nas variaveis <code>FISCAL_NOTE_API_URL</code> e, quando necessario, <code>FISCAL_NOTE_API_TOKEN</code>.</p></div>
        </Card>
      </div>
    </AppShell>
  );
}
