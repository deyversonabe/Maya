import { getCurrentMonthKey, getMonthEndDate, toDateKey } from "@/lib/utils";
import { DEFAULT_FINANCE_ACCOUNT_ID, createDefaultFinanceAccount } from "../data/defaults";
import type { FinanceAccount, FinanceState, PayableBill, Transaction } from "../types";

export type AccountBalanceSummary = {
  account: FinanceAccount;
  income: number;
  debit: number;
  balance: number;
};

export type FinancialPosition = {
  month: string;
  cutoffDate: string;
  currentBalance: number;
  pendingBills: number;
  overdueBills: number;
  unpaidBills: number;
  projectedBalance: number;
  accountSummaries: AccountBalanceSummary[];
};

/**
 * Central source of truth for account balances.
 *
 * Balance semantics:
 * - opening balances are included when their date is on/before the cutoff;
 * - income increases the balance;
 * - expenses and investments reduce the balance;
 * - transfers remain neutral until real account-to-account transfers exist;
 * - only paid bills reduce the current balance;
 * - pending/overdue bills are exposed separately and reduce projected balance.
 */
export function buildAccountBalanceSummaries(
  accounts: FinanceAccount[],
  transactions: Transaction[],
  bills: PayableBill[],
  cutoffDate: string
): AccountBalanceSummary[] {
  const displayAccounts = normalizeFinanceAccounts(accounts);
  const summaries = displayAccounts.map((account) => ({
    account,
    income: 0,
    debit: 0,
    balance: account.openingBalanceDate <= cutoffDate ? account.openingBalance : 0
  }));
  const byId = new Map(summaries.map((summary) => [summary.account.id, summary]));

  transactions
    .filter((transaction) => transaction.date <= cutoffDate)
    .forEach((transaction) => {
      const summary = byId.get(getEffectiveAccountId(transaction.accountId, displayAccounts));
      if (!summary) return;

      const amount = getSignedTransactionAmount(transaction);
      summary.balance += amount;

      if (amount > 0) summary.income += amount;
      if (amount < 0) summary.debit += Math.abs(amount);
    });

  bills
    .filter((bill) => bill.status === "paid")
    .filter((bill) => getBillBalanceDate(bill) <= cutoffDate)
    .forEach((bill) => {
      const summary = byId.get(getEffectiveAccountId(bill.accountId, displayAccounts));
      if (!summary) return;

      summary.debit += bill.amount;
      summary.balance -= bill.amount;
    });

  return summaries;
}

export function buildFinancialPosition(
  state: Pick<FinanceState, "accounts" | "transactions" | "bills">,
  month = getCurrentMonthKey(),
  now = new Date()
): FinancialPosition {
  const today = toDateKey(now);
  const cutoffDate = getBalanceCutoffDate(month, now);
  const accountSummaries = buildAccountBalanceSummaries(state.accounts, state.transactions, state.bills, cutoffDate);
  const currentBalance = accountSummaries.reduce((total, summary) => total + summary.balance, 0);

  const unpaidMonthBills = state.bills.filter(
    (bill) => bill.status !== "paid" && bill.dueDate.startsWith(month) && bill.dueDate <= getMonthEndDate(month)
  );
  const overdueBills = unpaidMonthBills
    .filter((bill) => bill.dueDate < today)
    .reduce((total, bill) => total + bill.amount, 0);
  const pendingBills = unpaidMonthBills
    .filter((bill) => bill.dueDate >= today)
    .reduce((total, bill) => total + bill.amount, 0);
  const unpaidBills = pendingBills + overdueBills;

  return {
    month,
    cutoffDate,
    currentBalance,
    pendingBills,
    overdueBills,
    unpaidBills,
    projectedBalance: currentBalance - unpaidBills,
    accountSummaries
  };
}

export function getBalanceCutoffDate(month: string, now = new Date()) {
  const today = toDateKey(now);
  const currentMonth = today.slice(0, 7);
  return month === currentMonth ? today : getMonthEndDate(month);
}

export function getBillBalanceDate(bill: PayableBill) {
  return bill.paidAt?.slice(0, 10) || bill.dueDate;
}

export function getSignedTransactionAmount(transaction: Transaction) {
  if (transaction.type === "income") return transaction.amount;
  if (transaction.type === "transfer") return 0;
  return -transaction.amount;
}

export function getEffectiveAccountId(accountId: string | undefined, accounts: FinanceAccount[]) {
  return accounts.some((account) => account.id === accountId)
    ? accountId ?? DEFAULT_FINANCE_ACCOUNT_ID
    : DEFAULT_FINANCE_ACCOUNT_ID;
}

export function normalizeFinanceAccounts(accounts: FinanceAccount[]) {
  if (accounts.length > 0) return accounts;
  return [createDefaultFinanceAccount()];
}
