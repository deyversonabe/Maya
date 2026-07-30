import type { FinanceState, PayableBill, Transaction } from "../types";
import { getBillEffectiveStatus } from "./calculations";

export type FinanceReportPeriod = {
  start: string;
  end: string;
  label: string;
};

export type FinanceReport = {
  generatedAt: string;
  period: FinanceReportPeriod;
  summary: {
    income: number;
    expenses: number;
    investments: number;
    transfers: number;
    balance: number;
    pendingBills: number;
    paidBills: number;
    overdueBills: number;
    goalsCurrent: number;
    goalsTarget: number;
  };
  transactions: Transaction[];
  bills: PayableBill[];
  recurring: Array<{
    key: string;
    label: string;
    total: number;
    count: number;
  }>;
  incomeByCategory: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    total: number;
    count: number;
  }>;
};

export function createCurrentMonthReportPeriod(date = new Date()): FinanceReportPeriod {
  const month = date.toISOString().slice(0, 7);
  return createMonthReportPeriod(month);
}

export function createMonthReportPeriod(month: string): FinanceReportPeriod {
  const start = `${month}-01`;
  const end = new Date(`${month}-01T00:00:00`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);

  return {
    start,
    end: end.toISOString().slice(0, 10),
    label: month
  };
}

export function buildFinanceReport(state: FinanceState, period: FinanceReportPeriod): FinanceReport {
  const transactions = state.transactions
    .filter((transaction) => isDateInsidePeriod(transaction.date, period))
    .sort((left, right) => left.date.localeCompare(right.date));

  const bills = state.bills
    .filter((bill) => isDateInsidePeriod(bill.dueDate, period))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  const income = sumTransactions(transactions, "income");
  const transactionExpenses = sumTransactions(transactions, "expense");
  const billExpenses = sumAllBills(bills);
  const expenses = transactionExpenses + billExpenses;
  const investments = sumTransactions(transactions, "investment");
  const transfers = sumTransactions(transactions, "transfer");

  return {
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      income,
      expenses,
      investments,
      transfers,
      balance: income - expenses - investments,
      pendingBills: sumBillsByEffectiveStatus(bills, "pending"),
      paidBills: sumBillsByEffectiveStatus(bills, "paid"),
      overdueBills: sumBillsByEffectiveStatus(bills, "overdue"),
      goalsCurrent: state.goals.reduce((total, goal) => total + goal.currentAmount, 0),
      goalsTarget: state.goals.reduce((total, goal) => total + goal.targetAmount, 0)
    },
    transactions,
    bills,
    recurring: buildRecurringReport(transactions, bills),
    incomeByCategory: buildCategoryReport(transactions.filter((transaction) => transaction.type === "income")),
    expensesByCategory: buildExpenseCategoryReport(
      transactions.filter((transaction) => transaction.type === "expense"),
      bills
    )
  };
}

export function buildReportFilename(report: FinanceReport, extension: "pdf" | "xls" | "json") {
  const safeLabel = report.period.label.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  return `maya-relatorio-${safeLabel}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function isDateInsidePeriod(date: string, period: FinanceReportPeriod) {
  return date >= period.start && date <= period.end;
}

function sumTransactions(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function sumBillsByEffectiveStatus(bills: PayableBill[], status: PayableBill["status"]) {
  return bills
    .filter((bill) => getBillEffectiveStatus(bill) === status)
    .reduce((total, bill) => total + bill.amount, 0);
}

function sumAllBills(bills: PayableBill[]) {
  return bills.reduce((total, bill) => total + bill.amount, 0);
}

function buildCategoryReport(transactions: Transaction[]) {
  const grouped = transactions.reduce<Record<string, { category: string; total: number; count: number }>>(
    (groups, transaction) => {
      const current = groups[transaction.category] ?? {
        category: transaction.category,
        total: 0,
        count: 0
      };

      current.total += transaction.amount;
      current.count += 1;
      groups[transaction.category] = current;
      return groups;
    },
    {}
  );

  return Object.values(grouped).sort((left, right) => right.total - left.total);
}

function buildExpenseCategoryReport(transactions: Transaction[], bills: PayableBill[]) {
  const grouped = transactions.reduce<Record<string, { category: string; total: number; count: number }>>(
    (groups, transaction) => {
      const current = groups[transaction.category] ?? {
        category: transaction.category,
        total: 0,
        count: 0
      };

      current.total += transaction.amount;
      current.count += 1;
      groups[transaction.category] = current;
      return groups;
    },
    {}
  );

  bills.forEach((bill) => {
    const current = grouped[bill.category] ?? {
      category: bill.category,
      total: 0,
      count: 0
    };

    current.total += bill.amount;
    current.count += 1;
    grouped[bill.category] = current;
  });

  return Object.values(grouped).sort((left, right) => right.total - left.total);
}

function buildRecurringReport(transactions: Transaction[], bills: PayableBill[]) {
  const groups = new Map<string, { key: string; label: string; total: number; count: number }>();

  transactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const label = transaction.paymentRecipient || transaction.description || transaction.category;
      addRecurringGroup(groups, `txn_${label}`, label, transaction.amount);
    });

  bills.forEach((bill) => {
    const label = bill.paymentRecipient || bill.title || bill.category;
    addRecurringGroup(groups, `bill_${label}`, label, bill.amount);
  });

  return Array.from(groups.values())
    .filter((group) => group.count > 1)
    .sort((left, right) => right.total - left.total)
    .slice(0, 20);
}

function addRecurringGroup(
  groups: Map<string, { key: string; label: string; total: number; count: number }>,
  key: string,
  label: string,
  amount: number
) {
  const normalizedKey = key.toLowerCase().trim();
  const current = groups.get(normalizedKey) ?? {
    key: normalizedKey,
    label,
    total: 0,
    count: 0
  };

  current.total += amount;
  current.count += 1;
  groups.set(normalizedKey, current);
}
