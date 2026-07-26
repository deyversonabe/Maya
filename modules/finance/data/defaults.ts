import type { FinanceAccount, FinanceState, TransactionType } from "../types";

const now = () => new Date().toISOString();
export const DEFAULT_FINANCE_ACCOUNT_ID = "account_main";

export function createEmptyFinanceState(): FinanceState {
  return {
    schemaVersion: 4,
    profile: {
      name: "Maya",
      slogan: "Organizar hoje. Construir o amanha.",
      monthlyIncomeTarget: 0,
      emergencyReserveTarget: 0
    },
    accounts: [createDefaultFinanceAccount()],
    transactions: [],
    goals: [],
    budgets: [],
    bills: [],
    activityLogs: [],
    updatedAt: now()
  };
}

export function createDefaultFinanceAccount(): FinanceAccount {
  const timestamp = now();

  return {
    id: DEFAULT_FINANCE_ACCOUNT_ID,
    name: "Carteira do casal",
    kind: "checking",
    owner: "Casal",
    openingBalance: 0,
    openingBalanceDate: timestamp.slice(0, 10),
    color: "#55f7ff",
    createdAt: timestamp
  };
}

export const incomeCategories = [
  "Salario",
  "Sobrancelha",
  "Design de sobrancelhas",
  "Henna",
  "Brow lamination",
  "Micropigmentacao",
  "Manutencao",
  "Cabelo",
  "Jogos",
  "Outros"
];

export const expenseCategories = [
  "Moradia",
  "Alimentacao",
  "Combustivel",
  "Transporte",
  "Saude",
  "Familia",
  "Melhoria casa",
  "Conforto",
  "Manutencao",
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
