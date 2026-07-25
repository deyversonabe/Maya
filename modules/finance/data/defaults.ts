import type { FinanceState, TransactionType } from "../types";

const now = () => new Date().toISOString();

export function createEmptyFinanceState(): FinanceState {
  return {
    schemaVersion: 3,
    profile: {
      name: "Maya",
      slogan: "Organizar hoje. Construir o amanha.",
      monthlyIncomeTarget: 0,
      emergencyReserveTarget: 0
    },
    transactions: [],
    goals: [],
    budgets: [],
    bills: [],
    activityLogs: [],
    updatedAt: now()
  };
}

export const incomeCategories = [
  "Salario",
  "Sobrancelha",
  "Henna",
  "Cabelo",
  "Jogos",
  "Outros"
];

export const expenseCategories = [
  "Moradia",
  "Alimentacao",
  "Transporte",
  "Saude",
  "Familia",
  "Tecnologia",
  "Lazer",
  "Beleza",
  "Viagem",
  "Boleto",
  "Pix",
  "Outros"
];

export const investmentCategories = ["Investimentos", "Reserva", "Outros"];

export const transferCategories = ["Transferencia entre contas", "Outros"];

export const transactionCategories = [
  "Receita fixa",
  "Receita profissional",
  ...incomeCategories,
  ...expenseCategories,
  ...investmentCategories,
  ...transferCategories
].filter((category, index, categories) => categories.indexOf(category) === index);

export function getTransactionCategoriesByType(type: TransactionType) {
  if (type === "income") {
    return incomeCategories;
  }

  if (type === "expense") {
    return expenseCategories;
  }

  if (type === "investment") {
    return investmentCategories;
  }

  return transferCategories;
}
