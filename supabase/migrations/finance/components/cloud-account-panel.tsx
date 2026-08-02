"use client";

import { useState } from "react";
import { Cloud, LogIn, LogOut, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { FinanceCloudSync } from "../lib/use-finance-store";

export function CloudAccountPanel({ cloud }: { cloud: FinanceCloudSync }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting || cloud.status === "loading" || cloud.status === "syncing";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback("");

    try {
      await cloud.signIn(email, password);
      setFeedback("Conta conectada. Dados compartilhados serao sincronizados.");

      setPassword("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao consegui acessar sua conta agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!cloud.isConfigured) {
    return (
      <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-100">
          <Cloud className="size-4" aria-hidden="true" />
          <strong>Sincronizacao online</strong>
        </div>
        <p className="text-sm leading-6 text-amber-50">
          A conta online ainda precisa ser ativada no servidor para os dados aparecerem em celular e computador.
        </p>
      </div>
    );
  }

  if (cloud.email) {
    return (
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-2xl font-bold text-cyan-50">Conta conectada</h3>
              <Badge tone={cloud.status === "online" ? "success" : cloud.status === "error" ? "warning" : "info"}>
                {getStatusLabel(cloud.status)}
              </Badge>
            </div>
            <p className="break-all text-sm font-bold text-cyan-100">{cloud.email}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{cloud.message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void cloud.syncNow()} disabled={isBusy}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Sincronizar
            </Button>
            <Button variant="ghost" onClick={() => void cloud.signOut()} disabled={isBusy}>
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>
        <p className="rounded-lg border border-cyan-200/20 bg-moss-950/35 px-3 py-2 text-sm leading-6 text-cyan-50">
          Os usuarios autorizados acessam a mesma base financeira. Ao fechar a aba ou ficar sem uso, a senha sera
          solicitada novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-2xl font-bold text-cyan-50">Conta e sincronizacao</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{cloud.message}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Os dados ficam compartilhados entre os usuarios autorizados e sao salvos online automaticamente.
          </p>
        </div>
        <Badge tone={cloud.status === "error" ? "warning" : "info"}>{getStatusLabel(cloud.status)}</Badge>
      </div>

      <form className="grid gap-3" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Label>
            E-mail
            <Input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
            />
          </Label>
          <Label>
            Senha
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="sua senha"
              minLength={1}
              required
            />
          </Label>
        </div>

        {feedback ? (
          <p className="rounded-lg border border-bronze/20 bg-bronze/10 px-3 py-2 text-sm font-bold text-cream">
            {feedback}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isBusy}>
            <LogIn className="size-4" aria-hidden="true" />
            Entrar
          </Button>
        </div>
      </form>
    </div>
  );
}

function getStatusLabel(status: FinanceCloudSync["status"]) {
  if (status === "online") {
    return "Online";
  }

  if (status === "syncing") {
    return "Sincronizando";
  }

  if (status === "loading") {
    return "Carregando";
  }

  if (status === "error") {
    return "Revisar";
  }

  if (status === "signed_out") {
    return "Entrar";
  }

  return "Indisponivel";
}
