"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, FileUp, Landmark, Loader2, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { mayaFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { findTransactionDuplicateMatches } from "@/modules/finance/lib/duplicates";
import { ofxLinesToTransactions, parseOfx } from "@/modules/finance/lib/ofx";
import { useFinanceStore } from "@/modules/finance/lib/use-finance-store";
import type { FinanceAccount, Person, Transaction } from "@/modules/finance/types";
import type { OpenFinanceItemRecord } from "../server";
import type { PluggyAccount, PluggyInvestment, PluggyTransaction } from "../pluggy";

declare global {
  interface Window {
    PluggyConnect?: new (options: {
      connectToken: string;
      includeSandbox?: boolean;
      onSuccess?: (data: { item?: { id?: string; connector?: { name?: string } }; id?: string }) => void;
      onError?: (error: { message?: string }) => void;
      onClose?: () => void;
    }) => { init: () => void };
  }
}

const people: Person[] = ["Deyverson", "Tom", "Casal"];

export function BankingPage() {
  const { state, actions } = useFinanceStore();
  const [feedback, setFeedback] = useState("Escolha OFX para importar sem conexao permanente ou conecte uma instituicao pelo Open Finance.");
  const [ofxText, setOfxText] = useState("");
  const [ofxFileName, setOfxFileName] = useState("");
  const [person, setPerson] = useState<Person>("Casal");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [items, setItems] = useState<OpenFinanceItemRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [pluggyAccounts, setPluggyAccounts] = useState<PluggyAccount[]>([]);
  const [selectedPluggyAccount, setSelectedPluggyAccount] = useState("");
  const [pluggyTransactions, setPluggyTransactions] = useState<PluggyTransaction[]>([]);
  const [investments, setInvestments] = useState<PluggyInvestment[]>([]);
  const [loading, setLoading] = useState(false);
  const scriptReady = useRef(false);

  const parsedOfx = useMemo(() => ofxText ? parseOfx(ofxText) : null, [ofxText]);
  const ofxTransactions = useMemo(() => parsedOfx ? ofxLinesToTransactions(parsedOfx, { person, accountId: accountId || undefined }) : [], [parsedOfx, person, accountId]);
  const ofxDuplicates = useMemo(() => findTransactionDuplicateMatches(state.transactions, ofxTransactions), [state.transactions, ofxTransactions]);
  const ofxDuplicateKeys = useMemo(() => new Set(ofxDuplicates.map((match) => txKey(match.incoming))), [ofxDuplicates]);
  const cleanOfxTransactions = useMemo(() => ofxTransactions.filter((transaction) => !ofxDuplicateKeys.has(txKey(transaction))), [ofxTransactions, ofxDuplicateKeys]);

  const connectedTransactions = useMemo<Array<Omit<Transaction, "id" | "createdAt">>>(() => pluggyTransactions.map((transaction) => ({
    type: transaction.amount < 0 || transaction.type?.toUpperCase() === "DEBIT" ? "expense" : "income",
    description: transaction.description || transaction.descriptionRaw || "Movimentacao bancaria",
    amount: Math.abs(Number(transaction.amount || 0)),
    category: "Outros",
    person,
    date: transaction.date?.slice(0, 10) || "",
    recurring: false,
    source: "import",
    accountId: accountId || undefined,
    externalId: transaction.id,
    institutionId: transaction.accountId
  })), [pluggyTransactions, person, accountId]);
  const connectedDuplicates = useMemo(() => findTransactionDuplicateMatches(state.transactions, connectedTransactions), [state.transactions, connectedTransactions]);
  const connectedDuplicateKeys = useMemo(() => new Set(connectedDuplicates.map((match) => txKey(match.incoming))), [connectedDuplicates]);
  const cleanConnectedTransactions = useMemo(() => connectedTransactions.filter((transaction) => !connectedDuplicateKeys.has(txKey(transaction))), [connectedTransactions, connectedDuplicateKeys]);

  useEffect(() => { void loadItems(); }, []);
  useEffect(() => { if (!accountId && state.accounts[0]?.id) setAccountId(state.accounts[0].id); }, [accountId, state.accounts]);

  async function loadItems() {
    try {
      const response = await mayaFetch("/api/open-finance/items", { cache: "no-store" });
      const result = await response.json() as { items?: OpenFinanceItemRecord[] };
      if (response.ok) setItems(result.items ?? []);
    } catch { /* Open Finance is optional. */ }
  }

  async function openPluggy(itemId?: string) {
    if (!scriptReady.current || !window.PluggyConnect) {
      setFeedback("O conector bancario ainda esta carregando. Tente novamente em alguns segundos.");
      return;
    }
    setLoading(true);
    try {
      const response = await mayaFetch("/api/open-finance/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {})
      });
      const result = await response.json() as { accessToken?: string; error?: string };
      if (!response.ok || !result.accessToken) throw new Error(result.error || "Open Finance indisponivel.");
      const widget = new window.PluggyConnect({
        connectToken: result.accessToken,
        includeSandbox: process.env.NEXT_PUBLIC_PLUGGY_SANDBOX === "true",
        onSuccess: ({ item, id }) => {
          const connectedId = item?.id || id;
          if (!connectedId) return;
          void saveConnectedItem(connectedId, item?.connector?.name);
        },
        onError: (error) => setFeedback(error.message || "Nao foi possivel concluir a conexao."),
        onClose: () => setLoading(false)
      });
      widget.init();
    } catch (error) {
      setLoading(false);
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel abrir o Open Finance.");
    }
  }

  async function saveConnectedItem(itemId: string, connectorName?: string) {
    try {
      const response = await mayaFetch("/api/open-finance/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, connectorName, status: "connected" })
      });
      if (!response.ok) throw new Error("Conexao criada, mas nao foi possivel registra-la na MAYA.");
      setSelectedItemId(itemId);
      await loadItems();
      await loadPluggyData(itemId);
      setFeedback("Conexao concluida. Os dados estao apenas em leitura ate voce revisar e importar.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Falha ao registrar a conexao."); }
    finally { setLoading(false); }
  }

  async function loadPluggyData(itemId: string) {
    setLoading(true);
    setSelectedItemId(itemId);
    try {
      const [accountResponse, investmentResponse] = await Promise.all([
        mayaFetch(`/api/open-finance/accounts?itemId=${encodeURIComponent(itemId)}`, { cache: "no-store" }),
        mayaFetch(`/api/open-finance/investments?itemId=${encodeURIComponent(itemId)}`, { cache: "no-store" })
      ]);
      const accountPayload = await accountResponse.json() as { accounts?: PluggyAccount[]; error?: string };
      const investmentPayload = await investmentResponse.json() as { investments?: PluggyInvestment[] };
      if (!accountResponse.ok) throw new Error(accountPayload.error || "Nao foi possivel consultar contas.");
      setPluggyAccounts(accountPayload.accounts ?? []);
      setInvestments(investmentPayload.investments ?? []);
      setSelectedPluggyAccount(accountPayload.accounts?.[0]?.id ?? "");
      setPluggyTransactions([]);
      setFeedback("Dados atualizados em modo leitura. Escolha uma conta para revisar movimentacoes.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o Open Finance."); }
    finally { setLoading(false); }
  }

  async function loadTransactions(id = selectedPluggyAccount) {
    if (!id) return;
    setLoading(true);
    try {
      const response = await mayaFetch(`/api/open-finance/transactions?accountId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json() as { transactions?: PluggyTransaction[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Nao foi possivel carregar as transacoes.");
      setPluggyTransactions(result.transactions ?? []);
      setFeedback("Movimentacoes carregadas em modo leitura. Revise antes de importar.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar as transacoes."); }
    finally { setLoading(false); }
  }

  async function readOfx(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setFeedback("O OFX deve ter no maximo 10 MB."); return; }
    try {
      const text = await file.text();
      const parsed = parseOfx(text);
      if (!parsed.lines.length) throw new Error("Nenhuma movimentacao foi encontrada nesse OFX.");
      setOfxText(text);
      setOfxFileName(file.name);
      setFeedback(`OFX lido: ${parsed.lines.length} movimentacoes. Nada foi importado ainda.`);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Nao foi possivel ler o OFX."); }
  }

  function importOfx() {
    if (!cleanOfxTransactions.length) { setFeedback("Nao ha novas movimentacoes para importar."); return; }
    actions.addTransactions(cleanOfxTransactions);
    setFeedback(`${cleanOfxTransactions.length} movimentacoes importadas. ${ofxDuplicates.length} duplicadas foram ignoradas.`);
    setOfxText(""); setOfxFileName("");
  }

  function importConnected() {
    if (!cleanConnectedTransactions.length) { setFeedback("Nao ha novas movimentacoes para importar."); return; }
    actions.addTransactions(cleanConnectedTransactions);
    setFeedback(`${cleanConnectedTransactions.length} movimentacoes importadas apos confirmacao. ${connectedDuplicates.length} duplicadas foram ignoradas.`);
    setPluggyTransactions([]);
  }

  return (
    <AppShell>
      <Script src="https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js" strategy="afterInteractive" onLoad={() => { scriptReady.current = true; }} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Sem conexao permanente" title="Importar OFX" description="Exporte o arquivo no banco, confira a previa e confirme. A MAYA preserva o identificador externo para evitar reimportacao." />
          <div className="grid gap-3">
            <Label>Arquivo OFX<Input type="file" accept=".ofx,application/x-ofx,text/plain" onChange={(event) => void readOfx(event.target.files?.[0])} /></Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>Pessoa<Select value={person} onChange={(e) => setPerson(e.target.value as Person)}>{people.map((value) => <option key={value}>{value}</option>)}</Select></Label>
              <AccountSelect accounts={state.accounts} value={accountId} onChange={setAccountId} />
            </div>
            {parsedOfx ? <>
              <SummaryRow title={ofxFileName || "OFX"} detail={`${parsedOfx.lines.length} linhas · ${cleanOfxTransactions.length} novas · ${ofxDuplicates.length} duplicadas`} />
              <TransactionPreview transactions={ofxTransactions} limit={12} />
              <Button onClick={importOfx} disabled={!cleanOfxTransactions.length}><CheckCircle2 className="size-4" />Confirmar importacao</Button>
            </> : <EmptyState icon={<FileUp className="size-8" />} text="Envie um OFX para ver uma previa. Nenhum saldo muda antes da confirmacao." />}
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Automacao opcional" title="Open Finance" description="Conecte contas, cartoes e investimentos. A conexao fica em modo leitura; voce escolhe quando uma movimentacao entra na MAYA." action={<Button disabled={loading} onClick={() => void openPluggy()}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}Conectar</Button>} />
          <div className="grid gap-3">
            {items.length ? items.map((item) => <div key={item.itemId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream/10 bg-cream/[0.03] p-3">
              <div><strong className="text-cream">{item.connectorName || "Instituicao conectada"}</strong><p className="text-xs text-muted">{item.status} · {item.itemId.slice(0, 8)}…</p></div>
              <div className="flex gap-2"><Button variant="secondary" onClick={() => void loadPluggyData(item.itemId)}><RefreshCw className="size-4" />Ler dados</Button><Button variant="ghost" onClick={() => void openPluggy(item.itemId)}>Atualizar conexao</Button></div>
            </div>) : <EmptyState icon={<Landmark className="size-8" />} text="Open Finance e opcional. Sem credenciais, o OFX continua funcionando normalmente." />}

            {selectedItemId && (pluggyAccounts.length > 0 || investments.length > 0) ? <div className="grid gap-3 rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 p-4">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="success">Somente leitura</Badge><span className="text-sm text-muted">Importacao exige confirmacao separada.</span></div>
              {pluggyAccounts.length ? <div className="grid gap-2"><strong className="text-sm text-cream">Contas e cartoes</strong>{pluggyAccounts.map((account) => <button type="button" key={account.id} onClick={() => setSelectedPluggyAccount(account.id)} className={`flex items-center justify-between rounded-lg border p-3 text-left ${selectedPluggyAccount === account.id ? "border-neon-cyan/40 bg-neon-cyan/10" : "border-cream/10"}`}><span><span className="block font-bold text-cream">{account.name || account.marketingName || account.type || "Conta"}</span><span className="text-xs text-muted">{account.number || account.type}</span></span><span className="font-bold text-cream">{typeof account.balance === "number" ? formatCurrency(account.balance) : "—"}</span></button>)}</div> : null}
              {selectedPluggyAccount ? <Button variant="secondary" onClick={() => void loadTransactions()} disabled={loading}><WalletCards className="size-4" />Revisar movimentacoes</Button> : null}
              {investments.length ? <div><strong className="text-sm text-cream">Investimentos</strong><p className="mt-1 text-sm text-muted">{investments.length} ativos encontrados · patrimonio informado: {formatCurrency(investments.reduce((total, investment) => total + Number(investment.balance ?? investment.amount ?? 0), 0))}</p></div> : null}
            </div> : null}

            {pluggyTransactions.length ? <div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Label>Pessoa<Select value={person} onChange={(e) => setPerson(e.target.value as Person)}>{people.map((value) => <option key={value}>{value}</option>)}</Select></Label><AccountSelect accounts={state.accounts} value={accountId} onChange={setAccountId} /></div><SummaryRow title="Movimentacoes conectadas" detail={`${pluggyTransactions.length} lidas · ${cleanConnectedTransactions.length} novas · ${connectedDuplicates.length} duplicadas`} /><TransactionPreview transactions={connectedTransactions} limit={20} /><Button onClick={importConnected} disabled={!cleanConnectedTransactions.length}><CheckCircle2 className="size-4" />Confirmar e importar novas</Button></div> : null}
          </div>
        </Card>
      </div>
      <p className="mt-4 rounded-xl border border-bronze/20 bg-bronze/10 px-4 py-3 text-sm font-bold text-cream">{feedback}</p>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-muted"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" /><p><strong className="text-cream">Controle humano:</strong> conexao bancaria, OFX e IA podem coletar e organizar dados, mas nenhuma movimentacao e adicionada silenciosamente. Revise e confirme.</p></div>
    </AppShell>
  );
}

function AccountSelect({ accounts, value, onChange }: { accounts: FinanceAccount[]; value: string; onChange: (value: string) => void }) {
  return <Label>Conta na MAYA<Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Sem vinculo</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Label>;
}

function SummaryRow({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 p-3"><strong className="text-sm text-cream">{title}</strong><p className="mt-1 text-xs text-muted">{detail}</p></div>;
}

function TransactionPreview({ transactions, limit }: { transactions: Array<Omit<Transaction, "id" | "createdAt">>; limit: number }) {
  return <div className="max-h-[420px] overflow-auto rounded-xl border border-cream/10"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-moss-950"><tr className="text-muted"><th className="p-2">Data</th><th className="p-2">Descricao</th><th className="p-2">Tipo</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{transactions.slice(0, limit).map((transaction, index) => <tr key={`${transaction.externalId ?? transaction.date}-${index}`} className="border-t border-cream/10"><td className="p-2 text-muted">{transaction.date}</td><td className="p-2 text-cream">{transaction.description}</td><td className="p-2">{transaction.type === "income" ? "Entrada" : "Saida"}</td><td className="p-2 text-right font-bold text-cream">{formatCurrency(transaction.amount)}</td></tr>)}</tbody></table>{transactions.length > limit ? <p className="p-2 text-center text-xs text-muted">Mostrando {limit} de {transactions.length} linhas.</p> : null}</div>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-cream/15 p-5 text-center text-muted"><div>{icon}<p className="mt-2 max-w-sm text-sm">{text}</p></div></div>;
}

function txKey(transaction: Omit<Transaction, "id" | "createdAt">) {
  return transaction.externalId ? `external:${transaction.institutionId ?? ""}:${transaction.externalId}` : `${transaction.type}|${transaction.date}|${transaction.amount}|${transaction.description.toLowerCase().trim()}`;
}
