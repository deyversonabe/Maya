import type { FinanceAccount } from "../types";

export type FinanceDateIssue = "invalid_date" | "implausible_year" | null;

export function getFinanceDateIssue(value: string, accounts: FinanceAccount[] = [], now = new Date()): FinanceDateIssue {
  if (!isValidCalendarDateKey(value)) return "invalid_date";

  const year = Number(value.slice(0, 4));
  const currentYear = now.getFullYear();
  const openingYears = accounts
    .map((account) => Number(account.openingBalanceDate?.slice(0, 4)))
    .filter((candidate) => Number.isInteger(candidate) && candidate >= 2000 && candidate <= currentYear + 1);
  const earliestOpeningYear = openingYears.length > 0 ? Math.min(...openingYears) : currentYear;
  // Preserve at least the previous calendar year for legitimate historical imports,
  // while using an older account opening date when one really exists.
  const minYear = Math.min(currentYear - 1, earliestOpeningYear);
  const maxYear = currentYear + 1;

  return year < minYear || year > maxYear ? "implausible_year" : null;
}

export function isPlausibleFinanceDate(value: string, accounts: FinanceAccount[] = [], now = new Date()) {
  return getFinanceDateIssue(value, accounts, now) === null;
}

export function getFinanceDateIssueMessage(issue: FinanceDateIssue) {
  if (issue === "invalid_date") return "Informe uma data valida no formato AAAA-MM-DD.";
  if (issue === "implausible_year") {
    return "O ano informado esta muito fora do historico esperado. Confira o ano antes de salvar.";
  }
  return "";
}

export function isValidCalendarDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
