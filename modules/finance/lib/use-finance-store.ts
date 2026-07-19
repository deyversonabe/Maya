"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createEmptyFinanceState } from "../data/defaults";
import { migrateFinanceState } from "./migrations";
import type { Budget, FinanceState, Goal, PayableBill, Transaction } from "../types";

const STORAGE_KEY = "juntos.finance.v1";
const CLOUD_TABLE = "finance_workspace_states";
const CLOUD_WORKSPACE_ID =
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";
const CLOUD_SYNC_DELAY_MS = 900;
const SESSION_LOCK_KEY = "maya.finance.session_locked.v1";
const SESSION_LAST_ACTIVITY_KEY = "maya.finance.last_activity.v1";
const DEFAULT_SESSION_IDLE_MINUTES = 15;
const SESSION_IDLE_MS = getSessionIdleMilliseconds();

type CloudSyncStatus = "unconfigured" | "signed_out" | "loading" | "online" | "syncing" | "error";

interface CloudSyncState {
  isConfigured: boolean;
  status: CloudSyncStatus;
  email: string | null;
  message: string;
  lastSyncedAt: string | null;
}

interface FinanceCloudRow {
  state: unknown;
  updated_at: string | null;
}

export function useFinanceStore() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [state, setState] = useState<FinanceState>(() => createEmptyFinanceState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloud, setCloud] = useState<CloudSyncState>(() => ({
    isConfigured: Boolean(supabase),
    status: supabase ? "loading" : "unconfigured",
    email: null,
    message: supabase
      ? "Verificando sua conta para sincronizar os dados."
      : "Sincronizacao online ainda nao esta ativa neste deploy.",
    lastSyncedAt: null
  }));
  const stateRef = useRef(state);
  const userIdRef = useRef<string | null>(null);
  const skipNextCloudSaveRef = useRef(false);
  const lastCloudPayloadRef = useRef("");
  const cloudChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        setState(migrateFinanceState(parsed));
      } catch {
        setState(createEmptyFinanceState());
      }
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    persistFinanceStateLocally(state);
  }, [isHydrated, state]);

  const saveStateToCloud = useCallback(
    async (nextState: FinanceState) => {
      if (!supabase || !userIdRef.current) {
        return;
      }

      const cloudState = prepareFinanceStateForCloud(nextState);
      const payload = JSON.stringify(cloudState);

      if (payload === lastCloudPayloadRef.current) {
        return;
      }

      const { error } = await supabase.from(CLOUD_TABLE).upsert(
        {
          workspace_id: CLOUD_WORKSPACE_ID,
          state: cloudState,
          updated_by: userIdRef.current,
          updated_at: cloudState.updatedAt
        },
        { onConflict: "workspace_id" }
      );

      if (error) {
        throw new Error(formatCloudError(error));
      }

      lastCloudPayloadRef.current = payload;
      setCloud((current) => ({
        ...current,
        status: "online",
        message: "Dados sincronizados online.",
        lastSyncedAt: new Date().toISOString()
      }));
    },
    [supabase]
  );

  const applyRemoteState = useCallback((remoteValue: unknown) => {
    const remoteState = migrateFinanceState(remoteValue);
    const remotePayload = JSON.stringify(prepareFinanceStateForCloud(remoteState));

    if (remotePayload === lastCloudPayloadRef.current) {
      return;
    }

    const localState = stateRef.current;
    const localTime = getTime(localState.updatedAt);
    const remoteTime = getTime(remoteState.updatedAt);
    const nextState = localTime > remoteTime ? mergeFinanceStates(remoteState, localState) : remoteState;

    skipNextCloudSaveRef.current = true;
    lastCloudPayloadRef.current = remotePayload;
    setState(nextState);
    persistFinanceStateLocally(nextState);
    setCloud((current) => ({
      ...current,
      status: "online",
      message: "Dados atualizados pela conta compartilhada.",
      lastSyncedAt: new Date().toISOString()
    }));
  }, []);

  const closeCloudChannel = useCallback(() => {
    if (!supabase || !cloudChannelRef.current) {
      return;
    }

    void supabase.removeChannel(cloudChannelRef.current);
    cloudChannelRef.current = null;
  }, [supabase]);

  const subscribeToWorkspaceChanges = useCallback(() => {
    if (!supabase || cloudChannelRef.current) {
      return;
    }

    cloudChannelRef.current = supabase
      .channel(`finance-workspace-${CLOUD_WORKSPACE_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: CLOUD_TABLE,
          filter: `workspace_id=eq.${CLOUD_WORKSPACE_ID}`
        },
        (payload) => {
          if (payload.eventType === "DELETE" || !("state" in payload.new)) {
            return;
          }

          applyRemoteState(payload.new.state);
        }
      )
      .subscribe();
  }, [applyRemoteState, supabase]);

  const lockSession = useCallback(
    async (message = "Sessao bloqueada por seguranca. Digite a senha para continuar.") => {
      if (!supabase) {
        return;
      }

      markSessionLocked();
      closeCloudChannel();
      await supabase.auth.signOut();
      userIdRef.current = null;
      setCloudReady(false);
      setCloud((current) => ({
        ...current,
        status: "signed_out",
        email: null,
        message
      }));
    },
    [closeCloudChannel, supabase]
  );

  const loadCloudForUser = useCallback(
    async (userId: string, email: string | null) => {
      if (!supabase) {
        return;
      }

      userIdRef.current = userId;
      setCloudReady(false);
      setCloud((current) => ({
        ...current,
        status: "loading",
        email,
        message: "Carregando dados salvos online."
      }));

      try {
        const { data, error } = await supabase
          .from(CLOUD_TABLE)
          .select("state, updated_at")
          .eq("workspace_id", CLOUD_WORKSPACE_ID)
          .maybeSingle();

        if (error) {
          throw new Error(formatCloudError(error));
        }

        const localState = stateRef.current;
        const localHasData = hasFinanceContent(localState);
        const cloudRow = data as FinanceCloudRow | null;
        let nextState = localState;
        let shouldSaveCloud = false;

        if (cloudRow?.state) {
          const remoteState = migrateFinanceState(cloudRow.state);
          nextState = localHasData ? mergeFinanceStates(remoteState, localState) : remoteState;
          shouldSaveCloud = localHasData && hasDifferentCloudPayload(nextState, remoteState);
        } else {
          shouldSaveCloud = true;
        }

        skipNextCloudSaveRef.current = true;
        setState(nextState);
        persistFinanceStateLocally(nextState);
        lastCloudPayloadRef.current = shouldSaveCloud ? "" : JSON.stringify(prepareFinanceStateForCloud(nextState));

        setCloudReady(true);
        setCloud((current) => ({
          ...current,
          status: shouldSaveCloud ? "syncing" : "online",
          email,
          message: shouldSaveCloud
            ? "Enviando dados deste aparelho para a conta compartilhada."
            : "Dados carregados da conta compartilhada.",
          lastSyncedAt: shouldSaveCloud ? current.lastSyncedAt : new Date().toISOString()
        }));

        subscribeToWorkspaceChanges();

        if (shouldSaveCloud) {
          await saveStateToCloud(nextState);
        }
      } catch (error) {
        setCloudReady(false);
        setCloud((current) => ({
          ...current,
          status: "error",
          email,
          message: error instanceof Error ? error.message : "Nao consegui sincronizar seus dados agora."
        }));
      }
    },
    [saveStateToCloud, subscribeToWorkspaceChanges, supabase]
  );

  useEffect(() => {
    if (!supabase || !isHydrated) {
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function boot() {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;

      if (!isMounted) {
        return;
      }

      if (user) {
        if (shouldAskPasswordAgain()) {
          await client.auth.signOut();
          markSessionLocked();
          userIdRef.current = null;
          setCloudReady(false);
          setCloud((current) => ({
            ...current,
            status: "signed_out",
            email: null,
            message: "Sessao bloqueada por seguranca. Digite a senha para continuar."
          }));
          return;
        }

        recordSessionActivity();
        await loadCloudForUser(user.id, user.email ?? null);
        return;
      }

      userIdRef.current = null;
      setCloudReady(false);
      setCloud((current) => ({
        ...current,
        status: "signed_out",
        email: null,
        message: "Entre na sua conta para ver os mesmos dados no celular e no computador."
      }));
    }

    void boot();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (user) {
        void loadCloudForUser(user.id, user.email ?? null);
        return;
      }

      userIdRef.current = null;
      setCloudReady(false);
      setCloud((current) => ({
        ...current,
        status: "signed_out",
        email: null,
        message: "Sessao encerrada. Seus dados continuam neste aparelho."
      }));
    });

    return () => {
      isMounted = false;
      closeCloudChannel();
      subscription.unsubscribe();
    };
  }, [closeCloudChannel, isHydrated, loadCloudForUser, supabase]);

  useEffect(() => {
    if (!supabase || !isHydrated) {
      return;
    }

    const activityEvents: Array<keyof WindowEventMap> = ["keydown", "pointerdown", "scroll", "touchstart"];

    function handleActivity() {
      if (userIdRef.current) {
        recordSessionActivity();
      }
    }

    function handlePageHide() {
      if (userIdRef.current) {
        markSessionLocked();
      }
    }

    const interval = window.setInterval(() => {
      if (!userIdRef.current) {
        return;
      }

      const lastActivity = getLastSessionActivity();

      if (Date.now() - lastActivity >= SESSION_IDLE_MS) {
        void lockSession();
      }
    }, 30_000);

    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isHydrated, lockSession, supabase]);

  useEffect(() => {
    if (!supabase || !isHydrated || !cloudReady || !userIdRef.current) {
      return;
    }

    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setCloud((current) => ({
        ...current,
        status: "syncing",
        message: "Salvando alteracoes online."
      }));

      void saveStateToCloud(stateRef.current).catch((error) => {
        setCloud((current) => ({
          ...current,
          status: "error",
          message: error instanceof Error ? error.message : "Nao consegui salvar online agora."
        }));
      });
    }, CLOUD_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [cloudReady, isHydrated, saveStateToCloud, state, supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error("Sincronizacao online ainda nao esta ativa neste deploy.");
      }

      setCloud((current) => ({
        ...current,
        status: "loading",
        message: "Entrando na sua conta."
      }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        const message = formatAuthError(error);
        setCloud((current) => ({ ...current, status: "error", message }));
        throw new Error(message);
      }

      if (data.user) {
        clearSessionLocked();
        recordSessionActivity();
        await loadCloudForUser(data.user.id, data.user.email ?? null);
      }
    },
    [loadCloudForUser, supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error("Sincronizacao online ainda nao esta ativa neste deploy.");
      }

      setCloud((current) => ({
        ...current,
        status: "loading",
        message: "Criando sua conta."
      }));

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });

      if (error) {
        const message = formatAuthError(error);
        setCloud((current) => ({ ...current, status: "error", message }));
        throw new Error(message);
      }

      if (data.session?.user) {
        clearSessionLocked();
        recordSessionActivity();
        await loadCloudForUser(data.session.user.id, data.session.user.email ?? null);
        return;
      }

      setCloud((current) => ({
        ...current,
        status: "signed_out",
        email: null,
        message: "Conta criada. Confirme o e-mail e depois entre para sincronizar."
      }));
    },
    [loadCloudForUser, supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    markSessionLocked();
    closeCloudChannel();
    userIdRef.current = null;
    setCloudReady(false);
    setCloud((current) => ({
      ...current,
      status: "signed_out",
      email: null,
      message: "Voce saiu da conta. Os dados deste aparelho continuam disponiveis."
    }));
  }, [closeCloudChannel, supabase]);

  const syncNow = useCallback(async () => {
    if (!supabase || !userIdRef.current) {
      throw new Error("Entre na sua conta para sincronizar.");
    }

    setCloud((current) => ({
      ...current,
      status: "syncing",
      message: "Sincronizando agora."
    }));

    await saveStateToCloud({
      ...stateRef.current,
      updatedAt: new Date().toISOString()
    });
  }, [saveStateToCloud, supabase]);

  const actions = useMemo(
    () => ({
      addTransaction(transaction: Omit<Transaction, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          transactions: [
            {
              ...transaction,
              id: `txn_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.transactions
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      addTransactions(transactions: Array<Omit<Transaction, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          transactions: [
            ...transactions.map((transaction) => ({
              ...transaction,
              id: `txn_${crypto.randomUUID()}`,
              createdAt: now
            })),
            ...current.transactions
          ],
          updatedAt: now
        }));
      },
      removeTransaction(id: string) {
        setState((current) => ({
          ...current,
          transactions: current.transactions.filter((transaction) => transaction.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addGoal(goal: Omit<Goal, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          goals: [
            {
              ...goal,
              id: `goal_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.goals
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      updateGoalAmount(id: string, currentAmount: number) {
        setState((current) => ({
          ...current,
          goals: current.goals.map((goal) => (goal.id === id ? { ...goal, currentAmount } : goal)),
          updatedAt: new Date().toISOString()
        }));
      },
      removeGoal(id: string) {
        setState((current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addBudget(budget: Omit<Budget, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          budgets: [
            {
              ...budget,
              id: `budget_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.budgets.filter(
              (item) => !(item.month === budget.month && item.category === budget.category)
            )
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      removeBudget(id: string) {
        setState((current) => ({
          ...current,
          budgets: current.budgets.filter((budget) => budget.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      addBill(bill: Omit<PayableBill, "id" | "createdAt">) {
        setState((current) => ({
          ...current,
          bills: [
            {
              ...bill,
              id: `bill_${crypto.randomUUID()}`,
              createdAt: new Date().toISOString()
            },
            ...current.bills
          ],
          updatedAt: new Date().toISOString()
        }));
      },
      addBills(bills: Array<Omit<PayableBill, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          bills: [
            ...bills.map((bill) => ({
              ...bill,
              id: `bill_${crypto.randomUUID()}`,
              createdAt: now
            })),
            ...current.bills
          ],
          updatedAt: now
        }));
      },
      updateBill(id: string, bill: Partial<Omit<PayableBill, "id" | "createdAt">>) {
        setState((current) => ({
          ...current,
          bills: current.bills.map((item) => (item.id === id ? { ...item, ...bill } : item)),
          updatedAt: new Date().toISOString()
        }));
      },
      markBillPaid(id: string) {
        setState((current) => ({
          ...current,
          bills: current.bills.map((bill) =>
            bill.id === id
              ? {
                  ...bill,
                  status: "paid",
                  paidAt: new Date().toISOString()
                }
              : bill
          ),
          updatedAt: new Date().toISOString()
        }));
      },
      removeBill(id: string) {
        setState((current) => ({
          ...current,
          bills: current.bills.filter((bill) => bill.id !== id),
          updatedAt: new Date().toISOString()
        }));
      },
      importTransactions(transactions: Transaction[]) {
        setState((current) => ({
          ...current,
          transactions: [...transactions, ...current.transactions],
          updatedAt: new Date().toISOString()
        }));
      },
      reset() {
        const nextState = createEmptyFinanceState();
        setState(nextState);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }
    }),
    []
  );

  const visibleState = supabase && !userIdRef.current ? createEmptyFinanceState() : state;

  return {
    state: visibleState,
    isHydrated,
    actions,
    cloud: {
      ...cloud,
      signIn,
      signUp,
      signOut,
      syncNow
    }
  };
}

export type FinanceCloudSync = ReturnType<typeof useFinanceStore>["cloud"];

function persistFinanceStateLocally(state: FinanceState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function prepareFinanceStateForCloud(state: FinanceState): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) => ({
      ...transaction,
      attachmentDataUrl: undefined
    })),
    bills: state.bills.map((bill) => ({
      ...bill,
      attachmentDataUrl: undefined
    }))
  };
}

function hasFinanceContent(state: FinanceState) {
  return (
    state.transactions.length > 0 ||
    state.goals.length > 0 ||
    state.budgets.length > 0 ||
    state.bills.length > 0
  );
}

function hasDifferentCloudPayload(left: FinanceState, right: FinanceState) {
  return JSON.stringify(prepareFinanceStateForCloud(left)) !== JSON.stringify(prepareFinanceStateForCloud(right));
}

function mergeFinanceStates(cloudState: FinanceState, localState: FinanceState): FinanceState {
  const cloudTime = getTime(cloudState.updatedAt);
  const localTime = getTime(localState.updatedAt);

  return {
    schemaVersion: 3,
    profile: localTime >= cloudTime ? localState.profile : cloudState.profile,
    transactions: mergeById(cloudState.transactions, localState.transactions).sort(sortByCreatedAtDesc),
    goals: mergeById(cloudState.goals, localState.goals).sort(sortByCreatedAtDesc),
    budgets: mergeById(cloudState.budgets, localState.budgets).sort(sortByCreatedAtDesc),
    bills: mergeById(cloudState.bills, localState.bills).sort(sortByCreatedAtDesc),
    updatedAt: new Date(Math.max(cloudTime, localTime, Date.now())).toISOString()
  };
}

function mergeById<T extends { id: string; attachmentDataUrl?: string }>(base: T[], incoming: T[]) {
  const merged = new Map<string, T>();

  base.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? preserveAttachmentDataUrl(existing, item) : item);
  });

  return Array.from(merged.values());
}

