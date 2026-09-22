import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const errors = [];
const checks = [
  ["modules/finance/components/expenses-page.tsx", "UniversalDocumentPicker", "Despesas/Extrato"],
  ["modules/finance/components/bills-page.tsx", "UniversalDocumentPicker", "Contas"],
  ["modules/finance/components/finance-dashboard.tsx", "UniversalDocumentPicker", "Dashboard"],
  ["modules/finance/components/work-hours-page.tsx", "UniversalDocumentPicker", "Horas/Ponto"],
  ["modules/finance/components/salon-materials-page.tsx", "UniversalDocumentPicker", "Materiais"],
  ["modules/finance/components/fiscal-tools-page.tsx", "UniversalDocumentPicker", "Fiscal"],
  ["modules/finance/components/fiscal-note-import-page.tsx", "UniversalDocumentPicker", "Nota fiscal por foto/PDF"],
  ["app/api/maya/statement/route.ts", "fileDataUrl", "Extrato PDF base64"],
  ["app/api/maya/statement/route.ts", "fileUrl", "Extrato PDF signed URL"],
  ["modules/ai/maya.ts", "TODAS as paginas", "Extrato multipagina"]
];

for (const [file, needle, label] of checks) {
  const text = await readFile(resolve(root, file), "utf8");
  if (!text.includes(needle)) errors.push(`${label}: esperado '${needle}' em ${file}`);
}

const dashboard = await readFile(resolve(root, "modules/finance/components/finance-dashboard.tsx"), "utf8");
if (!dashboard.includes('accept=".csv,text/csv"')) errors.push("CSV deixou de ser importador especializado.");
const banking = await readFile(resolve(root, "modules/open-finance/components/banking-page.tsx"), "utf8");
if (!banking.includes('accept=".ofx,application/x-ofx,text/plain"')) errors.push("OFX deixou de ser importador especializado.");
const fiscalNote = await readFile(resolve(root, "modules/finance/components/fiscal-note-import-page.tsx"), "utf8");
if (!fiscalNote.includes('accept=".xml,text/xml,application/xml"')) errors.push("XML fiscal deixou de ser importador especializado.");

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`MAYA document capture audit: OK (${checks.length + 3} verificacoes)`);
