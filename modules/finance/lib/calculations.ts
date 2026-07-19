import { formatCurrency, formatPercent } from "@/lib/utils";
import type {
  BillAlert,
  BillStatus,
  BudgetUsage,
  DataQualityReport,
  FinanceState,
  FinanceSummary,
  Goal,
  MayaAnalysis,
  MonthSummary,
  PayableBill,
  Transaction
} from "../types";

export function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function calculateSummary(state: FinanceState): FinanceSummary {
  const currentMonth = getCurrentMonthKey();
  const monthTransactions = getTransactionsByMonth(state.transactions, currentMonth);

  const income = sumByType(monthTransactions, "income");
  const expenses = sumByType(monthTransactions, "expense");
  const investments = sumByType(monthTransactions, "investment");
  const availableBalance = income - expenses - investments;
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  const categoryTotals = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amount;
      return totals;
    }, {});

  const biggestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const goalsTotal = state.goals.reduce((total, goal) => total + goal.targetAmount, 0);
  const goalsProgress = state.goals.reduce((total, goal) => total + goal.currentAmount, 0);

  return {
    currentMonth,
    income,
    expenses,
    investments,
    availableBalance,
    savingsRate,
    goalsTotal,
    goalsProgress,
    biggestExpenseCategory: biggestCategory?.[0] ?? "Sem despesas",
    biggestExpenseAmount: biggestCategory?.[1] ?? 0
  };
}

export function buildMonthlyFlow(transactions: Transaction[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return date.toISOString().slice(0, 7);
  });

  return months.map((month) => {
    const monthTransactions = getTransactionsByMonth(transactions, month);
    return {
      month,
      income: sumByType(monthTransactions, "income"),
      expenses: sumByType(monthTransactions, "expense"),
      investments: sumByType(monthTransactions, "investment")
    };
  });
}

export function buildMonthSummaries(transactions: Transaction[], monthCount = 6): MonthSummary[] {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (monthCount - 1 - index));
    return date.toISOString().slice(0, 7);
  });

  return months.map((month) => {
    const monthTransactions = getTransactionsByMonth(transactions, month);
    const income = sumByType(monthTransactions, "income");
    const expenses = sumByType(monthTransactions, "expense");
    const investments = sumByType(monthTransactions, "investment");
    const availableBalance = income - expenses - investments;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
      month,
      income,
      expenses,
      investments,
      availableBalance,
      savingsRate
    };
  });
}

export function buildInsights(state: FinanceState) {
  const summary = calculateSummary(state);
  const budgetSummary = buildBudgetSummary(state, summary.currentMonth);
  const insights: Array<{ title: string; body: string; tone: "success" | "warning" | "info" }> = [];

  if (state.transactions.length === 0) {
    return [
      {
        title: "Sem dados financeiros reais",
        body: "Cadastre receitas, despesas ou uma nota para que a MAYA comece a analisar o cenario do casal com base em informacoes reais.",
        tone: "info" as const
      }
    ];
  }

  if (summary.income === 0) {
    insights.push({
      title: "Receitas ainda nao cadastradas",
      body: "Existem dados insuficientes para calcular taxa de economia. Cadastre as receitas do mes para liberar uma leitura mais precisa.",
      tone: "info"
    });
  } else if (summary.savingsRate >= 30) {
    insights.push({
      title: "Ritmo excelente",
      body: `A taxa de economia esta em ${Math.round(summary.savingsRate)}%. Esse ritmo fortalece metas e reserva.`,
      tone: "success"
    });
  } else if (summary.savingsRate >= 10) {
    insights.push({
      title: "Bom caminho",
      body: `A taxa de economia esta em ${Math.round(summary.savingsRate)}%. Um pequeno ajuste em gastos variaveis pode acelerar as metas.`,
      tone: "info"
    });
  } else {
    insights.push({
      title: "Atencao gentil",
      body: "As despesas estao ocupando quase toda a renda do mes. Vale revisar recorrencias e compras recentes.",
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
      body: `${urgentGoal.goal.name} esta com ${Math.round(urgentGoal.progress)}% de progresso. Um aporte pequeno e recorrente ja muda a curva.`,
      tone: "warning"
    });
  }

  return insights.slice(0, 4);
}