function preserveAttachmentDataUrl<T extends { attachmentDataUrl?: string }>(base: T, incoming: T): T {
  return {
    ...base,
    ...incoming,
    attachmentDataUrl: incoming.attachmentDataUrl || base.attachmentDataUrl
  };
}

function sortByCreatedAtDesc(left: { createdAt: string }, right: { createdAt: string }) {
  return right.createdAt.localeCompare(left.createdAt);
}

function getTime(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function getSessionIdleMilliseconds() {
  const configuredMinutes = Number(process.env.NEXT_PUBLIC_MAYA_SESSION_IDLE_MINUTES);
  const minutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_SESSION_IDLE_MINUTES;

  return minutes * 60 * 1000;
}

function recordSessionActivity() {
  window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

function getLastSessionActivity() {
  const stored = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
}

function markSessionLocked() {
  window.localStorage.setItem(SESSION_LOCK_KEY, "true");
}

function clearSessionLocked() {
  window.localStorage.removeItem(SESSION_LOCK_KEY);
}

function shouldAskPasswordAgain() {
  if (window.localStorage.getItem(SESSION_LOCK_KEY) === "true") {
    return true;
  }

  return Date.now() - getLastSessionActivity() >= SESSION_IDLE_MS;
}

function formatCloudError(error: { message?: string; code?: string }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  if (
    text.includes("finance_states") ||
    text.includes("finance_workspace") ||
    text.includes("relation") ||
    text.includes("schema cache")
  ) {
    return "Sincronizacao online precisa ser ativada no banco antes de usar.";
  }

  if (text.includes("permission") || text.includes("policy") || text.includes("rls")) {
    return "Sua conta nao tem permissao para sincronizar estes dados.";
  }

  return "Nao consegui sincronizar seus dados agora.";
}

function formatAuthError(error: { message?: string }) {
  const text = (error.message ?? "").toLowerCase();

  if (text.includes("invalid login") || text.includes("credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (text.includes("password")) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }

  if (text.includes("already")) {
    return "Essa conta ja existe. Use Entrar.";
  }

  return "Nao consegui acessar sua conta agora.";
}
