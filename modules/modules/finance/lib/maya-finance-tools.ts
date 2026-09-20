import { formatCurrency, formatPercent, monthKeyAdd } from "@/lib/utils";
import { expenseCategories, incomeCategories } from "../data/defaults";
import type { FinanceState, MayaAnalysis, PayableBill } from "../types";
import {
  buildBillSummary,
  buildMayaLocalAnalysis,
  calculateSummary,
  getBillEffectiveStatus,
  getCurrentMonthKey
} from "./calculations";

type ParsedFinancePrompt = {
  values: number[];
  percents: number[];
  months?: number;
};

export function buildMayaFinanceToolAnswer(state: FinanceState, question?: string): MayaAnalysis | null {
  const text = normalizePrompt(question);
  const baseAnalysis = buildMayaLocalAnalysis(state, question);

  if (!text) {
    return null;
  }

  if (isPeriodMemoryPrompt(text)) {
    return buildPeriodMemoryAnswer(state, baseAnalysis, question ?? "", text);
  }

  if (isGoalSavingsPlanPrompt(text)) {
    return buildGoalSavingsPlanAnswer(state, baseAnalysis, question ?? "");
  }

  if (isInterestCalculationPrompt(text)) {
    return buildInterestCalculationAnswer(state, baseAnalysis, question ?? "", parseFinancePrompt(question ?? ""));
  }

  if (isLoanProposalPrompt(text)) {
    return buildLoanProposalAnswer(state, baseAnalysis, question ?? "", parseFinancePrompt(question ?? ""));
  }

  if (isOverdueNegotiationPrompt(text)) {
    return buildOverdueNegotiationAnswer(state, baseAnalysis, question ?? "", parseFinancePrompt(question ?? ""));
  }

  return null;
}

