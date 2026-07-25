"use client";

import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { parseFinancialAmountInput } from "@/lib/utils";
import type { FinancialDocumentDraft, PaymentMethod, Person } from "../types";
import { AttachmentLink } from "./attachment-link";

type DateField = "documentDate" | "dueDate" | "entryDate";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  boleto: "Boleto",
  pix: "Pix copia e cola",
  card: "Cartao",
  other: "Outro"
};

const missingFieldLabels: Record<string, string> = {
  title: "nome",
  description: "descricao",
  amount: "valor",
  documentDate: "data",
  dueDate: "vencimento",
  entryDate: "data de entrada"
};

export function FinancialDocumentReview({
  draft,
  categories,
  persons,
  dateField,
  dateLabel,
  titleLabel = "Nome",
  showPayment = false,
  onChange
}: {
  draft: FinancialDocumentDraft;
  categories: string[];
  persons: Person[];
  dateField: DateField;
  dateLabel: string;
  titleLabel?: string;
  showPayment?: boolean;
  onChange: (patch: Partial<FinancialDocumentDraft>) => void;
}) {
  const confidence = Math.round((draft.confidence || 0) * 100);
  const dateValue = draft[dateField] || draft.documentDate || draft.dueDate || draft.entryDate || "";
  const missingFields = draft.missingFields
    .map((field) => missingFieldLabels[field] ?? field)
    .filter(Boolean);
  const fiscalEntries = buildFiscalEntries(draft);

  return (
    <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl font-bold text-cyan-50">Dados do anexo</h3>
            <Badge tone="info">Editavel</Badge>
            {confidence > 0 ? <Badge tone={confidence >= 75 ? "success" : "warning"}>Leitura {confidence}%</Badge> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-cyan-100">
            Confira o que a MAYA encontrou e ajuste qualquer campo antes de salvar.
          </p>
        </div>

        <AttachmentLink
          dataUrl={draft.attachmentDataUrl}
          storagePath={draft.attachmentStoragePath}
          imageName={draft.attachmentImageName}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-moss-950/40 px-3 text-sm font-black text-cyan-100 transition hover:border-bronze/50 hover:text-bronze"
        />
      </div>

      {missingFields.length > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
          Complete antes de salvar: {missingFields.join(", ")}.
        </p>
      ) : null}

      {fiscalEntries.length > 0 ? (
        <div className="mb-4 rounded-lg border border-bronze/25 bg-bronze/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-bronze">Dados fiscais lidos</p>
          <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            {fiscalEntries.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-md border border-cream/10 bg-moss-950/35 p-2">
                <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
                <dd className="mt-1 break-words font-semibold text-cream">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
        <Label>
          {titleLabel}
          <Input
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Nome identificado no anexo"
          />
        </Label>
        <Label>
          Categoria
          <Select value={draft.category} onChange={(event) => onChange({ category: event.target.value })}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Valor
          <Input
            inputMode="decimal"
            value={draft.amount > 0 ? String(draft.amount) : ""}
            onChange={(event) => onChange({ amount: parseMoney(event.target.value) })}
            placeholder="0,00"
          />
        </Label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <Label>
          Descricao
          <Input
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Descricao da nota ou comprovante"
          />
        </Label>
        <Label>
          {dateLabel}
          <Input type="date" value={dateValue} onChange={(event) => onChange({ [dateField]: event.target.value })} />
        </Label>
        <Label>
          Pessoa
          <Select value={draft.person} onChange={(event) => onChange({ person: event.target.value as Person })}>
            {persons.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      {showPayment ? (
      <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <Label>
            Pagamento
            <Select
              value={draft.paymentMethod ?? "boleto"}
              onChange={(event) => onChange({ paymentMethod: event.target.value as PaymentMethod })}
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
              value={draft.paymentCode ?? ""}
              onChange={(event) => onChange({ paymentCode: event.target.value })}
              placeholder="Codigo identificado no anexo"
            />
          </Label>
        </div>
      ) : null}

      {showPayment && draft.paymentMethod === "pix" ? (
        <Label className="mt-3">
          Para quem foi feito
          <Input
            value={draft.paymentRecipient ?? ""}
            onChange={(event) => onChange({ paymentRecipient: event.target.value })}
            placeholder="Nome da pessoa ou empresa"
          />
        </Label>
      ) : null}

      {draft.category === "Outros" ? (
        <Label className="mt-3">
          Descrever outros
          <Input
            value={draft.otherCategoryDescription ?? ""}
            onChange={(event) => onChange({ otherCategoryDescription: event.target.value })}
            placeholder="Opcional: detalhe a categoria"
          />
        </Label>
      ) : null}

      <Label className="mt-3">
        Observacoes
        <Textarea
          value={draft.notes ?? ""}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Detalhes extras encontrados ou anotacoes suas"
        />
      </Label>
    </div>
  );
}

function parseMoney(value: string) {
  const number = parseFinancialAmountInput(value);

  return Number.isFinite(number) && number > 0 ? number : 0;
}

function buildFiscalEntries(draft: FinancialDocumentDraft): Array<[string, string]> {
  const fiscalDocument = draft.fiscalDocument;

  if (!fiscalDocument) {
    return [];
  }

  const typeLabels: Record<string, string> = {
    danfe_nfe: "DANFE NF-e",
    danfe_nfce: "DANFE NFC-e",
    cupom_fiscal: "Cupom fiscal",
    boleto: "Boleto",
    pix: "Pix",
    recibo: "Recibo",
    extrato: "Extrato",
    unknown: "Documento nao identificado"
  };
  const entries: Array<[string, string]> = [];

  if (fiscalDocument.documentType) {
    entries.push(["Tipo", typeLabels[fiscalDocument.documentType] ?? fiscalDocument.documentType]);
  }

  if (fiscalDocument.issuerName) {
    entries.push(["Emissor", fiscalDocument.issuerName]);
  }

  if (fiscalDocument.issuerCnpj) {
    entries.push(["CNPJ", fiscalDocument.issuerCnpj]);
  }

  if (fiscalDocument.documentNumber) {
    entries.push(["Numero", fiscalDocument.documentNumber]);
  }

  if (fiscalDocument.series) {
    entries.push(["Serie", fiscalDocument.series]);
  }

  if (fiscalDocument.accessKey) {
    entries.push(["Chave de acesso", fiscalDocument.accessKey]);
  }

  if (fiscalDocument.protocolNumber) {
    entries.push(["Protocolo", fiscalDocument.protocolNumber]);
  }

  return entries;
}
