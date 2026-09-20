import {
  addMonthsSafe,
  buildMonthKeyRange,
  formatCurrency,
  formatPercent,
  getCurrentMonthKey,
  toDateKey
} from "@/lib/utils";
import type {
  BillAlert,
  BillStatus,
  BudgetUsage,
  FinancialHealthAlert,
  FinanceAccount,
  FinanceState,
  FinanceSummary,
  Goal,
  MayaAnalysis,
  MonthSummary,
  PayableBill,
  Transaction
} from "../types";
import { buildFinancialPosition } from "./balance";
import { findPaidBillTransactionDuplicateMatches } from "./duplicates";
import { isPlausibleFinanceDate, isValidCalendarDateKey } from "./date-validation";

export { getCurrentMonthKey } from "@/lib/utils";

export function calculateSummary(state: FinanceState, now = new Date()): FinanceSummary {
  const currentMonth = getCurrentMonthKey(now);
  const today = toDateKey(now);
  const monthTransactions = getTransactionsByMonthUntil(state.transactions, currentMonth, today);
  const monthBills = getPaidBillsByPaymentMonthUntil(state.bills, currentMonth, today);
  const position = buildFinancialPosition(state, currentMonth, now);

  const income = sumByType(monthTransactions, "income");
  const expenses = calculateMonthExpenseTotal(monthTransactions, monthBills);
  const investments = sumByType(monthTransactions, "investment");
  const periodResult = income - expenses - investments;
  const realizedSavingsRate = income > 0 ? ((income - expenses) / income) * 100 : null;
  const projectedSavingsRate =
    income > 0 ? ((income - expenses - position.unpaidBills) / income) * 100 : null;
  const hasKnownOutflow = expenses > 0 || position.unpaidBills > 0;
  const savingsRate = hasKnownOutflow ? projectedSavingsRate : null;

  const categoryTotals = buildExpenseCategoryTotals(monthTransactions, monthBills);

  const biggestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const goalsTotal = state.goals.reduce((total, goal) => total + goal.targetAmount, 0);
  const goalsProgress = state.goals.reduce((total, goal) => total + goal.currentAmount, 0);

  return {
    currentMonth,
    income,
    expenses,
    investments,
    periodResult,
    currentBalance: position.currentBalance,
    availableBalance: position.currentBalance,
    pendingBills: position.pendingBills,
    overdueBills: position.overdueBills,
    unpaidBills: position.unpaidBills,
    projectedBalance: position.projectedBalance,
    savingsRate,
    realizedSavingsRate,
    projectedSavingsRate,
    goalsTotal,
    goalsProgress,
    biggestExpenseCategory: biggestCategory?.[0] ?? "Sem despesas",
    biggestExpenseAmount: biggestCategory?.[1] ?? 0
  };
}

export function buildMonthlyFlow(
  transactions: Transaction[],
  bills: PayableBill[] = [],
  accounts: FinanceAccount[] = [],
  now = new Date()
) {
  const today = toDateKey(now);
  const months = buildMonthKeyRange(getCurrentMonthKey(now), -5, 0);
  const partialState = { accounts, transactions, bills };

  return months.map((month) => {
    const monthTransactions = getTransactionsByMonthUntil(transactions, month, today);
    const monthBills = getPaidBillsByPaymentMonthUntil(bills, month, today);
    const income = sumByType(monthTransactions, "income");
    const expenses = calculateMonthExpenseTotal(monthTransactions, monthBills);
    const investments = sumByType(monthTransactions, "investment");
    const periodResult = income - expenses - investments;
    const position = buildFinancialPosition(partialState, month, now);

    return {
      month,
      income,
      expenses,
      investments,
      periodResult,
      closingBalance: position.currentBalance
    };
  });
}

export function buildMonthSummaries(
  transactions: Transaction[],
  monthCount = 6,
  bills: PayableBill[] = [],
  now = new Date()
): MonthSummary[] {
  const today = toDateKey(now);
  const months = buildMonthKeyRange(today.slice(0, 7), -(monthCount - 1), 0);

  return months.map((month) => {
    const monthTransactions = getTransactionsByMonthUntil(transactions, month, today);
    const monthBills = getPaidBillsByPaymentMonthUntil(bills, month, today);
    const income = sumByType(monthTransactions, "income");
    const expenses = calculateMonthExpenseTotal(monthTransactions, monthBills);
    const investments = sumByType(monthTransactions, "investment");
    const periodResult = income - expenses - investments;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
      month,
      income,
      expenses,
      investments,
      periodResult,
      availableBalance: periodResult,
      savingsRate
    };
  });
}

