import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeValue);
}

export function formatUnitCost(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(safeValue);
}

export function formatPercent(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(safeValue) + "%";
}

export function parseFinancialAmountInput(value: string) {
  const text = value.trim().replace(/[^\d,.-]/g, "");

  if (!text) {
    return Number.NaN;
  }

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  // Milhar em pt-BR precisa ser tratado antes de Number(), evitando gravar "1.500" como R$ 1,50.
  const thousandsOnly = /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(text);
  const normalized =
    hasComma && hasDot
      ? text.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? text.replace(",", ".")
        : hasDot && thousandsOnly
          ? text.replace(/\./g, "")
          : text;

  return Number(normalized);
}

export function toInputDate(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return APP_DATE_FORMATTER.format(date);
}

export const APP_TIME_ZONE = "America/Sao_Paulo";

const APP_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function toDateKey(date = new Date()) {
  return toInputDate(date);
}

export function getCurrentMonthKey(date = new Date()) {
  return toInputDate(date).slice(0, 7);
}

export function toLocalTimestamp(date = new Date()) {
  const dateKey = toInputDate(date);

  if (!dateKey) {
    return "";
  }

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);

  return `${dateKey}T${time}`;
}

function isValidMonthKey(monthKey: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);
}

export function monthKeyAdd(monthKey: string, offset: number) {
  if (!isValidMonthKey(monthKey) || !Number.isFinite(offset)) {
    return monthKey;
  }

  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + Math.trunc(offset);
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12 + 12) % 12;

  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export function getMonthEndDate(monthKey: string) {
  if (!isValidMonthKey(monthKey)) {
    return monthKey;
  }

  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}

export function addMonthsSafe(dateValue: string, offset: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isFinite(offset)) {
    return dateValue;
  }

  const monthKey = dateValue.slice(0, 7);

  if (!isValidMonthKey(monthKey)) {
    return dateValue;
  }

  const day = Number(dateValue.slice(8, 10));
  const targetMonth = monthKeyAdd(monthKey, offset);
  const lastDay = Number(getMonthEndDate(targetMonth).slice(8, 10));
  const safeDay = Math.min(Math.max(day, 1), lastDay);

  return `${targetMonth}-${String(safeDay).padStart(2, "0")}`;
}

export function buildMonthKeyRange(anchorMonth: string, fromOffset: number, toOffset: number) {
  const months: string[] = [];

  for (let offset = fromOffset; offset <= toOffset; offset += 1) {
    months.push(monthKeyAdd(anchorMonth, offset));
  }

  return months;
}

export function isNegativeFinancialValue(value: number | string) {
  if (typeof value === "number") {
    return value < 0;
  }

  const normalized = value.replace(/\s/g, "").replace("−", "-");
  return normalized.includes("-") && /\d/.test(normalized);
}

export function financialValueClass(value: number | string, positiveClassName = "financial-positive") {
  return isNegativeFinancialValue(value) ? "financial-negative" : positiveClassName;
}
