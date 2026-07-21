"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bot, Database, Send, Sparkles, TrendingDown, TrendingUp, Waves } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LedPanel } from "@/components/ui/led-panel";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { buildDataQualityReport, buildMayaLocalAnalysis, buildMonthSummaries } from "../lib/calculations";
import { useFinanceStore } from "../lib/use-finance-store";
import type { MayaAnalysis } from "../types";

type ChatMessage = {
  role: "user" | "maya";
  content: string;
};

export function MayaPage() {
  const { state } = useFinanceStore();
  const localAnalysis = useMemo(() => buildMayaLocalAnalysis(state), [state]);
  const quality = useMemo(() => buildDataQualityReport(state), [state]);
  const months = useMemo(() => buildMonthSummaries(state.transactions, 6), [state.transactions]);
  const [analysis, setAnalysis] = useState<MayaAnalysis>(localAnalysis);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "maya",
      content: localAnalysis.message
    }
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function askMaya(prompt: string) {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/maya/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          question: trimmed
        })
      });
      const nextAnalysis = (await response.json()) as MayaAnalysis;
      setAnalysis(nextAnalysis);
      setMessages((current) => [...current, { role: "maya", content: nextAnalysis.message }]);
    } catch {
      const fallback = buildMayaLocalAnalysis(state, trimmed);
      setAnalysis(fallback);
      setMessages((current) => [...current, { role: "maya", content: fallback.message }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell>
      <LedPanel className="mb-4 p-5" glow="cyan">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/maya-logo.png"
              alt="Maya"
              width={180}
              height={180}
              className="h-20 w-20 rounded-full object-cover drop-shadow-[0_0_22px_rgba(196,106,67,0.35)]"
              priority
            />
            <div>
              <p className="eyebrow">Assistente financeira do casal</p>
              <h1 className="mt-1 font-serif text-5xl font-bold text-bronze">MAYA</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Leitura minuciosa, comparacao mensal, calculos de juros, emprestimos, negociacao de atrasos e proximos passos sem julgamento.
              </p>
            </div>
          </div>
          <Badge tone="success">MAYA ativa</Badge>
        </div>
      </LedPanel>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="relative min-h-[42rem] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(73,198,192,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(184,121,69,.18)_1px,transparent_1px)] [background-size:36px_36px]" />
          <motion.div
            className="absolute inset-x-6 top-20 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
            animate={{ y: [0, 520, 0], opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative">
            <CardHeader
              eyebrow="Assistente financeiro"
              title="MAYA"
              action={<Badge tone="success">Pronta para orientar</Badge>}
            />
            <div className="mb-5 grid gap-4 md:grid-cols-4">
              <StatusTile label="Saude financeira" value={`${analysis.healthScore}/100`} />
              <StatusTile
                label="Tendencia"
                value={analysis.trend === "growth" ? "Crescimento" : analysis.trend === "drop" ? "Queda" : "Estavel"}
                icon={analysis.trend === "drop" ? <TrendingDown /> : <TrendingUp />}
              />
              <StatusTile label="Meses analisados" value="6" />
              <StatusTile label="Qualidade dos dados" value={`${quality.score}/100`} icon={<Database />} />
            </div>

            <div className="grid max-h-[28rem] gap-3 overflow-auto pr-1">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "maya"
                      ? "mr-8 rounded-2xl rounded-tl-sm border border-bronze/20 bg-bronze/10 p-4 text-cream"
                      : "ml-8 rounded-2xl rounded-tr-sm border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-50"
                  }
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                    {message.role === "maya" ? <Bot className="size-4" /> : <Sparkles className="size-4" />}
                    {message.role === "maya" ? "MAYA" : "Voce"}
                  </div>
                  <p className="text-sm leading-6">{message.content}</p>
                </div>
              ))}
            </div>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void askMaya(question);
              }}
            >
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Pergunte para a MAYA: calcule juros, avalie emprestimo ou negocie uma conta atrasada."
              />
              <Button type="submit" disabled={isLoading}>
                <Send className="size-4" aria-hidden="true" />
                Enviar
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Compare esse mes com o anterior.",
                "Onde estamos perdendo desempenho?",
                "Calcular juros de R$ 5.000 a 3% ao mes por 12 meses.",
                "Avaliar proposta de emprestimo de R$ 8.000 em 24 parcelas de R$ 560.",
                "Como negociar contas em atraso com juros?",
                "Quanto gastei com alimentacao nos ultimos 3 meses?",
                "Montar plano de economia para minha meta.",
                "Qual acao mais importante para melhorar a saude financeira?"
              ].map((item) => (
                <Button key={item} variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => void askMaya(item)}>
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader eyebrow="Leitura minuciosa" title="Destaques" />
            <div className="grid gap-3">
              {analysis.highlights.map((highlight) => (
                <div key={highlight} className="rounded-lg border border-cream/10 bg-cream/[0.04] p-3 text-sm leading-6 text-muted">
                  {highlight}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Direcionamento" title="Proximos passos" />
            <ol className="grid gap-3">
              {analysis.nextActions.map((action, index) => (
                <li key={action} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 text-sm leading-6 text-muted">
                  <span className="grid size-8 place-items-center rounded-full border border-bronze/30 bg-bronze/10 text-bronze">
                    {index + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader eyebrow="Historico" title="Comparativo mensal" />
            <div className="grid gap-3">
              {months.map((month) => (
                <div key={month.month} className="rounded-lg border border-cream/10 bg-cream/[0.04] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong className="text-cream">{month.month}</strong>
                    <span className="text-sm text-bronze">{formatPercent(month.savingsRate)}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted">
                    Receitas {formatCurrency(month.income)} - Despesas {formatCurrency(month.expenses)} - Saldo{" "}
                    {formatCurrency(month.availableBalance)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Waves className="mt-1 size-5 text-cyan-200" aria-hidden="true" />
              <p className="text-sm leading-6 text-cyan-50">
                A MAYA trabalha melhor quando receitas, despesas, metas e orcamentos estao cadastrados com regularidade.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function StatusTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-cream/10 bg-cream/[0.04] p-4">
      <div className="mb-3 text-bronze [&_svg]:size-5">{icon ?? <Sparkles className="size-5" />}</div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className="mt-2 block font-serif text-2xl text-bronze">{value}</strong>
    </div>
  );
}
