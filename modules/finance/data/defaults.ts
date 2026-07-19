import type { FinanceState } from "../types";

const now = () => new Date().toISOString();

export function createEmptyFinanceState(): FinanceState {
  return {
    schemaVersion: 3,
    profile: {
      name: "Plataforma Juntos",
      slogan: "Organizar hoje. Construir o amanha.",
      monthlyIncomeTarget: 0,
      emergencyReserveTarget: 0
    },
    transactions: [],
    goals: [],
    budgets: [],
    bills: [],
    updatedAt: now()
  };
}

export const transactionCategories = [
  "Receita fixa",
  "Receita profissional",
  "Moradia",
  "Alimentacao",
  "Transporte",
  "Saude",
  "Familia",
  "Tecnologia",
  "Lazer",
  "Investimentos",
  "Viagem",
  "Beleza",
  "Outros"
];
