const PLUGGY_API_URL = "https://api.pluggy.ai";
const API_KEY_REFRESH_MS = 100 * 60 * 1000;

let cachedKey: { value: string; createdAt: number } | null = null;

export interface PluggyAccount {
  id: string;
  itemId: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  owner?: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description?: string;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  type?: string;
  category?: string;
  status?: string;
  currencyCode?: string;
}

export interface PluggyInvestment {
  id: string;
  itemId?: string;
  name?: string;
  code?: string;
  type?: string;
  balance?: number;
  amount?: number;
  currencyCode?: string;
}

export function isPluggyConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export async function createPluggyConnectToken(input: {
  clientUserId: string;
  itemId?: string;
}) {
  const apiKey = await getPluggyApiKey();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const body: Record<string, unknown> = {
    options: {
      clientUserId: input.clientUserId,
      avoidDuplicates: true,
      ...(appUrl ? { webhookUrl: `${appUrl}/api/open-finance/webhook`, oauthRedirectUri: `${appUrl}/banking` } : {})
    }
  };
  if (input.itemId) body.itemId = input.itemId;

  return pluggyFetch<{ accessToken: string }>("/connect_token", {
    method: "POST",
    apiKey,
    body
  });
}

export async function listPluggyAccounts(itemId: string) {
  const result = await pluggyGet<{ results?: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return result.results ?? [];
}

export async function listPluggyTransactions(accountId: string) {
  const result = await pluggyGet<{ results?: PluggyTransaction[]; next?: string | null }>(`/v2/transactions?accountId=${encodeURIComponent(accountId)}`);
  return result.results ?? [];
}

export async function listPluggyInvestments(itemId: string) {
  const result = await pluggyGet<{ results?: PluggyInvestment[] }>(`/investments?itemId=${encodeURIComponent(itemId)}&pageSize=500`);
  return result.results ?? [];
}

export async function createPluggyWebhook() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!appUrl || !secret) throw new Error("pluggy_webhook_config_missing");
  return pluggyPost("/webhooks", {
    url: `${appUrl}/api/open-finance/webhook`,
    event: "all",
    headers: { "X-Maya-Pluggy-Secret": secret }
  });
}

async function getPluggyApiKey() {
  if (cachedKey && Date.now() - cachedKey.createdAt < API_KEY_REFRESH_MS) return cachedKey.value;
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("pluggy_not_configured");
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: "no-store"
  });
  const payload = await parseJson(response);
  if (!response.ok || typeof payload.apiKey !== "string") throw pluggyError(response.status, payload);
  cachedKey = { value: payload.apiKey, createdAt: Date.now() };
  return payload.apiKey;
}

async function pluggyGet<T>(path: string) {
  const apiKey = await getPluggyApiKey();
  return pluggyFetch<T>(path, { method: "GET", apiKey });
}

async function pluggyPost(path: string, body: unknown) {
  const apiKey = await getPluggyApiKey();
  return pluggyFetch<Record<string, unknown>>(path, { method: "POST", apiKey, body });
}

async function pluggyFetch<T>(path: string, input: { method: "GET" | "POST"; apiKey: string; body?: unknown }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${PLUGGY_API_URL}${path}`, {
      method: input.method,
      headers: {
        "X-API-KEY": input.apiKey,
        ...(input.body ? { "Content-Type": "application/json" } : {})
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await parseJson(response);
    if (!response.ok) throw pluggyError(response.status, payload);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; }
  catch { return {}; }
}

function pluggyError(status: number, payload: Record<string, unknown>) {
  const message = typeof payload.message === "string" ? payload.message : typeof payload.codeDescription === "string" ? payload.codeDescription : "Pluggy indisponivel.";
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}
