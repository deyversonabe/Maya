"use client";

import { FileImage } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { FinancialDocumentDraft, PaymentMethod, Person } from "../types";

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

        {draft.attachmentDataUrl ? (
          <a
            href={draft.attachmentDataUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-moss-950/40 px-3 text-sm font-black text-cyan-100 transition hover:border-bronze/50 hover:text-bronze"
          >
            <FileImage className="size-4" aria-hidden="true" />
            Ver anexo
          </a>
        ) : null}
      </div>

      {missingFields.length > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
          Complete antes de salvar: {missingFields.join(", ")}.
        </p>
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
  const number = Number(value.replace(/\./g, "").replace(",", "."));

  return Number.isFinite(number) && number > 0 ? number : 0;
}
