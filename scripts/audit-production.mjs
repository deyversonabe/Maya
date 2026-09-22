import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "modules/captures/validation.ts",
  "modules/captures/server.ts",
  "app/captures/page.tsx",
  "modules/finance/lib/balance.ts",
  "modules/finance/lib/ofx.ts",
  "modules/finance/lib/file-kind.ts",
  "modules/finance/lib/document-payload.ts",
  "modules/finance/components/universal-document-picker.tsx",
  "app/api/maya/statement/route.ts",
  "app/api/whatsapp/webhook/route.ts",
  "app/api/open-finance/connect-token/route.ts",
  "supabase/migrations/20260920_finance_capture_inbox.sql",
  "supabase/migrations/20260920_open_finance_items.sql"
];

const forbiddenDuplicateDirectories = [
  "app/app",
  "modules/modules",
  "tests/tests",
  "lib/lib",
  "scripts/scripts",
  "public/public",
  "supabase/migrations/migrations",
  "supabase/migrations/supabase"
];

const errors = [];
const warnings = [];
for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    errors.push(`Arquivo obrigatorio ausente: ${file}`);
  }
}

for (const directory of forbiddenDuplicateDirectories) {
  try {
    const duplicate = await stat(resolve(root, directory));
    if (duplicate.isDirectory()) errors.push(`Pasta duplicada proibida: ${directory}`);
  } catch {}
}

const envExample = await readFile(resolve(root, ".env.example"), "utf8");
for (const forbidden of [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_PLUGGY_CLIENT_SECRET",
  "NEXT_PUBLIC_WHATSAPP_APP_SECRET"
]) {
  if (envExample.includes(forbidden)) errors.push(`Segredo nao pode ser publico: ${forbidden}`);
}

for (const required of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "WHATSAPP_APP_SECRET",
  "PLUGGY_CLIENT_SECRET"
]) {
  if (!envExample.includes(required)) warnings.push(`Variavel esperada nao documentada: ${required}`);
}

const captureMigration = await readFile(resolve(root, "supabase/migrations/20260920_finance_capture_inbox.sql"), "utf8");
if (!/enable row level security/i.test(captureMigration)) errors.push("A inbox de capturas precisa manter RLS habilitado.");
if (!/expires_at/i.test(captureMigration)) warnings.push("A inbox nao declara expiracao de rascunhos.");

const statementRoute = await readFile(resolve(root, "app/api/maya/statement/route.ts"), "utf8");
if (!/fileDataUrl/.test(statementRoute) || !/fileUrl/.test(statementRoute)) {
  errors.push("A rota de extrato precisa aceitar PDF por URL assinada e fallback base64.");
}
if (!/maya_statement_pdf_failed/.test(statementRoute)) {
  warnings.push("A rota de extrato nao possui log estruturado para falhas de PDF.");
}

console.log("MAYA production audit");
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log(`OK: ${requiredFiles.length} artefatos criticos conferidos; ${warnings.length} aviso(s).`);
