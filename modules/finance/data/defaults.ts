import type { FinanceState, HouseholdMember } from "../types";

const now = () => new Date().toISOString();

export function createDefaultMembers(): HouseholdMember[] {
  return [
    { id: "member_pessoa_1", name: "Pessoa 1", createdAt: now() },
    { id: "member_pessoa_2", name: "Pessoa 2", createdAt: now() }
    ];
}

export function createEmptyFinanceState(): FinanceState {
  return {
    schemaVersion: 3,
    profile: {
      name: "Plataforma Maya",
      slogan: "Organizar hoje. Construir o amanha.",
      monthlyIncomeTarget: 0,
      emergencyReserveTarget: 0
    },
    members: createDefaultMembers(),
    transactions: [],
    goals: [],
    budgets: [],
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
  "Transferencia interna",
  "Outros"
  ];