export function buildInsights(state: FinanceState) {
  const summary = calculateSummary(state);
  const budgetSummary = buildBudgetSummary(state, summary.currentMonth);
  const insights: Array<{ title: string; body: string; tone: "success" | "warning" | "info" }> = [];

  if (state.transactions.length === 0 && state.bills.length === 0) {
    return [
      {
        title: "Sem dados financeiros reais",
        body: "Cadastre receitas, despesas ou uma nota para que a MAYA comece a analisar o cenario do casal com base em informacoes reais.",
        tone: "info" as const
      }
    ];
  }

  if (summary.income === 0 || summary.savingsRate === null) {
    insights.push({
      title: "Dados insuficientes para economia",
      body:
        summary.income === 0
          ? "Cadastre as receitas do mes para calcular a taxa de economia com seguranca."
          : "Ainda nao ha despesas ou contas conhecidas suficientes para tratar 100% da renda como economia real.",
      tone: "info"
    });
  } else if (summary.savingsRate >= 30 && summary.projectedBalance >= 0) {
    insights.push({
      title: "Ritmo positivo",
      body: `Considerando as contas conhecidas do mes, a economia projetada esta em ${formatPercent(summary.savingsRate)}.`,
      tone: "success"
    });
  } else if (summary.savingsRate >= 10 && summary.projectedBalance >= 0) {
    insights.push({
      title: "Bom caminho",
      body: `A economia projetada esta em ${formatPercent(summary.savingsRate)}. Um pequeno ajuste em gastos variaveis pode acelerar as metas.`,
      tone: "info"
    });
  } else {
    insights.push({
      title: "Atencao ao caixa",
      body:
        summary.projectedBalance < 0
          ? `Depois das contas ainda nao pagas do mes, o saldo projetado fica em ${formatCurrency(summary.projectedBalance)}.`
          : "As despesas e contas conhecidas estao ocupando grande parte da renda do mes. Vale revisar recorrencias e compras recentes.",
      tone: "warning"
    });
  }

  if (summary.biggestExpenseAmount > 0) {
    insights.push({
      title: "Categoria em destaque",
      body: `${summary.biggestExpenseCategory} e a maior categoria de gasto do mes. Comparar com o mes anterior pode revelar padroes.`,
      tone: "info"
    });
  }

  if (budgetSummary.exceededCount > 0) {
    insights.push({
      title: "Orcamento excedido",
      body: `${budgetSummary.exceededCount} categoria(s) passaram do limite no mes. A melhor acao e pausar gastos variaveis dessas categorias.`,
      tone: "warning"
    });
  } else if (budgetSummary.attentionCount > 0) {
    insights.push({
      title: "Orcamento em atencao",
      body: `${budgetSummary.attentionCount} categoria(s) estao perto do limite. Ainda da tempo de ajustar com calma.`,
      tone: "info"
    });
  }

  const urgentGoal = state.goals
    .map((goal) => ({ goal, progress: getGoalProgress(goal) }))
    .filter((item) => item.progress < 70)
    .sort((a, b) => a.progress - b.progress)[0];

  if (urgentGoal) {
    insights.push({
      title: "Meta para cuidar",
      body: `${urgentGoal.goal.name} esta com ${formatPercent(urgentGoal.progress)} de progresso. Um aporte pequeno e recorrente ja muda a curva.`,
      tone: "warning"
    });
  }

  return insights.slice(0, 4);
}