function buildPeriodMemoryAnswer(
  state: FinanceState,
  baseAnalysis: MayaAnalysis,
  question: string,
  normalizedQuestion: string
): MayaAnalysis {
  const type = inferMemoryTransactionType(normalizedQuestion);
  const months = inferMemoryMonths(normalizedQuestion);
  const term = inferSearchTerm(question, type);
  const startMonth = getStartMonth(months);
  const transactions = state.transactions
    .filter((transaction) => transaction.type === type)
    .filter((transaction) => transaction.date.slice(0, 7) >= startMonth)
    .filter((transaction) => {
      if (!term) {
        return true;
      }

      const haystack = normalizePrompt(
        [
          transaction.description,
          transaction.category,
          transaction.paymentRecipient,
          transaction.otherCategoryDescription,
          transaction.notes
        ]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(term);
    });
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthly = groupMemoryByMonth(transactions);
  const label = type === "income" ? "renda" : "despesa";
  const topic = term ? ` com ${term}` : "";

  if (transactions.length === 0) {
    return buildToolAnalysis({
      message: `Procurei ${label}${topic} desde ${startMonth}, mas nao encontrei lancamentos correspondentes. Se o nome estiver diferente, tente perguntar por categoria ou destinatario do Pix.`,
      highlights: [
        `Periodo analisado: ultimos ${months} meses.`,
        "A busca usa descricao, categoria, destinatario Pix e observacoes.",
        "Nao encontrei valores reais para somar."
      ],
      nextActions: [
        "Conferir se os lancamentos foram cadastrados no periodo.",
        "Tentar uma pergunta com outro termo, como mercado, aluguel, salario ou nome do Pix.",
        "Importar extrato bancario para melhorar a memoria financeira da MAYA."
      ],
      baseAnalysis
    });
  }

  return buildToolAnalysis({
    message: `Nos ultimos ${months} meses, encontrei ${transactions.length} lancamento(s) de ${label}${topic}, somando ${formatCurrency(total)}. ${formatMonthlyMemory(monthly)}`,
    highlights: [
      `Total encontrado: ${formatCurrency(total)}.`,
      `Quantidade de lancamentos: ${transactions.length}.`,
      `Maior lancamento: ${formatCurrency(Math.max(...transactions.map((transaction) => transaction.amount)))}.`,
      `Media por lancamento: ${formatCurrency(total / transactions.length)}.`
    ],
    nextActions: [
      type === "expense"
        ? "Comparar esse total com a media dos proximos meses para identificar alta fora da rotina."
        : "Separar parte dessa renda para meta ou reserva antes de ampliar gastos.",
      "Abrir a aba Meses para ver a curva de renda x despesa.",
      "Usar filtros por periodo quando quiser conferir recorrencias e destinatarios."
    ],
    baseAnalysis
  });
}

function buildGoalSavingsPlanAnswer(state: FinanceState, baseAnalysis: MayaAnalysis, question: string): MayaAnalysis {
  const normalized = normalizePrompt(question);
  const goal =
    state.goals.find((item) => normalized.includes(normalizePrompt(item.name))) ??
    state.goals.sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];

  if (!goal) {
    return buildToolAnalysis({
      message: "Consigo montar um plano automatico para meta. Primeiro cadastre uma meta com valor alvo, saldo atual e prazo.",
      highlights: [
        "O plano usa valor faltante e quantidade de meses ate o prazo.",
        "Tambem comparo com a renda e despesas cadastradas.",
        "Sem meta cadastrada, eu nao invento valor nem prazo."
      ],
      nextActions: [
        "Abrir Metas e cadastrar nome, valor alvo, saldo guardado e data final.",
        "Voltar ao chat e pedir: montar plano para a meta.",
        "Atualizar renda e despesas para medir se o aporte cabe no mes."
      ],
      baseAnalysis
    });
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const monthsLeft = Math.max(1, diffMonths(new Date(), new Date(`${goal.dueDate}T00:00:00`)));
  const monthlyAmount = remaining / monthsLeft;
  const summary = calculateSummary(state);
  const available = Math.max(0, summary.income - summary.expenses - summary.investments);
  const pressure = summary.income > 0 ? (monthlyAmount / summary.income) * 100 : 0;

  return buildToolAnalysis({
    message: `Para a meta ${goal.name}, faltam ${formatCurrency(remaining)}. Com prazo ate ${goal.dueDate}, o aporte sugerido fica em ${formatCurrency(monthlyAmount)} por mes durante ${monthsLeft} mes(es). ${summary.income > 0 ? `Isso representa ${formatPercent(pressure)} da renda cadastrada.` : "Cadastre a renda para eu medir o peso real desse aporte."}`,
    highlights: [
      `Valor alvo: ${formatCurrency(goal.targetAmount)}.`,
      `Ja guardado: ${formatCurrency(goal.currentAmount)}.`,
      `Falta: ${formatCurrency(remaining)}.`,
      available > 0 ? `Sobra estimada no mes: ${formatCurrency(available)}.` : "Nao ha sobra mensal estimada com os dados atuais."
    ],
    nextActions: [
      monthlyAmount > available && available > 0
        ? "Reduzir o aporte, alongar o prazo ou cortar uma despesa recorrente antes de assumir o plano."
        : "Agendar o aporte logo apos a entrada principal de renda.",
      "Registrar cada novo saldo na propria meta com data.",
      "Revisar o plano quando houver renda ou gasto fora da rotina."
    ],
    baseAnalysis
  });
}

function buildInterestCalculationAnswer(
  state: FinanceState,
  baseAnalysis: MayaAnalysis,
  question: string,
  parsed: ParsedFinancePrompt
): MayaAnalysis {
  const principal = parsed.values[0] ?? 0;
  const monthlyRate = (parsed.percents[0] ?? 0) / 100;
  const months = parsed.months ?? inferMonths(parsed.values);

  if (principal <= 0 || monthlyRate <= 0 || months <= 0) {
    return buildToolAnalysis({
      message:
        "Eu calculo para voces. Me envie valor, taxa e prazo. Exemplo: calcular juros de R$ 5.000 a 3% ao mes por 12 meses.",
      highlights: [
        "Para juros simples eu uso: valor x taxa x meses.",
        "Para juros compostos eu uso: valor x (1 + taxa) elevado ao prazo.",
        "Para proposta com parcelas fixas eu calculo parcela estimada e custo total."
      ],
      nextActions: [
        "Informar valor principal.",
        "Informar taxa ao mes ou ao ano.",
        "Informar prazo em meses.",
        "Se for emprestimo, informar valor da parcela e CET quando existir."
      ],
      baseAnalysis
    });
  }

  const simpleInterest = principal * monthlyRate * months;
  const simpleTotal = principal + simpleInterest;
  const compoundTotal = principal * Math.pow(1 + monthlyRate, months);
  const compoundInterest = compoundTotal - principal;
  const fixedPayment = calculateFixedPayment(principal, monthlyRate, months);
  const fixedTotal = fixedPayment * months;
  const currentIncome = calculateSummary(state).income;
  const paymentIncomeRatio = currentIncome > 0 ? (fixedPayment / currentIncome) * 100 : 0;

  return buildToolAnalysis({
    message: [
      `Calculei com base no que voce pediu: ${formatCurrency(principal)}, taxa de ${formatPercent(monthlyRate * 100)} ao mes e prazo de ${months} meses.`,
      `Em juros simples, o total estimado fica em ${formatCurrency(simpleTotal)}.`,
      `Em juros compostos, o total estimado fica em ${formatCurrency(compoundTotal)}.`,
      `Se a operacao fosse parcelada pelo sistema de parcela fixa, a parcela aproximada seria ${formatCurrency(fixedPayment)} e o total pago ${formatCurrency(fixedTotal)}.`,
      currentIncome > 0
        ? `Essa parcela consumiria cerca de ${formatPercent(paymentIncomeRatio)} da renda cadastrada no mes.`
        : "Ainda nao ha renda do mes cadastrada para medir o peso da parcela no orcamento."
    ].join(" "),
    highlights: [
      `Juros simples estimados: ${formatCurrency(simpleInterest)}.`,
      `Juros compostos estimados: ${formatCurrency(compoundInterest)}.`,
      `Parcela fixa estimada: ${formatCurrency(fixedPayment)} por ${months} meses.`,
      "Para emprestimo real, compare sempre pelo CET, nao apenas pela parcela."
    ],
    nextActions: [
      "Pedir ao credor o CET, custo total, taxa mensal, IOF, tarifas e prazo.",
      "Comparar a taxa com medias publicas do Banco Central.",
      "Testar portabilidade de credito se ja houver contrato ativo.",
      "Nao comprometer despesas essenciais para caber uma parcela nova."
    ],
    baseAnalysis
  });
}

function buildLoanProposalAnswer(
  state: FinanceState,
  baseAnalysis: MayaAnalysis,
  question: string,
  parsed: ParsedFinancePrompt
): MayaAnalysis {
  const principal = parsed.values[0] ?? 0;
  const months = parsed.months ?? inferMonths(parsed.values);
  const installment = inferInstallment(question, parsed);
  const currentSummary = calculateSummary(state);
  const monthlyRate = principal > 0 && installment > 0 && months > 0 ? inferMonthlyRate(principal, installment, months) : 0;
  const totalPaid = installment > 0 && months > 0 ? installment * months : 0;
  const totalInterest = totalPaid > principal ? totalPaid - principal : 0;
  const incomeRatio = currentSummary.income > 0 && installment > 0 ? (installment / currentSummary.income) * 100 : 0;
  const risk =
    incomeRatio >= 30 || monthlyRate >= 0.05
      ? "Alta atencao"
      : incomeRatio >= 20 || monthlyRate >= 0.03
        ? "Revisar com calma"
        : "Possivelmente administravel";

  if (principal <= 0 || months <= 0 || installment <= 0) {
    return buildToolAnalysis({
      message:
        "Consigo avaliar a proposta. Me envie valor liberado, quantidade de parcelas e valor da parcela. Exemplo: proposta de emprestimo de R$ 8.000 em 24 parcelas de R$ 560.",
      highlights: [
        "Eu comparo parcela, total pago, juros aproximados e peso na renda cadastrada.",
        "A decisao deve usar CET, custo total e impacto no orcamento.",
        "Sem CET informado, a taxa calculada e apenas uma estimativa."
      ],
      nextActions: [
        "Pedir ao banco o CET anual e mensal.",
        "Pedir valor total a pagar e tarifas.",
        "Comparar com outra proposta antes de aceitar.",
        "Avaliar se existe renegociacao ou portabilidade mais barata."
      ],
      baseAnalysis
    });
  }

  return buildToolAnalysis({
    message: [
      `Avaliei a proposta: ${formatCurrency(principal)} recebidos, ${months} parcelas de ${formatCurrency(installment)}.`,
      `O total pago seria ${formatCurrency(totalPaid)}, com custo acima do principal de ${formatCurrency(totalInterest)}.`,
      monthlyRate > 0
        ? `A taxa mensal embutida estimada fica perto de ${formatPercent(monthlyRate * 100)} ao mes.`
        : "Nao consegui estimar a taxa mensal embutida com seguranca.",
      currentSummary.income > 0
        ? `A parcela representa cerca de ${formatPercent(incomeRatio)} da renda mensal cadastrada.`
        : "Cadastre a renda do mes para eu medir o peso real dessa parcela.",
      `Minha classificacao: ${risk}.`
    ].join(" "),
    highlights: [
      `Valor recebido: ${formatCurrency(principal)}.`,
      `Total pago: ${formatCurrency(totalPaid)}.`,
      `Custo estimado: ${formatCurrency(totalInterest)}.`,
      `Peso na renda: ${currentSummary.income > 0 ? formatPercent(incomeRatio) : "renda nao cadastrada"}.`
    ],
    nextActions: [
      "Pedir CET antes de assinar; no Brasil ele resume juros, tarifas, imposto e demais custos.",
      "Comparar a taxa com as medias do Banco Central para a mesma modalidade.",
      "Solicitar simulacao em prazo menor e maior para comparar custo total.",
      "Evitar contratar se a parcela empurrar contas essenciais para atraso."
    ],
    baseAnalysis
  });
}

function buildOverdueNegotiationAnswer(
  state: FinanceState,
  baseAnalysis: MayaAnalysis,
  question: string,
  parsed: ParsedFinancePrompt
): MayaAnalysis {
  const month = getCurrentMonthKey();
  const overdueBills = state.bills.filter((bill) => getBillEffectiveStatus(bill) === "overdue");
  const billSummary = buildBillSummary(state.bills, month);
  const manualDebt = parsed.values[0] ?? 0;
  const monthlyCapacity = estimatePaymentCapacity(state);
  const totalOverdue = overdueBills.reduce((total, bill) => total + bill.amount, 0) || manualDebt;
  const creditorList = overdueBills.slice(0, 5).map(formatOverdueBill);

  return buildToolAnalysis({
    message: [
      totalOverdue > 0
        ? `Mapeei ${formatCurrency(totalOverdue)} em valor atrasado ou informado para negociacao.`
        : "Nao encontrei contas atrasadas cadastradas. Se quiser, me envie valor, credor, dias de atraso, juros e proposta.",
      monthlyCapacity > 0
        ? `Pela renda e despesas cadastradas, eu buscaria acordo com parcela ate perto de ${formatCurrency(monthlyCapacity)} para nao desmontar o mes.`
        : "Ainda preciso de renda e despesas atualizadas para sugerir uma parcela segura.",
      "Na negociacao, a melhor postura e pedir demonstrativo da divida, juros aplicados, desconto para pagamento a vista e proposta por escrito antes de aceitar.",
      "Minha orientacao e financeira e educativa; em cobranca abusiva, superendividamento ou ameaca, procure canais oficiais de defesa do consumidor."
    ].join(" "),
    highlights: [
      billSummary.overdue.length > 0
        ? `${billSummary.overdue.length} conta(s) atrasada(s) cadastrada(s).`
        : "Nenhuma conta atrasada cadastrada no app.",
      totalOverdue > 0 ? `Base para negociacao: ${formatCurrency(totalOverdue)}.` : "Valor da divida ainda nao informado.",
      monthlyCapacity > 0 ? `Parcela prudente estimada: ${formatCurrency(monthlyCapacity)}.` : "Capacidade mensal ainda indefinida.",
      creditorList.length > 0 ? `Prioridades: ${creditorList.join("; ")}.` : "Cadastre contas em atraso para priorizar credores."
    ],
    nextActions: [
      "Pedir demonstrativo completo: principal, juros, multa, mora, tarifas, datas e saldo atualizado.",
      "Negociar primeiro desconto em juros/multa e depois prazo.",
      "Exigir acordo por escrito com valor total, parcelas, vencimentos e baixa da restricao apos pagamento.",
      "Usar CDC, Lei do Superendividamento e Procon-SP como base de orientacao quando a proposta comprometer despesas essenciais."
    ],
    baseAnalysis
  });
}

function buildToolAnalysis({
  message,
  highlights,
  nextActions,
  baseAnalysis
}: {
  message: string;
  highlights: string[];
  nextActions: string[];
  baseAnalysis: MayaAnalysis;
}): MayaAnalysis {
  return {
    assistantName: "MAYA",
    message,
    healthScore: baseAnalysis.healthScore,
    trend: baseAnalysis.trend,
    highlights,
    nextActions
  };
}

function isInterestCalculationPrompt(text: string) {
  return (
    text.includes("calcular juros") ||
    text.includes("calcula juros") ||
    text.includes("juros simples") ||
    text.includes("juros compostos") ||
    text.includes("quanto da de juros")
  );
}

function isPeriodMemoryPrompt(text: string) {
  return (
    (text.includes("quanto gastei") ||
      text.includes("quanto foi gasto") ||
      text.includes("quanto ganhei") ||
      text.includes("quanto entrou") ||
      text.includes("quanto recebi") ||
      text.includes("gastei com") ||
      text.includes("ganhei com")) &&
    (text.includes("mes") || text.includes("periodo") || text.includes("ultim"))
  );
}

function isGoalSavingsPlanPrompt(text: string) {
  return (
    text.includes("plano para meta") ||
    text.includes("plano de economia") ||
    text.includes("guardar por mes") ||
    text.includes("quanto guardar") ||
    (text.includes("meta") && text.includes("econom"))
  );
}

function isLoanProposalPrompt(text: string) {
  return (
    text.includes("proposta de emprestimo") ||
    text.includes("proposta de financiamento") ||
    text.includes("avaliar emprestimo") ||
    text.includes("avaliar financiamento") ||
    text.includes("vale a pena pegar emprestimo") ||
    text.includes("parcelas de")
  );
}

function isOverdueNegotiationPrompt(text: string) {
  return (
    text.includes("conta em atraso") ||
    text.includes("contas em atraso") ||
    text.includes("divida atrasada") ||
    text.includes("negociar divida") ||
    text.includes("renegociar") ||
    text.includes("credora") ||
    text.includes("credor") ||
    text.includes("cobranca")
  );
}

function parseFinancePrompt(prompt: string): ParsedFinancePrompt {
  const values = extractMoneyLikeValues(prompt);
  const percents = Array.from(prompt.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)).map((match) => parseBrazilianNumber(match[1]));
  const monthMatch = prompt.match(/(\d+)\s*(?:mes|meses|x|parcelas|prestacoes)/i);

  return {
    values,
    percents,
    months: monthMatch ? Number(monthMatch[1]) : undefined
  };
}

