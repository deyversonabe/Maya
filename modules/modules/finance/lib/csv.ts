import { parseFinancialAmountInput } from "@/lib/utils";
import type { Person, Transaction, TransactionType } from "../types";

const validTypes = new Set<TransactionType>(["income", "expense", "investment", "transfer"]);
const validPeople = new Set<Person>(["Deyverson", "Tom", "Casal"]);

export function parseTransactionsCsv(csv: string): Transaction[] {
  const [headerLine, ...lines] = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!headerLine) {
    return [];
  }

  const headers = splitCsvLine(headerLine).map((header) => header.toLowerCase());

  return lines
    .map((line) => splitCsvLine(line))
    .map((columns) => rowToTransaction(headers, columns))
    .filter((transaction): transaction is Transaction => Boolean(transaction));
}

function rowToTransaction(headers: string[], columns: string[]): Transaction | null {
  const value = (name: string) => columns[headers.indexOf(name)]?.trim();
  const type = value("type") as TransactionType;
  const amount = parseFinancialAmountInput(value("amount") ?? "");
  const personValue = normalizeImportedPerson(value("person"));
  const date = value("date");
  const description = value("description");

  if (!validTypes.has(type) || !Number.isFinite(amount) || amount <= 0 || !date || !description) {
    return null;
  }

  return {
    id: `txn_${crypto.randomUUID()}`,
    type,
    description,
    amount,
    category: value("category") || "Outros",
    person: personValue,
    date,
    recurring: value("recurring") === "true",
    notes: value("notes") || undefined,
    createdAt: new Date().toISOString()
  };
}

function normalizeImportedPerson(person: string | undefined): Person {
  if (person === "Deyveron" || person === "Pessoa 1") {
    return "Deyverson";
  }

  if (person === "Pessoa 2") {
    return "Tom";
  }

  return validPeople.has(person as Person) ? (person as Person) : "Casal";
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}