export function buildFinancialHealthAlerts(state: FinanceState, now = new Date()): FinancialHealthAlert[] {
  const today = toDateKey(now);
  const currentMonth = today.slice(0, 7);
  const currentTransactions = getTransactionsByMonthUntil(state.transactions, currentMonth, today);
  const currentBills = getPaidBillsByPaymentMonthUntil(state.bills, currentMonth, today);
  const previousMonths = buildMonthSummaries(state.transactions, 4, state.bills, now).filter((month) => month.month !== currentMonth);
  const currentIncome = sumByType(currentTransactions, "income");
  const currentExpenses = calculateMonthExpenseTotal(currentTransactions, currentBills);
  const averageIncome = average(previousMonths.map((month) => month.income).filter((value) => value > 0));
  const averageExpenses = average(previousMonths.map((month) => month.expenses).filter((value) => value > 0));
  const alerts: FinancialHealthAlert[] = [];
  const createdAt = now.toISOString();

  if (averageExpenses > 0 && currentExpenses > averageExpenses * 1.35) {
    alerts.push({
      id: "expense_above_routine",
      title: "Despesa acima da rotina",
      message: `As saidas do mes chegaram a ${formatCurrency(currentExpenses)}, acima da media recente de ${formatCurrency(averageExpenses)}.`,
      priority: currentExpenses > averageExpenses * 1.75 ? "critical" : "warning",
      createdAt
    });
  }

  if (averageIncome > 0 && currentIncome > 0 && currentIncome < averageIncome * 0.75) {
    alerts.push({
      id: "income_below_routine",
      title: "Renda abaixo da rotina",
      message: `As entradas do mes estao em ${formatCurrency(currentIncome)}, abaixo da media recente de ${formatCurrency(averageIncome)}.`,
      priority: "warning",
      createdAt
    });
  }

  if (averageIncome > 0 && currentIncome > averageIncome * 1.35) {
    alerts.push({
      id: "income_above_routine",
      title: "Renda acima da rotina",
      message: `As entradas do mes subiram para ${formatCurrency(currentIncome)}. Vale separar uma parte para metas ou reserva.`,
      priority: "info",
      createdAt
    });
  }

  const categoryAverages = buildExpenseCategoryAverages(state.transactions, state.bills, currentMonth);
  const unusualTransaction = currentTransactions
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => ({
      transaction,
      average: categoryAverages[transaction.category] ?? 0
    }))
    .filter((item) => item.average > 0 && item.transaction.amount > item.average * 2)
    .sort((a, b) => b.transaction.amount - a.transaction.amount)[0];

  if (unusualTransaction) {
    alerts.push({
      id: `expense_spike_${unusualTransaction.transaction.id}`,
      title: "Gasto fora do padrao",
      message: `${unusualTransaction.transaction.description} em ${formatCurrency(unusualTransaction.transaction.amount)} ficou bem acima da rotina de ${unusualTransaction.transaction.category}.`,
      priority: "warning",
      createdAt
    });
  }

  alerts.push(...buildRecurrenceEndingAlerts(state, currentMonth, createdAt));
  alerts.push(...buildInstallmentAlerts(state, currentMonth, createdAt));

  const suspiciousDates = [
    ...state.transactions
      .filter((transaction) => !isPlausibleFinanceDate(transaction.date, state.accounts, now))
      .map((transaction) => ({ label: transaction.description, date: transaction.date })),
    ...state.bills
      .filter((bill) => !isPlausibleFinanceDate(bill.dueDate, state.accounts, now))
      .map((bill) => ({ label: bill.title, date: bill.dueDate }))
  ];

  if (suspiciousDates.length > 0) {
    const first = suspiciousDates[0];
    alerts.push({
      id: `suspicious_finance_dates_${suspiciousDates.length}`,
      title: "Datas financeiras para revisar",
      message: `${suspiciousDates.length} registro(s) estao fora da faixa historica esperada. Exemplo: "${first.label}" em ${first.date}. Revise esses dados porque eles podem alterar o saldo acumulado.`,
      priority: "warning",
      createdAt
    });
  }

  const crossDuplicates = findPaidBillTransactionDuplicateMatches(state.transactions, state.bills);
  if (crossDuplicates.length > 0) {
    const first = crossDuplicates[0];
    alerts.push({
      id: `possible_bill_transaction_duplicate_${first.bill.id}_${first.transaction.id}`,
      title: "Possivel pagamento duplicado",
      message: `A conta "${first.bill.title}" e o lancamento "${first.transaction.description}" parecem representar o mesmo pagamento de ${formatCurrency(first.bill.amount)}. Revise antes de considerar o saldo definitivo.`,
      priority: "warning",
      createdAt
    });
  }

  return alerts.sort(sortFinancialHealthAlerts).slice(0, 4);
}