export function buildDataQualityReport(state: FinanceState): DataQualityReport {
  const currentMonth = getCurrentMonthKey();
  const currentTransactions = getTransactionsByMonth(state.transactions, currentMonth);
  const hasAnyTransaction = state.transactions.length > 0;
  const hasCurrentIncome = currentTransactions.some((transaction) => transaction.type === "income");
  const hasCurrentExpense = currentTransactions.some((transaction) => transaction.type === "expense");
  const hasBudget = state.budgets.some((budget) => budget.month === currentMonth);
  const hasBill = state.bills.length > 0;
  const hasGoal = state.goals.length > 0;
  const hasPlannedExpense = state.transactions.some(
    (transaction) => transaction.recurring || Boolean(transaction.installmentGroupId)
  );
  const distinctMonths = new Set(state.transactions.map((transaction) => transaction.date.slice(0, 7))).size;
  const hasHistory = distinctMonths >= 2;

  const checks = [
    {
      passed: hasAnyTransaction,
      completed: "Existem lancamentos financeiros cadastrados.",
      missing: "Cadastrar pelo menos uma receita ou despesa real."
    },
    {
      passed: hasCurrentIncome,
      completed: "Receitas do mes atual cadastradas.",
      missing: "Cadastrar as receitas do mes atual."
    },
    {
      passed: hasCurrentExpense,
      completed: "Despesas do mes atual cadastradas.",
      missing: "Cadastrar despesas reais do mes atual."
    },
    {
      passed: hasBudget,
      completed: "Orcamento do mes atual cadastrado.",
      missing: "Criar pelo menos um orcamento para o mes atual."
    },
    {
      passed: hasBill,
      completed: "Contas a pagar cadastradas.",
      missing: "Cadastrar contas a pagar para ativar alertas de vencimento."
    },
    {
      passed: hasGoal,
      completed: "Metas financeiras cadastradas.",
      missing: "Cadastrar pelo menos uma meta financeira do casal."
    },
    {
      passed: hasPlannedExpense,
      completed: "Recorrencias ou parcelas mapeadas.",
      missing: "Mapear despesas recorrentes ou parceladas importantes."
    },
    {
      passed: hasHistory,
      completed: "Historico com mais de um mes disponivel.",
      missing: "Registrar dados por pelo menos dois meses para comparacao real."
    }
  ];

  const completed = checks.filter((check) => check.passed).map((check) => check.completed);
  const missing = checks.filter((check) => !check.passed).map((check) => check.missing);
  const score = Math.round((completed.length / checks.length) * 100);
  const level: DataQualityReport["level"] =
    score >= 75 ? "consistent" : score >= 35 ? "partial" : "insufficient";

  return {
    score,
    level,
    label:
      level === "consistent"
        ? "Dados consistentes"
        : level === "partial"
          ? "Dados parciais"
          : "Dados insuficientes",
    summary:
      level === "consistent"
        ? "A MAYA ja possui uma base razoavel para comparar meses, orcamentos, metas e fluxo atual."
        : level === "partial"
          ? "A MAYA consegue orientar alguns pontos, mas ainda precisa de mais dados reais para conclusoes melhores."
          : "A MAYA ainda nao tem base suficiente para diagnosticar a vida financeira sem risco de conclusoes fracas.",
    completed,
    missing
  };
}

