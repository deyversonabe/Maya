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
    maximumFractionDigits: 6
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
  const normalized =
    hasComma && hasDot
      ? text.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? text.replace(",", ".")
        : text;

  return Number(normalized);
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