export function buildMayaLocalAnalysis(state: FinanceState, question?: string): MayaAnalysis {
  if (state.transactions.length === 0 && state.bills.length === 0) {
    return {
      assistantName: "MAYA",
      message:
        "Eu sou a MAYA. Ainda nao tenho transacoes financeiras reais suficientes para avaliar a saude financeira de voces. Cadastre pelo menos uma receita ou despesa para que eu consiga fazer uma leitura fiel do cenario.",
      healthScore: 0,
      trend: "stable",
      highlights: [
        "Nenhuma receita real cadastrada.",
        "Nenhuma despesa real cadastrada.",
        state.budgets.length > 0
          ? `${state.budgets.length} orcamento(s) cadastrado(s), mas ainda sem gastos reais para comparar.`
          : "Nenhum orcamento mensal cadastrado.",
        state.goals.length > 0
          ? `${state.goals.length} meta(s) cadastrada(s), mas ainda sem lancamentos para avaliar o fluxo mensal.`
          : "Nenhuma meta financeira cadastrada."
      ],
      nextActions: [
        "Cadastrar as receitas fixas do mes.",
        "Adicionar as principais despesas do mes.",
        "Criar pelo menos um orcamento por categoria.",
        "Voltar para a MAYA depois dos primeiros lancamentos."
      ]
    };
  }

  const months = buildMonthSummaries(state.transactions, 6, state.bills);
  const current = months.at(-1) ?? emptyMonth(getCurrentMonthKey());
  const previous = months.at(-2) ?? emptyMonth(getCurrentMonthKey());
  const budgetSummary = buildBudgetSummary(state, current.month);
  const expenseDelta = current.expenses - previous.expenses;
  const incomeDelta = current.income - previous.income;
  const savingsDelta = current.savingsRate - previous.savingsRate;
  const summary = calculateSummary(state);
  const healthScore = calculateHealthScore(summary, state);
  const trend =
    summary.projectedBalance < 0
      ? "drop"
      : savingsDelta > 5 || current.periodResult > previous.periodResult
        ? "growth"
        : savingsDelta < -5
          ? "drop"
          : "stable";
  const biggestCategory = getBiggestExpenseCategory(state.transactions, state.bills, current.month);
  const currentTransactions = getTransactionsByMonthUntil(state.transactions, current.month);
  const currentBills = getPaidBillsByPaymentMonthUntil(state.bills, current.month);
  const recurringCount =
    currentTransactions.filter((transaction) => transaction.recurring).length +
    currentBills.filter((bill) => bill.recurrence === "monthly").length;
  const installmentCount =
    currentTransactions.filter((transaction) => transaction.installmentGroupId).length +
    currentBills.filter((bill) => bill.installmentGroupId).length;
  const hasCurrentIncome = current.income > 0;

  const highlights = [
    hasCurrentIncome
      ? `No mes ${current.month}, receitas somam ${formatCurrency(current.income)} e despesas somam ${formatCurrency(current.expenses)}.`
      : `No mes ${current.month}, ainda nao ha receitas cadastradas; despesas registradas somam ${formatCurrency(current.expenses)}.`,
    summary.savingsRate === null
      ? "Ainda nao ha dados suficientes para calcular uma taxa de economia confiavel neste mes."
      : `A economia projetada esta em ${formatPercent(summary.savingsRate)}, considerando contas conhecidas do mes.`,
    biggestCategory.amount > 0
      ? `${biggestCategory.category} e a maior categoria de despesa, com ${formatCurrency(biggestCategory.amount)}.`
      : "Ainda nao ha despesas suficientes para apontar uma categoria dominante.",
    `Saldo atual ${formatCurrency(summary.currentBalance)}; depois das contas ainda nao pagas do mes, a projecao fica em ${formatCurrency(summary.projectedBalance)}.`,
    `No mes ${current.month}, existem ${recurringCount} lancamento(s) recorrente(s) e ${installmentCount} parcela(s) no calculo.`,
    budgetSummary.totalLimit > 0
      ? `Os orcamentos do mes somam ${formatCurrency(budgetSummary.totalLimit)} e ja consumiram ${formatPercent(budgetSummary.usedPercent)}.`
      : "Ainda nao ha orcamentos cadastrados para este mes."
  ];

  const nextActions = [
    !hasCurrentIncome
      ? "Cadastrar as receitas do mes antes de tomar decisoes com base no placar de saude."
      : budgetSummary.exceededCount > 0
      ? "Priorizar as categorias com orcamento excedido antes de assumir novas compras."
      : budgetSummary.attentionCount > 0
        ? "Revisar categorias perto do limite para preservar o saldo do mes."
        : "Manter os limites de orcamento como guia para decisoes do mes.",
    expenseDelta > 0
      ? `Revisar o aumento de ${formatCurrency(expenseDelta)} nas despesas frente ao mes anterior.`
      : "Manter o controle atual de despesas e revisar apenas gastos variaveis.",
    incomeDelta < 0
      ? `Acompanhar a queda de ${formatCurrency(Math.abs(incomeDelta))} nas receitas e planejar compensacao.`
      : "Direcionar parte do resultado positivo para metas prioritarias.",
    "Conferir parcelas futuras antes de assumir novas compras de longo prazo."
  ];

  const message = [
    `Eu sou a MAYA. Fiz uma leitura cuidadosa da saude financeira de voces e o placar atual e ${healthScore}/100.`,
    trend === "growth"
      ? "O desempenho mostra evolucao, com leitura combinada de fluxo mensal, saldo acumulado e contas conhecidas."
      : trend === "drop"
        ? "Existe uma queda de desempenho para observar com calma. Nao e motivo para culpa; e um sinal para ajustar rota."
        : "O cenario esta estavel. A leitura considera saldo acumulado, resultado mensal e compromissos ainda nao pagos.",
    question ? `Sobre sua pergunta: "${question}", eu recomendo olhar primeiro para fluxo mensal, recorrencias e metas.` : "Minha recomendacao e acompanhar meses, recorrencias e parcelas como um mapa de decisoes."
  ].join(" ");

  return {
    assistantName: "MAYA",
    message,
    healthScore,
    trend,
    highlights,
    nextActions
  };
}