export function buildMayaLocalAnalysis(state: FinanceState, question?: string): MayaAnalysis {
  if (state.transactions.length === 0) {
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

  const months = buildMonthSummaries(state.transactions, 6);
  const current = months.at(-1) ?? emptyMonth(getCurrentMonthKey());
  const previous = months.at(-2) ?? emptyMonth(getCurrentMonthKey());
  const budgetSummary = buildBudgetSummary(state, current.month);
  const expenseDelta = current.expenses - previous.expenses;
  const incomeDelta = current.income - previous.income;
  const savingsDelta = current.savingsRate - previous.savingsRate;
  const healthScore = calculateHealthScore(current, state);
  const trend = savingsDelta > 5 || current.availableBalance > previous.availableBalance ? "growth" : savingsDelta < -5 ? "drop" : "stable";
  const biggestCategory = getBiggestExpenseCategory(state.transactions, current.month);
  const recurringCount = state.transactions.filter((transaction) => transaction.recurring).length;
  const installmentCount = state.transactions.filter((transaction) => transaction.installmentGroupId).length;
  const hasCurrentIncome = current.income > 0;

  const highlights = [
    hasCurrentIncome
      ? `No mes ${current.month}, receitas somam ${formatCurrency(current.income)} e despesas somam ${formatCurrency(current.expenses)}.`
      : `No mes ${current.month}, ainda nao ha receitas cadastradas; despesas registradas somam ${formatCurrency(current.expenses)}.`,
    `A taxa de economia esta em ${formatPercent(current.savingsRate)}, variando ${formatPercent(savingsDelta)} em relacao ao mes anterior.`,
    biggestCategory.amount > 0
      ? `${biggestCategory.category} e a maior categoria de despesa, com ${formatCurrency(biggestCategory.amount)}.`
      : "Ainda nao ha despesas suficientes para apontar uma categoria dominante.",
    `Existem ${recurringCount} lancamentos recorrentes e ${installmentCount} parcelas registradas no planejamento.`,
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
      ? "O desempenho mostra evolucao. A combinacao de saldo e economia esta ajudando voces a construir tranquilidade."
      : trend === "drop"
        ? "Existe uma queda de desempenho para observar com calma. Nao e motivo para culpa; e um sinal para ajustar rota."
        : "O cenario esta estavel. Isso e bom para previsibilidade, mas ainda podemos buscar pequenos ganhos.",
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

export function getBillsByMonth(bills: PayableBill[], month: string) {
  return bills.filter((bill) => bill.dueDate.startsWith(month));
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
  return state.budgets
    .filter((budget) => budget.month === month)
    .map((budget) => {
      const spent = getTransactionsByMonth(state.transactions, month)
        .filter((transaction) => transaction.type === "expense" && transaction.category === budget.category)
        .reduce((total, transaction) => total + transaction.amount, 0);
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
  const date = new Date(`${dateValue}T12:00:00`);
  date.setMonth(date.getMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function diffCalendarDays(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T12:00:00`);
  const to = Date.parse(`${toDate}T12:00:00`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((to - from) / 86_400_000);
}

function getBiggestExpenseCategory(transactions: Transaction[], month: string) {
  const totals = getTransactionsByMonth(transactions, month)
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

  const [category, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] ?? ["Sem despesas", 0];
  return { category, amount };
}

function calculateHealthScore(current: MonthSummary, state: FinanceState) {
  const goalProgress =
    state.goals.length > 0
      ? state.goals.reduce((total, goal) => total + getGoalProgress(goal), 0) / state.goals.length
      : 0;
  const savingsComponent = Math.max(0, Math.min(40, current.savingsRate * 1.2));
  const balanceComponent = current.availableBalance >= 0 ? 25 : 5;
  const goalComponent = Math.min(25, goalProgress / 4);
  const budgetSummary = buildBudgetSummary(state, current.month);
  const budgetComponent =
    budgetSummary.totalLimit === 0
      ? 4
      : budgetSummary.exceededCount > 0
        ? 2
        : budgetSummary.attentionCount > 0
          ? 7
          : 10;
  const predictabilityComponent = state.transactions.some((transaction) => transaction.recurring) ? 8 : 3;

  return Math.min(
    100,
    Math.round(savingsComponent + balanceComponent + goalComponent + predictabilityComponent + budgetComponent)
  );
}

function emptyMonth(month: string): MonthSummary {
  return {
    month,
    income: 0,
    expenses: 0,
    investments: 0,
    availableBalance: 0,
    savingsRate: 0
  };
}

function sumByType(transactions: Transaction[], type: Transaction["type"]) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}
