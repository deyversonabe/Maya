"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createEmptyFinanceState } from "../data/defaults";
import { migrateFinanceState } from "./migrations";
import { findDuplicateTransaction, partitionDuplicates } from "./duplicates";
import type { Budget, DuplicateMatch, FinanceState, Goal, HouseholdMember, Transaction } from "../types";

const STORAGE_KEY = "maya.finance.v1";
const LEGACY_STORAGE_KEY = "juntos.finance.v1";

export function useFinanceStore() {
  const [state, setState] = useState<FinanceState>(() => createEmptyFinanceState());
  const [isHydrated, setIsHydrated] = useState(false);
const stateRef = useRef(state);

useEffect(() => {
  stateRef.current = state;
}, [state]);

useEffect(() => {
  const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

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
    addTransaction(transaction: Omit<Transaction, "id" | "createdAt">): { saved: boolean; duplicate: DuplicateMatch | null } {
      const duplicate = findDuplicateTransaction(transaction, stateRef.current.transactions);

    if (duplicate && duplicate.confidence === "exact") {
      return { saved: false, duplicate };
    }

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

    return { saved: true, duplicate };
    },
    addTransactions(transactions: Array<Omit<Transaction, "id" | "createdAt">>): { addedCount: number; skippedCount: number } {
      const now = new Date().toISOString();
      const withIds = transactions.map((transaction) => ({
        ...transaction,
        id: `txn_${crypto.randomUUID()}`,
        createdAt: now
              }));

    const { accepted, skipped } = partitionDuplicates(withIds, stateRef.current.transactions);

    if (accepted.length > 0) {
      setState((current) => ({
        ...current,
        transactions: [...accepted, ...current.transactions],
        updatedAt: now
      }));
    }

    return { addedCount: accepted.length, skippedCount: skipped.length };
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
    importTransactions(transactions: Transaction[]): { addedCount: number; skippedCount: number } {
      const { accepted, skipped } = partitionDuplicates(transactions, stateRef.current.transactions);

    if (accepted.length > 0) {
      setState((current) => ({
        ...current,
        transactions: [...accepted, ...current.transactions],
        updatedAt: new Date().toISOString()
      }));
    }

    return { addedCount: accepted.length, skippedCount: skipped.length };
    },
    addMember(name: string): HouseholdMember | null {
      const trimmed = name.trim();

    if (!trimmed) {
      return null;
    }

    const exists = stateRef.current.members.some(
      (member) => member.name.trim().toLowerCase() === trimmed.toLowerCase()
      );

    if (exists) {
      return null;
    }

    const member: HouseholdMember = {
      id: `member_${crypto.randomUUID()}`,
      name: trimmed,
      createdAt: new Date().toISOString()
    };

      setState((current) => ({
        ...current,
        members: [...current.members, member],
        updatedAt: new Date().toISOString()
      }));

    return member;
    },
    removeMember(id: string) {
      setState((current) => ({
               ...current,
        members: current.members.filter((member) => member.id !== id),
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