export function getGoalProgress(goal: Goal) {
  if (goal.targetAmount <= 0) {
    return 0;
  }

  return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
}

export function getTransactionsByMonth(transactions: Transaction[], month: string) {
  return transactions.filter((transaction) => transaction.date.startsWith(month));
}

export function getTransactionsByMonthUntil(transactions: Transaction[], month: string, date = toDateKey(new Date())) {
  return getTransactionsByMonth(transactions, month).filter((transaction) => transaction.date <= date);
}

export function getBillsByMonth(bills: PayableBill[], month: string) {
  return bills.filter((bill) => bill.dueDate.startsWith(month));
}

export function getPaidBillsByPaymentMonthUntil(bills: PayableBill[], month: string, date = toDateKey(new Date())) {
  return bills
    .filter((bill) => bill.status === "paid")
    .filter((bill) => getBillPaymentDate(bill).startsWith(month))
    .filter((bill) => getBillPaymentDate(bill) <= date);
}

export function getBillPaymentDate(bill: PayableBill) {
  return bill.paidAt?.slice(0, 10) || bill.dueDate;
}

export function getBillEffectiveStatus(bill: PayableBill, now = new Date()): BillStatus {
  if (bill.status === "paid") {
    return "paid";
  }

  return bill.dueDate < toDateKey(now) ? "overdue" : "pending";
}

