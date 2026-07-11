import type { Person, Transaction, TransactionType } from "../types";

const validTypes = new Set<TransactionType>(["income", "expense", "investment", "transfer"]);
const validPeople = new Set<Person>(["Pessoa 1", "Pessoa 2", "Casal"]);

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
  const amount = Number(value("amount")?.replace(",", "."));
  const personValue = value("person") as Person;
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
    person: validPeople.has(personValue) ? personValue : "Casal",
    date,
    recurring: value("recurring") === "true",
    notes: value("notes") || undefined,
    createdAt: new Date().toISOString()
  };
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
