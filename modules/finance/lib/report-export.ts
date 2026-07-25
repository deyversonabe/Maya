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
  const workbookXml = buildExcelXmlWorkbook([
    {
      name: "Resumo",
      rows: [
        ["Indicador", "Valor"],
        ...summaryRows(report).map((row) => [row.Indicador, row.Valor])
      ]
    },
    {
      name: "Transacoes",
      rows: [
        ["Data", "Tipo", "Descricao", "Categoria", "Pessoa", "Metodo", "Destinatario", "Valor", "Anexo"],
        ...report.transactions.map((transaction) => [
          transaction.date,
          translateType(transaction.type),
          transaction.description,
          transaction.category,
          transaction.person,
          transaction.paymentMethod ?? "",
          transaction.paymentRecipient ?? "",
          transaction.amount,
          transaction.attachmentStoragePath || transaction.attachmentImageName || ""
        ])
      ]
    },
    {
      name: "Contas",
      rows: [
        ["Vencimento", "Conta", "Categoria", "Pessoa", "Status", "Metodo", "Destinatario", "Valor", "Anexo"],
        ...report.bills.map((bill) => [
          bill.dueDate,
          bill.title,
          bill.category,
          bill.person,
          translateBillStatus(bill.status),
          bill.paymentMethod,
          bill.paymentRecipient ?? "",
          bill.amount,
          bill.attachmentStoragePath || bill.attachmentImageName || ""
        ])
      ]
    },
    {
      name: "Recorrentes",
      rows: [
        ["Descricao", "Total", "Quantidade"],
        ...report.recurring.map((item) => [item.label, item.total, item.count])
      ]
    },
    {
      name: "Renda",
      rows: [
        ["Categoria", "Total", "Quantidade"],
        ...report.incomeByCategory.map((item) => [item.category, item.total, item.count])
      ]
    },
    {
      name: "Despesas",
      rows: [
        ["Categoria", "Total", "Quantidade"],
        ...report.expensesByCategory.map((item) => [item.category, item.total, item.count])
      ]
    }
  ]);

  downloadBlob(
    new Blob([workbookXml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    buildReportFilename(report, "xls")
  );
}

export function exportFinanceReportJson(report: FinanceReport) {
  downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), buildReportFilename(report, "json"));
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

type SpreadsheetCellValue = string | number | boolean | null | undefined;

type SpreadsheetSheet = {
  name: string;
  rows: SpreadsheetCellValue[][];
};

function buildExcelXmlWorkbook(sheets: SpreadsheetSheet[]) {
  const worksheets = sheets.map((sheet) => {
    const rows = sheet.rows.map((row, rowIndex) => {
      const cells = row.map((cell) => buildExcelXmlCell(cell, rowIndex === 0)).join("");
      return `<Row>${cells}</Row>`;
    });

    return [
      `<Worksheet ss:Name="${escapeXmlAttribute(sanitizeWorksheetName(sheet.name))}">`,
      "<Table>",
      ...rows,
      "</Table>",
      "</Worksheet>"
    ].join("");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    "<Styles>",
    '<Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#B87945" ss:Pattern="Solid"/></Style>',
    "</Styles>",
    ...worksheets,
    "</Workbook>"
  ].join("");
}

function buildExcelXmlCell(value: SpreadsheetCellValue, isHeader: boolean) {
  const style = isHeader ? ' ss:StyleID="Header"' : "";
  const type = typeof value === "number" && Number.isFinite(value) ? "Number" : "String";
  const content = value === null || value === undefined ? "" : String(value);

  return `<Cell${style}><Data ss:Type="${type}">${escapeXmlText(content)}</Data></Cell>`;
}

function sanitizeWorksheetName(name: string) {
  const cleanName = name.replace(/[\[\]:*?/\\]/g, " ").trim() || "Planilha";
  return cleanName.slice(0, 31);
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
