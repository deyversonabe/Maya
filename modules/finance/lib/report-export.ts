import { formatCurrency, formatPercent } from "@/lib/utils";
import type { FinanceReport } from "./reporting";
import { buildReportFilename } from "./reporting";

export async function exportFinanceReportPdf(report: FinanceReport) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFillColor(8, 22, 15);
  doc.rect(0, 0, 595, 842, "F");
  doc.setTextColor(255, 245, 233);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Maya - Relatorio financeiro", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periodo: ${report.period.start} ate ${report.period.end}`, 40, 68);
  doc.text(`Gerado em: ${formatDateTime(report.generatedAt)}`, 40, 84);

  autoTable(doc, {
    startY: 110,
    head: [["Resumo", "Valor"]],
    body: [
      ["Renda", formatCurrency(report.summary.income)],
      ["Despesa", formatCurrency(report.summary.expenses)],
      ["Investimentos", formatCurrency(report.summary.investments)],
      ["Transferencias", formatCurrency(report.summary.transfers)],
      ["Saldo", formatCurrency(report.summary.balance)],
      ["Contas pendentes", formatCurrency(report.summary.pendingBills)],
      ["Contas pagas", formatCurrency(report.summary.paidBills)],
      ["Contas atrasadas", formatCurrency(report.summary.overdueBills)],
      ["Metas", `${formatCurrency(report.summary.goalsCurrent)} de ${formatCurrency(report.summary.goalsTarget)}`],
      ["Progresso das metas", formatPercent(report.summary.goalsTarget > 0 ? (report.summary.goalsCurrent / report.summary.goalsTarget) * 100 : 0)]
    ],
    theme: "grid",
    headStyles: { fillColor: [184, 121, 69], textColor: [8, 22, 15] },
    bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233] },
    alternateRowStyles: { fillColor: [31, 48, 38] },
    styles: { lineColor: [85, 247, 255], lineWidth: 0.25 }
  });

  autoTable(doc, {
    startY: getNextY(doc),
    head: [["Data", "Tipo", "Descricao", "Categoria", "Pessoa", "Valor"]],
    body: report.transactions.slice(0, 80).map((transaction) => [
      transaction.date,
      translateType(transaction.type),
      transaction.description,
      transaction.category,
      transaction.person,
      formatCurrency(transaction.amount)
    ]),
    theme: "grid",
    headStyles: { fillColor: [85, 247, 255], textColor: [8, 22, 15] },
    bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233], fontSize: 8 },
    alternateRowStyles: { fillColor: [31, 48, 38] },
    styles: { lineColor: [255, 245, 233], lineWidth: 0.15 }
  });

  autoTable(doc, {
    startY: getNextY(doc),
    head: [["Vencimento", "Conta", "Status", "Metodo", "Valor"]],
    body: report.bills.slice(0, 80).map((bill) => [
      bill.dueDate,
      bill.title,
      translateBillStatus(bill.status),
      bill.paymentMethod,
      formatCurrency(bill.amount)
    ]),
    theme: "grid",
    headStyles: { fillColor: [255, 210, 122], textColor: [8, 22, 15] },
    bodyStyles: { fillColor: [16, 33, 24], textColor: [255, 245, 233], fontSize: 8 },
    alternateRowStyles: { fillColor: [31, 48, 38] },
    styles: { lineColor: [255, 245, 233], lineWidth: 0.15 }
  });

  doc.save(buildReportFilename(report, "pdf"));
}

export async function exportFinanceReportExcel(report: FinanceReport) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows(report)), "Resumo");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.transactions.map((transaction) => ({
        Data: transaction.date,
        Tipo: translateType(transaction.type),
        Descricao: transaction.description,
        Categoria: transaction.category,
        Pessoa: transaction.person,
        Metodo: transaction.paymentMethod ?? "",
        Destinatario: transaction.paymentRecipient ?? "",
        Valor: transaction.amount,
        Anexo: transaction.attachmentStoragePath || transaction.attachmentImageName || ""
      }))
    ),
    "Transacoes"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.bills.map((bill) => ({
        Vencimento: bill.dueDate,
        Conta: bill.title,
        Categoria: bill.category,
        Pessoa: bill.person,
        Status: translateBillStatus(bill.status),
        Metodo: bill.paymentMethod,
        Destinatario: bill.paymentRecipient ?? "",
        Valor: bill.amount,
        Anexo: bill.attachmentStoragePath || bill.attachmentImageName || ""
      }))
    ),
    "Contas"
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.recurring), "Recorrentes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.incomeByCategory), "Renda");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.expensesByCategory), "Despesas");

  XLSX.writeFile(workbook, buildReportFilename(report, "xlsx"));
}

export function exportFinanceReportJson(report: FinanceReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildReportFilename(report, "json");
  link.click();
  URL.revokeObjectURL(url);
}

function summaryRows(report: FinanceReport) {
  return [
    { Indicador: "Periodo inicial", Valor: report.period.start },
    { Indicador: "Periodo final", Valor: report.period.end },
    { Indicador: "Renda", Valor: report.summary.income },
    { Indicador: "Despesa", Valor: report.summary.expenses },
    { Indicador: "Investimentos", Valor: report.summary.investments },
    { Indicador: "Transferencias", Valor: report.summary.transfers },
    { Indicador: "Saldo", Valor: report.summary.balance },
    { Indicador: "Contas pendentes", Valor: report.summary.pendingBills },
    { Indicador: "Contas pagas", Valor: report.summary.paidBills },
    { Indicador: "Contas atrasadas", Valor: report.summary.overdueBills },
    { Indicador: "Metas guardadas", Valor: report.summary.goalsCurrent },
    { Indicador: "Metas planejadas", Valor: report.summary.goalsTarget }
  ];
}

function getNextY(doc: unknown) {
  const tableDoc = doc as { lastAutoTable?: { finalY?: number } };
  return Math.min((tableDoc.lastAutoTable?.finalY ?? 110) + 26, 740);
}

function translateType(type: string) {
  const labels: Record<string, string> = {
    income: "Renda",
    expense: "Despesa",
    investment: "Investimento",
    transfer: "Transferencia"
  };

  return labels[type] ?? type;
}

function translateBillStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Atrasado"
  };

  return labels[status] ?? status;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}
