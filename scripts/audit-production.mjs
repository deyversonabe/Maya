import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "modules/captures/validation.ts",
  "modules/captures/server.ts",
  "app/captures/page.tsx",
  "modules/finance/lib/balance.ts",
  "modules/finance/lib/ofx.ts",
  "app/api/whatsapp/webhook/route.ts",
  "app/api/open-finance/connect-token/route.ts",
  "supabase/migrations/20260920_finance_capture_inbox.sql",
  "supabase/migrations/20260920_open_finance_items.sql"
];

const errors = [];
const warnings = [];
for (const file of requiredFiles) {
  try { await access(resolve(root, file)); }
  catch { errors.push(`Arquivo obrigatorio ausente: ${file}`); }
}

const envExample = await readFile(resolve(root, ".env.example"), "utf8");
for (const forbidden of ["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_OPENAI_API_KEY", "NEXT_PUBLIC_PLUGGY_CLIENT_SECRET", "NEXT_PUBLIC_WHATSAPP_APP_SECRET"]) {
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

console.log("MAYA production audit");
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log(`OK: ${requiredFiles.length} artefatos criticos conferidos; ${warnings.length} aviso(s).`);
