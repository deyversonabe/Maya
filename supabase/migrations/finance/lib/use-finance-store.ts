"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_FINANCE_ACCOUNT_ID, createEmptyFinanceState } from "../data/defaults";
import { migrateFinanceState } from "./migrations";
import type {
  Budget,
  FinanceActivityEntity,
  FinanceActivityLog,
  FinanceAccount,
  FinanceState,
  Goal,
  GoalContribution,
  LaborBenefit,
  PayableBill,
  PayrollRecord,
  TaxDocument,
  Transaction,
  WorkTimeEntry
} from "../types";

const STORAGE_KEY = "maya.finance.v1";
const LEGACY_STORAGE_KEY = ["jun", "tos.finance.v1"].join("");
const CLOUD_TABLE = "finance_workspace_states";
const CLOUD_WORKSPACE_ID =
  process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";
const CLOUD_SYNC_DELAY_MS = 150;
const SESSION_LOCK_KEY = "maya.finance.session_locked.v1";
const SESSION_LAST_ACTIVITY_KEY = "maya.finance.last_activity.v1";
const BEFORE_SIGN_OUT_EVENT = "maya:before-sign-out";
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

interface SafeWorkspaceStateSaveRow {
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
  const userEmailRef = useRef<string | null>(null);
  const skipNextCloudSaveRef = useRef(false);
  const lastCloudPayloadRef = useRef("");
  const cloudChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        const migrated = migrateFinanceState(parsed);
        setState(migrated);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
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

      let { data, error } = await supabase
        .rpc("save_finance_workspace_state_locked", {
          p_workspace_id: CLOUD_WORKSPACE_ID,
          p_state: cloudState
        })
        .maybeSingle();

      if (error && isMissingWorkspaceLockRpcError(error)) {
        const fallbackResult = await supabase
          .from(CLOUD_TABLE)
          .upsert(
            {
              workspace_id: CLOUD_WORKSPACE_ID,
              state: cloudState,
              updated_by: userIdRef.current
            },
            { onConflict: "workspace_id" }
          )
          .select("state, updated_at")
          .maybeSingle();

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        throw new Error(formatCloudError(error));
      }

      const savedRow = data as SafeWorkspaceStateSaveRow | null;
      const savedState = savedRow?.state ? migrateFinanceState(savedRow.state) : cloudState;
      const savedPayload = JSON.stringify(prepareFinanceStateForCloud(savedState));

      lastCloudPayloadRef.current = savedPayload || payload;

      if (savedPayload && savedPayload !== payload) {
        skipNextCloudSaveRef.current = true;
        setState(savedState);
        persistFinanceStateLocally(savedState);
      }

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
    const shouldResaveMergedState =
      localTime > remoteTime && hasDifferentCloudPayload(nextState, remoteState);