function extractMoneyLikeValues(prompt: string) {
  const withoutPercents = prompt.replace(/\d+(?:[.,]\d+)?\s*%/g, " ");
  const matches = Array.from(withoutPercents.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)/gi));

  return matches.map((match) => parseBrazilianNumber(match[1])).filter((value) => Number.isFinite(value) && value > 0);
}

function parseBrazilianNumber(value: string) {
  const text = value.trim().replace(/[^\d,.-]/g, "");
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  // A MAYA recebe texto livre; essa heuristica evita transformar "R$ 5.000" em R$ 5,00 nos calculos.
  const thousandsOnly = /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(text);
  const normalized =
    hasComma && hasDot
      ? text.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? text.replace(",", ".")
        : hasDot && thousandsOnly
          ? text.replace(/\./g, "")
          : text;

  return Number(normalized);
}

function inferMonths(values: number[]) {
  const candidate = values.find((value) => Number.isInteger(value) && value > 1 && value <= 600);

  return candidate && candidate < 1000 ? candidate : 0;
}

function inferInstallment(question: string, parsed: ParsedFinancePrompt) {
  const installmentMatch = question.match(/(?:parcela|parcelas|prestacao|prestacoes)\s*(?:de|em)?\s*r?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)/i);

  if (installmentMatch) {
    return parseBrazilianNumber(installmentMatch[1]);
  }

  return parsed.values[1] ?? 0;
}

