"use client";

import { useEffect, useMemo, useState } from "react";
import { createEmptyFinanceState } from "../data/defaults";
import { migrateFinanceState } from "./migrations";
import type { Budget, FinanceState, Goal, PayableBill, Transaction } from "../types";

const STORAGE_KEY = "juntos.finance.v1";

export function useFinanceStore() {
  const [state, setState] = useState<FinanceState>(() => createEmptyFinanceState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        setState(migrateFinanceState(parsed));
      } catch {
        setState(createEmptyFinanceState());
      }
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString()
      })
    );
  }, [isHydrated, state]);

  const actions = useMemo(
    () => ({
      addTransaction(transaction: Omit<Transaction, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          transactions: [
            {
              ...transaction,
              id: `txn_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.transactions
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      addTransactions(transactions: Array<Omit<Transaction, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          transactions: [
            ...transactions.map((transaction) => ({
              ...transaction,
              id: `txn_${crypto.randomUUID()}`,
              createdAt: now
            })),
            ...current.transactions
          ],
          updatedAt: now
        }));
      },
      removeTransaction(id: string) {
        setState((current) => ({
          ...current,
          transactions: current.transactions.filter((transaction) => transaction.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addGoal(goal: Omit<Goal, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          goals: [
            {
              ...goal,
              id: `goal_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.goals
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      updateGoalAmount(id: string, currentAmount: number) {
        setState((current) => ({
          ...current,
          goals: current.goals.map((goal) => (goal.id === id ? { ...goal, currentAmount } : goal)),
          updatedAt: new Date().toISOString()
        }));
      },
      removeGoal(id: string) {
        setState((current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addBudget(budget: Omit<Budget, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          budgets: [
            {
              ...budget,
              id: `budget_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.budgets.filter(
              (item) => !(item.month === budget.month && item.category === budget.category)
            )
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      removeBudget(id: string) {
        setState((current) => ({
          ...current,
          budgets: current.budgets.filter((budget) => budget.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addBill(bill: Omit<PayableBill, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          bills: [
            {
              ...bill,
              id: `bill_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.bills
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      addBills(bills: Array<Omit<PayableBill, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          bills: [
            ...bills.map((bill) => ({
              ...bill,
              id: `bill_${crypto.randomUUID()}`,
              createdAt: now
            })),
            ...current.bills
          ],
          updatedAt: now
        }));
      },
      updateBill(id: string, bill: Partial<Omit<PayableBill, "id" | "createdAt">>) {
        setState((current) => ({
          ...current,
          bills: current.bills.map((item) => (item.id === id ? { ...item, ...bill } : item)),
          updatedAt: new Date().toISOString()
        }));
      },
      markBillPaid(id: string) {
        setState((current) => ({
          ...current,
          bills: current.bills.map((bill) =>
            bill.id === id
              ? {
                  ...bill,
                  status: "paid",
                  paidAt: new Date().toISOString()
                }
              : bill
          ),
          updatedAt: new Date().toISOString()
        }));
      },
      removeBill(id: string) {
        setState((current) => ({
          ...current,
          bills: current.bills.filter((bill) => bill.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      importTransactions(transactions: Transaction[]) {
        setState((current) => ({
          ...current,
          transactions: [...transactions, ...current.transactions],
          updatedAt: new Date().toISOString()
        }));
      },
      reset() {
        const nextState = createEmptyFinanceState();
        setState(nextState);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
    }),
    []
  );

  return {
    state,
    isHydrated,
    actions
  };
}