    skipNextCloudSaveRef.current = !shouldResaveMergedState;
    lastCloudPayloadRef.current = remotePayload;
    setState(nextState);
    persistFinanceStateLocally(nextState);
    setCloud((current) => ({
      ...current,
      status: shouldResaveMergedState ? "syncing" : "online",
      message: shouldResaveMergedState
        ? "Mesclando alteracoes deste aparelho com a conta compartilhada."
        : "Dados atualizados pela conta compartilhada.",
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
      userEmailRef.current = null;
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
      userEmailRef.current = email;
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
          userEmailRef.current = null;
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
      userEmailRef.current = null;
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
      userEmailRef.current = null;
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

  useEffect(() => {
    if (!supabase) {
      return;
    }

    function handleBeforeSignOut(event: Event) {
      if (!userIdRef.current) {
        return;
      }

      const customEvent = event as CustomEvent<{ waitUntil?: (promise: Promise<unknown>) => void }>;
      customEvent.detail?.waitUntil?.(
        saveStateToCloud({
          ...stateRef.current,
          updatedAt: new Date().toISOString()
        }).catch((error) => {
          setCloud((current) => ({
            ...current,
            status: "error",
            message: error instanceof Error ? error.message : "Nao consegui salvar online antes de sair."
          }));
        })
      );
    }

    window.addEventListener(BEFORE_SIGN_OUT_EVENT, handleBeforeSignOut);

    return () => window.removeEventListener(BEFORE_SIGN_OUT_EVENT, handleBeforeSignOut);
  }, [saveStateToCloud, supabase]);

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
    async () => {
      const message = "Cadastro publico desativado. O administrador precisa criar e autorizar este usuario.";
      setCloud((current) => ({
        ...current,
        status: "signed_out",
        message
      }));
      throw new Error(message);
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    if (userIdRef.current) {
      await saveStateToCloud({
        ...stateRef.current,
        updatedAt: new Date().toISOString()
      });
    }

    await supabase.auth.signOut();
    markSessionLocked();
    closeCloudChannel();
    userIdRef.current = null;
    userEmailRef.current = null;
    setCloudReady(false);
    setCloud((current) => ({
      ...current,
      status: "signed_out",
      email: null,
      message: "Voce saiu da conta. Os dados deste aparelho continuam disponiveis."
    }));
  }, [closeCloudChannel, saveStateToCloud, supabase]);

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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Lancou transacao",
            entityType: "transaction",
            entityLabel: transaction.description,
            details: `${transaction.date} - ${transaction.type}`
          }),
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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Importou transacoes",
            entityType: "transaction",
            entityLabel: `${transactions.length} lancamento(s)`,
            details: transactions[0]?.source ?? "lote"
          }),
          updatedAt: now
        }));
      },
      updateTransaction(id: string, patch: Partial<Omit<Transaction, "id" | "createdAt">>) {
        setState((current) => {
          const existing = current.transactions.find((transaction) => transaction.id === id);

          return {
            ...current,
            transactions: current.transactions.map((transaction) =>
              transaction.id === id ? { ...transaction, ...patch } : transaction
            ),
            activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
              action: "Editou transacao",
              entityType: "transaction",
              entityLabel: existing?.description ?? patch.description ?? id,
              details: `${patch.date ?? existing?.date ?? ""} - ${patch.type ?? existing?.type ?? ""}`
            }),
            updatedAt: new Date().toISOString()
          };
        });
      },
      removeTransaction(id: string) {
        setState((current) => ({
          ...current,
          transactions: current.transactions.filter((transaction) => transaction.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu transacao",
            entityType: "transaction",
            entityLabel: current.transactions.find((transaction) => transaction.id === id)?.description ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      addAccount(account: Omit<FinanceAccount, "id" | "createdAt">) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          accounts: [
            {
              ...account,
              id: `account_${crypto.randomUUID()}`,
              createdAt: now
            },
            ...current.accounts
          ],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Criou carteira",
            entityType: "account",
            entityLabel: account.name
          }),
          updatedAt: now
        }));
      },
      updateAccount(id: string, account: Partial<Omit<FinanceAccount, "id" | "createdAt">>) {
        setState((current) => ({
          ...current,
          accounts: current.accounts.map((item) => (item.id === id ? { ...item, ...account } : item)),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Atualizou carteira",
            entityType: "account",
            entityLabel: current.accounts.find((item) => item.id === id)?.name ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      removeAccount(id: string) {
        if (id === DEFAULT_FINANCE_ACCOUNT_ID) {
          return;
        }

        setState((current) => ({
          ...current,
          accounts: current.accounts.filter((account) => account.id !== id),
          transactions: current.transactions.map((transaction) =>
            transaction.accountId === id ? { ...transaction, accountId: DEFAULT_FINANCE_ACCOUNT_ID } : transaction
          ),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu carteira",
            entityType: "account",
            entityLabel: current.accounts.find((account) => account.id === id)?.name ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      addGoal(goal: Omit<Goal, "id" | "createdAt" | "contributions"> & { contributions?: GoalContribution[] }) {
        const now = new Date().toISOString();
        const initialContribution =
          goal.currentAmount > 0
            ? [
                {
                  id: `goal_entry_${crypto.randomUUID()}`,
                  amount: goal.currentAmount,
                  date: now.slice(0, 10),
                  notes: "Saldo inicial.",
                  createdAt: now
                }
              ]
            : [];

        setState((current) => ({
          ...current,
          goals: [
            {
              ...goal,
              contributions: goal.contributions ?? initialContribution,
              id: `goal_${crypto.randomUUID()}`,
              createdAt: now
            },
            ...current.goals
          ],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Criou meta",
            entityType: "goal",
            entityLabel: goal.name
          }),
          updatedAt: now
        }));
      },
      updateGoalAmount(id: string, currentAmount: number) {
        const now = new Date().toISOString();
        setState((current) => {
          const goalLabel = current.goals.find((goal) => goal.id === id)?.name ?? id;

          return {
            ...current,
            goals: current.goals.map((goal) => {
            if (goal.id !== id) {
              return goal;
            }

            const delta = currentAmount - goal.currentAmount;

            return {
              ...goal,
              currentAmount,
              contributions:
                delta !== 0
                  ? [
                      {
                        id: `goal_entry_${crypto.randomUUID()}`,
                        amount: delta,
                        date: now.slice(0, 10),
                        notes: "Ajuste manual de saldo.",
                        createdAt: now
                      },
                      ...goal.contributions
                    ]
                  : goal.contributions
            };
          }),
            activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
              action: "Atualizou saldo da meta",
              entityType: "goal",
              entityLabel: goalLabel
            }),
            updatedAt: now
          };
        });
      },
      addGoalContribution(id: string, contribution: Omit<GoalContribution, "id" | "createdAt">) {
        const now = new Date().toISOString();
        const entry: GoalContribution = {
          ...contribution,
          id: `goal_entry_${crypto.randomUUID()}`,
          createdAt: now
        };

        setState((current) => ({
          ...current,
          goals: current.goals.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  currentAmount: Math.max(0, goal.currentAmount + entry.amount),
                  contributions: [entry, ...goal.contributions]
                }
              : goal
          ),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Adicionou saldo na meta",
            entityType: "goal",
            entityLabel: current.goals.find((goal) => goal.id === id)?.name ?? id,
            details: contribution.date
          }),
          updatedAt: now
        }));
      },
      removeGoal(id: string) {
        setState((current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu meta",
            entityType: "goal",
            entityLabel: current.goals.find((goal) => goal.id === id)?.name ?? id
          }),
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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Salvou orcamento",
            entityType: "budget",
            entityLabel: `${budget.category} - ${budget.month}`
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      removeBudget(id: string) {
        setState((current) => ({
          ...current,
          budgets: current.budgets.filter((budget) => budget.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu orcamento",
            entityType: "budget",
            entityLabel: current.budgets.find((budget) => budget.id === id)?.category ?? id
          }),
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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Cadastrou conta",
            entityType: "bill",
            entityLabel: bill.title,
            details: bill.dueDate
          }),
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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Cadastrou contas",
            entityType: "bill",
            entityLabel: `${bills.length} conta(s)`,
            details: bills[0]?.title
          }),
          updatedAt: now
        }));
      },
      updateBill(id: string, bill: Partial<Omit<PayableBill, "id" | "createdAt">>) {
        setState((current) => ({
          ...current,
          bills: current.bills.map((item) => (item.id === id ? { ...item, ...bill } : item)),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Atualizou conta",
            entityType: "bill",
            entityLabel: current.bills.find((item) => item.id === id)?.title ?? id
          }),
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
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Marcou conta como paga",
            entityType: "bill",
            entityLabel: current.bills.find((bill) => bill.id === id)?.title ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      removeBill(id: string) {
        setState((current) => ({
          ...current,
          bills: current.bills.filter((bill) => bill.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu conta",
            entityType: "bill",
            entityLabel: current.bills.find((bill) => bill.id === id)?.title ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      addTaxDocument(document: Omit<TaxDocument, "id" | "createdAt" | "updatedAt">) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          taxDocuments: [
            {
              ...document,
              id: `tax_${crypto.randomUUID()}`,
              createdAt: now,
              updatedAt: now
            },
            ...current.taxDocuments
          ],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Registrou documento fiscal",
            entityType: "tax_document",
            entityLabel: document.title,
            details: `${document.year} - ${document.person}`
          }),
          updatedAt: now
        }));
      },
      updateTaxDocument(id: string, patch: Partial<Omit<TaxDocument, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          taxDocuments: current.taxDocuments.map((document) =>
            document.id === id ? { ...document, ...patch, updatedAt: now } : document
          ),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Atualizou documento fiscal",
            entityType: "tax_document",
            entityLabel: current.taxDocuments.find((document) => document.id === id)?.title ?? id
          }),
          updatedAt: now
        }));
      },
      removeTaxDocument(id: string) {
        setState((current) => ({
          ...current,
          taxDocuments: current.taxDocuments.filter((document) => document.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu documento fiscal",
            entityType: "tax_document",
            entityLabel: current.taxDocuments.find((document) => document.id === id)?.title ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      addLaborBenefit(benefit: Omit<LaborBenefit, "id" | "createdAt" | "updatedAt">) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          laborBenefits: [
            {
              ...benefit,
              id: `labor_${crypto.randomUUID()}`,
              createdAt: now,
              updatedAt: now
            },
            ...current.laborBenefits
          ],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Registrou dado trabalhista",
            entityType: "labor_benefit",
            entityLabel: benefit.employer ?? benefit.type,
            details: `${benefit.referenceMonth} - ${benefit.person}`
          }),
          updatedAt: now
        }));
      },
      updateLaborBenefit(id: string, patch: Partial<Omit<LaborBenefit, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          laborBenefits: current.laborBenefits.map((benefit) =>
            benefit.id === id ? { ...benefit, ...patch, updatedAt: now } : benefit
          ),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Atualizou dado trabalhista",
            entityType: "labor_benefit",
            entityLabel: current.laborBenefits.find((benefit) => benefit.id === id)?.employer ?? id
          }),
          updatedAt: now
        }));
      },
      removeLaborBenefit(id: string) {
        setState((current) => ({
          ...current,
          laborBenefits: current.laborBenefits.filter((benefit) => benefit.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu dado trabalhista",
            entityType: "labor_benefit",
            entityLabel: current.laborBenefits.find((benefit) => benefit.id === id)?.employer ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      addPayrollRecord(record: Omit<PayrollRecord, "id" | "createdAt" | "updatedAt">) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          payrollRecords: [
            {
              ...record,
              id: `payroll_${crypto.randomUUID()}`,
              createdAt: now,
              updatedAt: now
            },
            ...current.payrollRecords
          ],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Registrou holerite",
            entityType: "payroll_record",
            entityLabel: `${record.referenceMonth} - ${record.person}`,
            details: record.employer
          }),
          updatedAt: now
        }));
      },
      updatePayrollRecord(id: string, patch: Partial<Omit<PayrollRecord, "id" | "createdAt">>) {
        const now = new Date().toISOString();
        setState((current) => ({
          ...current,
          payrollRecords: current.payrollRecords.map((record) =>
            record.id === id ? { ...record, ...patch, updatedAt: now } : record
          ),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Atualizou holerite",
            entityType: "payroll_record",
            entityLabel: current.payrollRecords.find((record) => record.id === id)?.referenceMonth ?? id
          }),
          updatedAt: now
        }));
      },
      removePayrollRecord(id: string) {
        setState((current) => ({
          ...current,
          payrollRecords: current.payrollRecords.filter((record) => record.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu holerite",
            entityType: "payroll_record",
            entityLabel: current.payrollRecords.find((record) => record.id === id)?.referenceMonth ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      upsertWorkTimeEntry(entry: Omit<WorkTimeEntry, "id" | "createdAt" | "updatedAt">) {
        const now = new Date().toISOString();
        setState((current) => {
          const existing = current.workTimeEntries.find(
            (item) => item.date === entry.date && item.person === entry.person
          );

          return {
            ...current,
            workTimeEntries: existing
              ? current.workTimeEntries.map((item) =>
                  item.id === existing.id ? { ...item, ...entry, updatedAt: now } : item
                )
              : [
                  {
                    ...entry,
                    id: `work_${crypto.randomUUID()}`,
                    createdAt: now,
                    updatedAt: now
                  },
                  ...current.workTimeEntries
                ],
            activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
              action: existing ? "Atualizou ponto" : "Registrou ponto",
              entityType: "work_time_entry",
              entityLabel: `${entry.date} - ${entry.person}`
            }),
            updatedAt: now
          };
        });
      },
      removeWorkTimeEntry(id: string) {
        setState((current) => ({
          ...current,
          workTimeEntries: current.workTimeEntries.filter((entry) => entry.id !== id),
          deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, id),
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Removeu ponto",
            entityType: "work_time_entry",
            entityLabel: current.workTimeEntries.find((entry) => entry.id === id)?.date ?? id
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      importTransactions(transactions: Transaction[]) {
        setState((current) => ({
          ...current,
          transactions: [...transactions, ...current.transactions],
          activityLogs: addFinanceActivity(current.activityLogs, userEmailRef.current, {
            action: "Importou CSV",
            entityType: "transaction",
            entityLabel: `${transactions.length} transacao(oes)`
          }),
          updatedAt: new Date().toISOString()
        }));
      },
      reset() {
        setState((current) => {
          const nextState = {
            ...createEmptyFinanceState(),
            deletedEntityIds: addDeletedEntityIds(current.deletedEntityIds, ...collectStateEntityIds(current)),
            updatedAt: new Date().toISOString()
          };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
          return nextState;
        });
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

function addFinanceActivity(
  logs: FinanceActivityLog[],
  actorEmail: string | null,
  entry: {
    action: string;
    entityType: FinanceActivityEntity;
    entityLabel: string;
    details?: string;
  }
) {
  return [
    {
      id: `activity_${crypto.randomUUID()}`,
      actorEmail: actorEmail || "usuario autorizado",
      action: entry.action,
      entityType: entry.entityType,
      entityLabel: entry.entityLabel,
      details: entry.details,
      createdAt: new Date().toISOString()
    },
    ...logs
  ].slice(0, 200);
}

function persistFinanceStateLocally(state: FinanceState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function prepareFinanceStateForCloud(state: FinanceState): FinanceState {
  return state;
}

function hasFinanceContent(state: FinanceState) {
  return (
    state.transactions.length > 0 ||
    state.goals.length > 0 ||
    state.budgets.length > 0 ||
    state.bills.length > 0 ||
    state.taxDocuments.length > 0 ||
    state.laborBenefits.length > 0 ||
    state.payrollRecords.length > 0 ||
    state.workTimeEntries.length > 0 ||
    state.accounts.some((account) => account.id !== DEFAULT_FINANCE_ACCOUNT_ID || account.openingBalance !== 0)
  );
}

function hasDifferentCloudPayload(left: FinanceState, right: FinanceState) {
  return JSON.stringify(prepareFinanceStateForCloud(left)) !== JSON.stringify(prepareFinanceStateForCloud(right));
}

function mergeFinanceStates(cloudState: FinanceState, localState: FinanceState): FinanceState {
  const cloudTime = getTime(cloudState.updatedAt);
  const localTime = getTime(localState.updatedAt);
  const deletedEntityIds = addDeletedEntityIds(cloudState.deletedEntityIds, ...localState.deletedEntityIds);
  const deletedEntityIdSet = new Set(deletedEntityIds);

  return {
    schemaVersion: 6,
    profile: localTime >= cloudTime ? localState.profile : cloudState.profile,
    accounts: ensureDefaultAccount(filterDeletedItems(mergeById(cloudState.accounts, localState.accounts), deletedEntityIdSet)).sort(sortByCreatedAtDesc),
    transactions: filterDeletedItems(mergeById(cloudState.transactions, localState.transactions), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    goals: filterDeletedItems(mergeById(cloudState.goals, localState.goals), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    budgets: filterDeletedItems(mergeById(cloudState.budgets, localState.budgets), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    bills: filterDeletedItems(mergeById(cloudState.bills, localState.bills), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    taxDocuments: filterDeletedItems(mergeById(cloudState.taxDocuments, localState.taxDocuments), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    laborBenefits: filterDeletedItems(mergeById(cloudState.laborBenefits, localState.laborBenefits), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    payrollRecords: filterDeletedItems(mergeById(cloudState.payrollRecords, localState.payrollRecords), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    workTimeEntries: filterDeletedItems(mergeById(cloudState.workTimeEntries, localState.workTimeEntries), deletedEntityIdSet).sort(sortByCreatedAtDesc),
    activityLogs: filterDeletedItems(mergeById(cloudState.activityLogs, localState.activityLogs), deletedEntityIdSet)
      .sort(sortByCreatedAtDesc)
      .slice(0, 200),
    deletedEntityIds,
    updatedAt: new Date(Math.max(cloudTime, localTime, Date.now())).toISOString()
  };
}

function addDeletedEntityIds(current: string[], ...ids: string[]) {
  const safeIds = ids.filter((id) => id && id !== DEFAULT_FINANCE_ACCOUNT_ID);
  return Array.from(new Set([...current, ...safeIds])).slice(-1000);
}

function collectStateEntityIds(state: FinanceState) {
  return [
    ...state.accounts.filter((account) => account.id !== DEFAULT_FINANCE_ACCOUNT_ID).map((account) => account.id),
    ...state.transactions.map((transaction) => transaction.id),
    ...state.goals.map((goal) => goal.id),
    ...state.budgets.map((budget) => budget.id),
    ...state.bills.map((bill) => bill.id),
    ...state.taxDocuments.map((document) => document.id),
    ...state.laborBenefits.map((benefit) => benefit.id),
    ...state.payrollRecords.map((record) => record.id),
    ...state.workTimeEntries.map((entry) => entry.id)
  ];
}

type MergeableFinanceItem = {
  id: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentImageName?: string;
  receiptImageName?: string;
  documentItems?: unknown[];
  fiscalDocument?: unknown;
};

function mergeById<T extends MergeableFinanceItem>(base: T[], incoming: T[]) {
  const merged = new Map<string, T>();

  base.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? preserveDocumentFields(existing, item) : item);
  });

  return Array.from(merged.values());
}

function filterDeletedItems<T extends { id: string }>(items: T[], deletedEntityIds: Set<string>) {
  return items.filter((item) => !deletedEntityIds.has(item.id));
}

function ensureDefaultAccount(accounts: FinanceAccount[]) {
  return accounts.some((account) => account.id === DEFAULT_FINANCE_ACCOUNT_ID)
    ? accounts
    : [createEmptyFinanceState().accounts[0], ...accounts];
}

function preserveDocumentFields<T extends MergeableFinanceItem>(base: T, incoming: T): T {
  return {
    ...base,
    ...incoming,
    attachmentDataUrl: incoming.attachmentDataUrl || base.attachmentDataUrl,
    attachmentStoragePath: incoming.attachmentStoragePath || base.attachmentStoragePath,
    attachmentMimeType: incoming.attachmentMimeType || base.attachmentMimeType,
    attachmentSize: incoming.attachmentSize || base.attachmentSize,
    attachmentImageName: incoming.attachmentImageName || base.attachmentImageName,
    receiptImageName: incoming.receiptImageName || base.receiptImageName,
    documentItems: incoming.documentItems?.length ? incoming.documentItems : base.documentItems,
    fiscalDocument: incoming.fiscalDocument || base.fiscalDocument
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
    text.includes("save_finance_workspace_state_locked") ||
    text.includes("function") ||
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

function isMissingWorkspaceLockRpcError(error: { message?: string; code?: string }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  return text.includes("save_finance_workspace_state_locked") || text.includes("schema cache");
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
