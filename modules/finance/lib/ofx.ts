import type { StatementTransactionDraft, Transaction } from "../types";

export interface OfxImportDraft {
  bankId?: string;
  accountId?: string;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  lines: Array<StatementTransactionDraft & { externalId?: string }>;
}

export function parseOfx(text: string): OfxImportDraft {
  const source = text.replace(/\r/g, "");
  const blocks = [...source.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|$)/gi)].map((match) => match[1]);
  const lines = blocks.map(parseOfxTransaction).filter((line): line is NonNullable<ReturnType<typeof parseOfxTransaction>> => Boolean(line));
  const start = tag(source, "DTSTART");
  const end = tag(source, "DTEND");
  const ledger = parseAmount(tag(source, "BALAMT"));
  const bankId = tag(source, "BANKID") || undefined;
  const accountId = tag(source, "ACCTID") || tag(source, "ACCTNUM") || undefined;
  const currency = tag(source, "CURDEF") || undefined;

  return {
    bankId,
    accountId,
    currency,
    periodStart: parseOfxDate(start),
    periodEnd: parseOfxDate(end),
    closingBalance: ledger,
    lines
  };
}

export function ofxLinesToTransactions(
  draft: OfxImportDraft,
  options?: { accountId?: string; person?: Transaction["person"] } | string
): Array<Omit<Transaction, "id" | "createdAt">> {
  const accountId = typeof options === "string" ? options : options?.accountId;
  const person = typeof options === "string" ? undefined : options?.person;
  const institutionId = [draft.bankId, draft.accountId].filter(Boolean).join(":") || undefined;
  return draft.lines.map((line) => ({
    type: line.type,
    description: line.description,
    amount: line.amount,
    category: line.category,
    person: person ?? line.person,
    date: line.date,
    recurring: false,
    source: "import",
    externalId: line.externalId,
    institutionId,
    accountId,
    paymentMethod: line.paymentMethod,
    paymentRecipient: line.paymentRecipient,
    notes: line.notes
  }));
}

function parseOfxTransaction(block: string) {
  const amountRaw = tag(block, "TRNAMT");
  const amountValue = parseAmount(amountRaw);
  const date = parseOfxDate(tag(block, "DTPOSTED"));
  const name = tag(block, "NAME");
  const memo = tag(block, "MEMO");
  const description = [name, memo].filter(Boolean).join(" — ").trim();
  if (amountValue === undefined || !date || !description) return null;
  const type = amountValue >= 0 ? "income" as const : "expense" as const;
  return {
    type,
    description,
    amount: Math.abs(amountValue),
    category: "Outros",
    person: "Casal" as const,
    date,
    confidence: 1,
    externalId: tag(block, "FITID") || undefined,
    notes: tag(block, "TRNTYPE") ? `OFX: ${tag(block, "TRNTYPE")}` : undefined
  };
}

function tag(source: string, name: string) {
  const xml = source.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (xml) return clean(xml[1]);
  const sgml = source.match(new RegExp(`<${name}[^>]*>([^<\\n\\r]+)`, "i"));
  return sgml ? clean(sgml[1]) : "";
}

function clean(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function parseAmount(value: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined;
}

function parseOfxDate(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
