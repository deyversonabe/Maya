import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
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