export function buildBillSummary(bills: PayableBill[], month: string, now = new Date()) {
  const monthBills = getBillsByMonth(bills, month);
  const today = toDateKey(now);
  const dueToday = monthBills.filter((bill) => bill.dueDate === today && getBillEffectiveStatus(bill, now) !== "paid");
  const pending = monthBills.filter((bill) => getBillEffectiveStatus(bill, now) === "pending");
  const paid = monthBills.filter((bill) => getBillEffectiveStatus(bill, now) === "paid");
  const overdue = monthBills.filter((bill) => getBillEffectiveStatus(bill, now) === "overdue");
  const upcoming = bills
    .filter((bill) => {
      const status = getBillEffectiveStatus(bill, now);
      const days = diffCalendarDays(today, bill.dueDate);
      return status !== "paid" && days >= 0 && days <= 2;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    monthBills,
    dueToday,
    upcoming,
    pending,
    paid,
    overdue,
    total: monthBills.reduce((total, bill) => total + bill.amount, 0),
    pendingTotal: pending.reduce((total, bill) => total + bill.amount, 0),
    paidTotal: paid.reduce((total, bill) => total + bill.amount, 0),
    overdueTotal: overdue.reduce((total, bill) => total + bill.amount, 0),
    dueTodayTotal: dueToday.reduce((total, bill) => total + bill.amount, 0)
  };
}

export function buildBillAlerts(bills: PayableBill[], now = new Date()): BillAlert[] {
  const today = toDateKey(now);

  return bills
    .filter((bill) => getBillEffectiveStatus(bill, now) !== "paid")
    .flatMap((bill) => {
      const daysUntilDue = diffCalendarDays(today, bill.dueDate);
      const alerts: BillAlert[] = [];

      if (daysUntilDue < 0) {
        alerts.push({
          id: `${bill.id}_overdue`,
          bill,
          type: "overdue",
          title: "Conta atrasada",
          message: `${bill.title} venceu em ${bill.dueDate}.`,
          priority: "critical",
          triggerAt: `${bill.dueDate}T12:00:00`
        });
      } else if (daysUntilDue === 0) {
        alerts.push({
          id: `${bill.id}_today_noon`,
          bill,
          type: "due_today_noon",
          title: "Vence hoje",
          message: `${bill.title} vence hoje. Conferir ate 12:00.`,
          priority: "warning",
          triggerAt: `${bill.dueDate}T12:00:00`
        });
      } else if (daysUntilDue <= 2) {
        alerts.push({
          id: `${bill.id}_due_soon`,
          bill,
          type: "due_soon",
          title: "Vence em ate 48h",
          message: `${bill.title} vence em ${bill.dueDate}.`,
          priority: "info",
          triggerAt: `${bill.dueDate}T12:00:00`
        });
      }

      return alerts;
    })
    .sort((a, b) => {
      const priorityOrder = { critical: 0, warning: 1, info: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.bill.dueDate.localeCompare(b.bill.dueDate);
    });
}

export function buildBudgetUsages(state: FinanceState, month: string): BudgetUsage[] {
  const today = toDateKey(new Date());

  return state.budgets
    .filter((budget) => budget.month === month)
    .map((budget) => {
      const transactionSpent = getTransactionsByMonthUntil(state.transactions, month, today)
        .filter((transaction) => transaction.type === "expense" && transaction.category === budget.category)
        .reduce((total, transaction) => total + transaction.amount, 0);
      const billSpent = getPaidBillsByPaymentMonthUntil(state.bills, month, today)
        .filter((bill) => bill.category === budget.category)
        .reduce((total, bill) => total + bill.amount, 0);
      const spent = transactionSpent + billSpent;
      const remaining = budget.limitAmount - spent;
      const usedPercent = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0;

      const status: BudgetUsage["status"] =
        usedPercent >= 100 ? "exceeded" : usedPercent >= 80 ? "attention" : "safe";

      return {
        budget,
        spent,
        remaining,
        usedPercent,
        status
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);
}

export function buildBudgetSummary(state: FinanceState, month: string) {
  const usages = buildBudgetUsages(state, month);
  const totalLimit = usages.reduce((total, usage) => total + usage.budget.limitAmount, 0);
  const totalSpent = usages.reduce((total, usage) => total + usage.spent, 0);
  const usedPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return {
    usages,
    totalLimit,
    totalSpent,
    remaining: totalLimit - totalSpent,
    usedPercent,
    exceededCount: usages.filter((usage) => usage.status === "exceeded").length,
    attentionCount: usages.filter((usage) => usage.status === "attention").length
  };
}

export function addMonths(dateValue: string, monthsToAdd: number) {
  return addMonthsSafe(dateValue, monthsToAdd);
}

function diffCalendarDays(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T12:00:00`);
  const to = Date.parse(`${toDate}T12:00:00`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((to - from) / 86_400_000);
}

function getBiggestExpenseCategory(transactions: Transaction[], bills: PayableBill[], month: string) {
  const totals = buildExpenseCategoryTotals(
    getTransactionsByMonthUntil(transactions, month),
    getPaidBillsByPaymentMonthUntil(bills, month)
  );

  const [category, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? ["Sem despesas", 0];
  return { category, amount };
}

function calculateHealthScore(current: FinanceSummary, state: FinanceState) {
  const goalProgress =
    state.goals.length > 0
      ? state.goals.reduce((total, goal) => total + getGoalProgress(goal), 0) / state.goals.length
      : 0;
  const savingsComponent =
    current.savingsRate === null ? 0 : Math.max(0, Math.min(35, current.savingsRate * 1.05));
  const liquidityComponent =
    current.currentBalance < 0 ? 0 : current.projectedBalance < 0 ? 8 : current.unpaidBills > 0 ? 20 : 25;
  const goalComponent = Math.min(20, goalProgress / 5);
  const budgetSummary = buildBudgetSummary(state, current.currentMonth);
  const budgetComponent =
    budgetSummary.totalLimit === 0
      ? 3
      : budgetSummary.exceededCount > 0
        ? 1
        : budgetSummary.attentionCount > 0
          ? 5
          : 8;
  const hasMonthlyRecurring =
    getTransactionsByMonthUntil(state.transactions, current.currentMonth).some((transaction) => transaction.recurring) ||
    state.bills.some((bill) => bill.dueDate.startsWith(current.currentMonth) && bill.recurrence === "monthly");
  const predictabilityComponent = hasMonthlyRecurring ? 7 : 3;
  const dataConfidenceComponent = current.income > 0 && current.savingsRate !== null ? 5 : 0;

  return Math.min(
    100,
    Math.round(
      savingsComponent +
        liquidityComponent +
        goalComponent +
        predictabilityComponent +
        budgetComponent +
        dataConfidenceComponent
    )
  );
}

function buildExpenseCategoryAverages(transactions: Transaction[], bills: PayableBill[], currentMonth: string) {
  const previousMonths = buildMonthSummaries(transactions, 4, bills)
    .map((month) => month.month)
    .filter((month) => month !== currentMonth);
  const totals: Record<string, number[]> = {};

  previousMonths.forEach((month) => {
    const monthTotals = buildExpenseCategoryTotals(
      getTransactionsByMonthUntil(transactions, month),
      getPaidBillsByPaymentMonthUntil(bills, month)
    );

    Object.entries(monthTotals).forEach(([category, amount]) => {
      totals[category] = [...(totals[category] ?? []), amount];
    });
  });

  return Object.fromEntries(Object.entries(totals).map(([category, values]) => [category, average(values)]));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function emptyMonth(month: string): MonthSummary {
  return {
    month,
    income: 0,
    expenses: 0,
    investments: 0,
    periodResult: 0,
    availableBalance: 0,
    savingsRate: 0
  };
}

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function calculateMonthExpenseTotal(transactions: Transaction[], bills: PayableBill[]) {
  return sumByType(transactions, "expense") + sumBills(bills);
}

function sumBills(bills: PayableBill[]) {
  return bills.reduce((total, bill) => total + bill.amount, 0);
}

function buildExpenseCategoryTotals(transactions: Transaction[], bills: PayableBill[]) {
  const totals = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

  bills.forEach((bill) => {
    totals[bill.category] = (totals[bill.category] ?? 0) + bill.amount;
  });

  return totals;
}

function buildInstallmentAlerts(state: FinanceState, currentMonth: string, createdAt: string): FinancialHealthAlert[] {
  const candidates = [
    ...state.transactions
      .filter(
        (transaction) =>
          transaction.date.startsWith(currentMonth) &&
          transaction.installmentGroupId &&
          transaction.installmentNumber &&
          transaction.installmentTotal
      )
      .map((transaction) => ({
        id: transaction.id,
        groupId: transaction.installmentGroupId!,
        label: transaction.description,
        number: transaction.installmentNumber!,
        total: transaction.installmentTotal!,
        date: transaction.date
      })),
    ...state.bills
      .filter(
        (bill) =>
          bill.dueDate.startsWith(currentMonth) &&
          bill.installmentGroupId &&
          bill.installmentNumber &&
          bill.installmentTotal
      )
      .map((bill) => ({
        id: bill.id,
        groupId: bill.installmentGroupId!,
        label: bill.title,
        number: bill.installmentNumber!,
        total: bill.installmentTotal!,
        date: bill.dueDate
      }))
  ];

  const seen = new Set<string>();
  return candidates.flatMap((item) => {
    if (seen.has(item.groupId) || item.number < item.total - 1) return [];
    seen.add(item.groupId);

    const remaining = Math.max(0, item.total - item.number);
    return [
      {
        id: `installment_progress_${sanitizeAlertId(item.groupId)}_${item.number}_${item.total}`,
        title: remaining === 0 ? "Parcelamento concluido" : "Parcelamento perto de acabar",
        message:
          remaining === 0
            ? `"${item.label}" esta na parcela ${item.number}/${item.total}, a ultima prevista.`
            : `"${item.label}" esta na parcela ${item.number}/${item.total}; resta ${remaining} parcela.`,
        priority: remaining === 0 ? "info" : "warning",
        createdAt
      } satisfies FinancialHealthAlert
    ];
  });
}

function buildRecurrenceEndingAlerts(state: FinanceState, currentMonth: string, createdAt: string): FinancialHealthAlert[] {
  const series = new Map<string, { label: string; kind: "transaction" | "bill"; months: Set<string> }>();

  state.transactions
    .filter((transaction) => transaction.recurring && isValidCalendarDateKey(transaction.date))
    .forEach((transaction) => {
      const key = transaction.recurrenceGroupId || buildRecurrenceFallbackKey([
        "transaction",
        transaction.description,
        String(transaction.amount),
        transaction.category,
        transaction.person
      ]);
      addRecurrenceMonth(series, key, transaction.description, "transaction", transaction.date.slice(0, 7));
    });

  state.bills
    .filter((bill) => bill.recurrence === "monthly" && isValidCalendarDateKey(bill.dueDate))
    .forEach((bill) => {
      const key = bill.recurrenceGroupId || buildRecurrenceFallbackKey(["bill", bill.title, String(bill.amount), bill.category, bill.person]);
      addRecurrenceMonth(series, key, bill.title, "bill", bill.dueDate.slice(0, 7));
    });

  return Array.from(series.entries()).flatMap(([key, item]) => {
    if (item.months.size < 2) {
      return [];
    }

    const sortedMonths = Array.from(item.months).sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    if (!lastMonth) {
      return [];
    }

    const monthsUntilEnd = diffMonthKeys(currentMonth, lastMonth);
    if (monthsUntilEnd < 0 || monthsUntilEnd > 2) {
      return [];
    }

    const label = item.kind === "bill" ? "conta recorrente" : "lancamento recorrente";

    return [
      {
        id: `recurrence_ending_${sanitizeAlertId(key)}_${lastMonth}`,
        title: "Recorrencia perto de acabar",
        message:
          monthsUntilEnd === 0
            ? `A ${label} "${item.label}" termina neste mes. Confira se precisa renovar para os proximos meses.`
            : `A ${label} "${item.label}" termina em ${lastMonth}. Confira antes para nao sumir do planejamento.`,
        priority: monthsUntilEnd === 0 ? "critical" : "warning",
        createdAt
      } satisfies FinancialHealthAlert
    ];
  });
}

function addRecurrenceMonth(
  series: Map<string, { label: string; kind: "transaction" | "bill"; months: Set<string> }>,
  key: string,
  label: string,
  kind: "transaction" | "bill",
  month: string
) {
  const existing = series.get(key);
  if (existing) {
    existing.months.add(month);
    return;
  }

  series.set(key, { label, kind, months: new Set([month]) });
}

function buildRecurrenceFallbackKey(parts: string[]) {
  return parts.map((part) => part.trim().toLowerCase()).join("|");
}

function diffMonthKeys(left: string, right: string) {
  const [leftYear, leftMonth] = left.split("-").map(Number);
  const [rightYear, rightMonth] = right.split("-").map(Number);
  return (rightYear - leftYear) * 12 + (rightMonth - leftMonth);
}

function sanitizeAlertId(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80);
}

function sortFinancialHealthAlerts(left: FinancialHealthAlert, right: FinancialHealthAlert) {
  const priorityRank: Record<FinancialHealthAlert["priority"], number> = {
    critical: 0,
    warning: 1,
    info: 2
  };

  return priorityRank[left.priority] - priorityRank[right.priority];
}