function calculateFixedPayment(principal: number, monthlyRate: number, months: number) {
  if (monthlyRate <= 0) {
    return principal / months;
  }

  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function inferMonthlyRate(principal: number, installment: number, months: number) {
  if (installment * months <= principal) {
    return 0;
  }

  let low = 0;
  let high = 1;

  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const estimated = calculateFixedPayment(principal, mid, months);

    if (estimated > installment) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

function estimatePaymentCapacity(state: FinanceState) {
  const summary = calculateSummary(state);

  if (summary.income <= 0) {
    return 0;
  }

  const available = Math.max(0, summary.income - summary.expenses - summary.investments);
  return Math.min(summary.income * 0.15, available * 0.5);
}

function formatOverdueBill(bill: PayableBill) {
  return `${bill.title} (${formatCurrency(bill.amount)})`;
}

function normalizePrompt(question?: string) {
  return (question ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function inferMemoryTransactionType(text: string): "income" | "expense" {
  if (
    text.includes("ganhei") ||
    text.includes("renda") ||
    text.includes("receita") ||
    text.includes("entrou") ||
    text.includes("recebi")
  ) {
    return "income";
  }

  return "expense";
}

function inferMemoryMonths(text: string) {
  const match = text.match(/(?:ultimos|ultimas|em|nos|nas)?\s*(\d{1,2})\s*mes/);
  const months = match ? Number(match[1]) : 3;
  return Number.isFinite(months) && months > 0 ? Math.min(months, 36) : 3;
}

function inferSearchTerm(question: string, type: "income" | "expense") {
  const normalized = normalizePrompt(question);
  const categories = (type === "income" ? incomeCategories : expenseCategories).map((category) => ({
    original: category,
    normalized: normalizePrompt(category)
  }));
  const category = categories.find((item) => normalized.includes(item.normalized));

  if (category) {
    return category.normalized;
  }

  const match = normalized.match(/(?:com|de|em|para)\s+([a-z0-9\s]{3,40})(?:\s+nos|\s+nas|\s+ultim|\s+em\s+\d|\?|$)/);
  return match?.[1]?.trim() || "";
}

function getStartMonth(months: number) {
  return monthKeyAdd(getCurrentMonthKey(), -Math.max(0, months - 1));
}

function groupMemoryByMonth(transactions: Array<{ date: string; amount: number }>) {
  const groups = transactions.reduce<Record<string, number>>((totals, transaction) => {
    const month = transaction.date.slice(0, 7);
    totals[month] = (totals[month] ?? 0) + transaction.amount;
    return totals;
  }, {});

  return Object.entries(groups)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, total]) => ({ month, total }));
}

function formatMonthlyMemory(monthly: Array<{ month: string; total: number }>) {
  if (monthly.length === 0) {
    return "";
  }

  return `Por mes: ${monthly.map((item) => `${item.month}: ${formatCurrency(item.total)}`).join("; ")}.`;
}

function diffMonths(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}
