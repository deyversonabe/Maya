"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, KeyRound, LockKeyhole, LogIn } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type GateStatus = "loading" | "signed_out" | "signed_in" | "unconfigured";
type AuthMode = "login" | "reset_request" | "update_password";

const PUBLIC_PATHS = ["/privacy", "/terms", "/data-deletion"];
const WORKSPACE_ID = process.env.NEXT_PUBLIC_MAYA_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";
const SESSION_LOCK_KEY = "maya.finance.session_locked.v1";
const SESSION_LAST_ACTIVITY_KEY = "maya.finance.last_activity.v1";
const SESSION_LAST_EMAIL_KEY = "maya.finance.last_email.v1";
const DEFAULT_SESSION_IDLE_MINUTES = 15;
const SESSION_IDLE_MS = getSessionIdleMilliseconds();

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [status, setStatus] = useState<GateStatus>(() => {
    if (isPublicPath) {
      return "signed_in";
    }

    return supabase ? "loading" : "unconfigured";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState("Entre com sua conta autorizada para acessar a MAYA.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEmail(window.localStorage.getItem(SESSION_LAST_EMAIL_KEY) ?? "");
    }
  }, []);

  useEffect(() => {
    if (isPublicPath) {
      setStatus("signed_in");
      return;
    }

    if (!supabase) {
      setStatus("unconfigured");
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function boot() {
      const isRecovery = await preparePasswordRecoverySession(client);

      if (!isMounted) {
        return;
      }

      if (isRecovery) {
        clearSessionLocked();
        recordSessionActivity();
        setAuthMode("update_password");
        setStatus("signed_out");
        setMessage("Defina uma nova senha para concluir a recuperacao do acesso.");
        return;
      }

      const result = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      await validateSession(result.data.session);
    }

    void boot();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || isPasswordRecoveryUrl()) {
        clearSessionLocked();
        recordSessionActivity();
        setAuthMode("update_password");
        setStatus("signed_out");
        setMessage("Defina uma nova senha para concluir a recuperacao do acesso.");
        return;
      }

      void validateSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isPublicPath, supabase]);

  useEffect(() => {
    if (!supabase || isPublicPath || status !== "signed_in") {
      return;
    }

    const activityEvents: Array<keyof WindowEventMap> = ["keydown", "pointerdown", "scroll", "touchstart"];

    function handleActivity() {
      recordSessionActivity();
    }

    function handlePageHide() {
      markSessionLocked();
    }

    const interval = window.setInterval(() => {
      if (Date.now() - getLastSessionActivity() >= SESSION_IDLE_MS) {
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
  }, [isPublicPath, status, supabase]);

  async function validateSession(session: Session | null) {
    if (!supabase) {
      setStatus("unconfigured");
      return false;
    }

    if (isPasswordRecoveryUrl()) {
      clearSessionLocked();
      recordSessionActivity();
      setAuthMode("update_password");
      setStatus("signed_out");
      setMessage("Defina uma nova senha para concluir a recuperacao do acesso.");
      return false;
    }

    if (!session?.user) {
      setStatus("signed_out");
      setMessage("Digite sua senha para acessar a base financeira compartilhada.");
      return false;
    }

    if (shouldAskPasswordAgain()) {
      await supabase.auth.signOut();
      markSessionLocked();
      setStatus("signed_out");
      setMessage("Sessao bloqueada por seguranca. Digite a senha para continuar.");
      return false;
    }

    let memberResult = await supabase
      .from("finance_workspace_members")
      .select("role,status")
      .eq("workspace_id", WORKSPACE_ID)
      .maybeSingle();

    if (memberResult.error && isMissingStatusColumn(memberResult.error.message)) {
      memberResult = await supabase
        .from("finance_workspace_members")
        .select("role")
        .eq("workspace_id", WORKSPACE_ID)
        .maybeSingle();
    }

    const { data, error } = memberResult;

    if (error || !data) {
      await supabase.auth.signOut();
      markSessionLocked();
      setStatus("signed_out");
      setMessage("Esta conta nao esta autorizada para acessar a base financeira da MAYA.");
      return false;
    }

    if ("status" in data && data.status === "blocked") {
      await supabase.auth.signOut();
      markSessionLocked();
      setStatus("signed_out");
      setMessage("Esta conta foi bloqueada pelo administrador.");
      return false;
    }

    clearSessionLocked();
    recordSessionActivity();
    void supabase.rpc("touch_finance_workspace_member", { target_workspace_id: WORKSPACE_ID }).then(
      () => undefined,
      () => undefined
    );
    window.localStorage.setItem(SESSION_LAST_EMAIL_KEY, session.user.email ?? "");
    setEmail(session.user.email ?? "");
    setStatus("signed_in");
    setMessage("Acesso autorizado.");
    return true;
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setIsSubmitting(true);
    setMessage("Verificando acesso.");

    const result = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (result.error) {
      setMessage("E-mail ou senha incorretos.");
      setIsSubmitting(false);
      return;
    }

    const isAllowed = await validateSession(result.data.session);

    if (isAllowed) {
      setPassword("");
    }

    setIsSubmitting(false);
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("Informe seu e-mail para receber o link de recuperacao.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Enviando link de recuperacao.");

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/?maya_recovery=1` : undefined;

    const result = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });

    if (result.error) {
      setMessage(formatPasswordRecoveryError(result.error.message));
      setIsSubmitting(false);
      return;
    }

    window.localStorage.setItem(SESSION_LAST_EMAIL_KEY, cleanEmail);
    setMessage("Enviamos um link para seu e-mail. Abra o link e defina a nova senha aqui na Maya.");
    setIsSubmitting(false);
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Use uma nova senha com pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("As senhas digitadas nao conferem.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Atualizando sua senha.");

    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      setIsSubmitting(false);
      setMessage("O link de recuperacao expirou ou ja foi usado. Solicite um novo link.");
      setAuthMode("reset_request");
      cleanPasswordRecoveryUrl();
      return;
    }

    const result = await supabase.auth.updateUser({ password: newPassword });

    if (result.error) {
      setMessage(formatPasswordRecoveryError(result.error.message));
      setIsSubmitting(false);
      return;
    }

    const recoveredEmail = data.session.user.email ?? email;
    await supabase.auth.signOut();
    clearSessionLocked();
    cleanPasswordRecoveryUrl();
    setEmail(recoveredEmail);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowNewPassword(false);
    setAuthMode("login");
    setStatus("signed_out");
    setMessage("Senha alterada com sucesso. Entre com seu e-mail e a nova senha.");
    setIsSubmitting(false);
  }

  async function lockSession() {
    if (!supabase) {
      return;
    }

    markSessionLocked();
    await supabase.auth.signOut();
    setStatus("signed_out");
    setMessage("Sessao bloqueada por seguranca. Digite a senha para continuar.");
  }

  const subtitle = useMemo(() => {
    if (status === "signed_out") {
      return message;
    }

    return "Acesso restrito aos usuarios autorizados.";
  }, [message, status]);

  if (isPublicPath || status === "signed_in") {
    return children;
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm font-bold text-muted">Verificando acesso...</p>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-card border border-amber-300/30 bg-amber-300/10 p-6 text-center">
          <LockKeyhole className="mx-auto mb-3 size-8 text-amber-100" aria-hidden="true" />
          <p className="font-bold text-amber-100">
            Autenticacao obrigatoria ainda nao foi configurada neste deploy. Fale com o administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-card border border-bronze/20 bg-moss-950/85 p-6 shadow-soft backdrop-blur-2xl">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <Image
            src="/brand/maya-logo.png"
            alt="Maya"
            width={220}
            height={140}
            priority
            className="h-24 w-24 rounded-full object-cover drop-shadow-[0_0_18px_rgba(196,106,67,0.35)]"
          />
          <p className="text-sm leading-6 text-muted">{subtitle}</p>
        </div>

        {authMode === "update_password" ? (
          <form className="grid gap-3" onSubmit={handleUpdatePassword}>
            <Label>
              Nova senha
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                placeholder="nova senha"
                isVisible={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((current) => !current)}
              />
            </Label>
            <Label>
              Confirmar nova senha
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="repita a nova senha"
                isVisible={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((current) => !current)}
              />
            </Label>

            <AuthMessage message={message} />

            <Button type="submit" disabled={isSubmitting}>
              <KeyRound className="size-4" aria-hidden="true" />
              {isSubmitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        ) : authMode === "reset_request" ? (
          <form className="grid gap-3" onSubmit={handleResetPassword}>
            <Label>
              E-mail
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
              />
            </Label>

            <AuthMessage message={message} />

            <Button type="submit" disabled={isSubmitting}>
              <KeyRound className="size-4" aria-hidden="true" />
              {isSubmitting ? "Enviando..." : "Enviar link de recuperacao"}
            </Button>
            <button
              type="button"
              className="text-sm font-bold text-cyan-100 underline-offset-4 hover:underline"
              onClick={() => {
                setAuthMode("login");
                setMessage("Digite sua senha para acessar a base financeira compartilhada.");
              }}
            >
              Voltar para entrar
            </button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={handleLogin}>
            <Label>
              E-mail
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
              />
            </Label>
            <Label>
              Senha
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="sua senha"
                isVisible={showPassword}
                onToggleVisibility={() => setShowPassword((current) => !current)}
              />
            </Label>

            <AuthMessage message={message} />

            <Button type="submit" disabled={isSubmitting}>
              <LogIn className="size-4" aria-hidden="true" />
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
            <button
              type="button"
              className="text-sm font-bold text-cyan-100 underline-offset-4 hover:underline"
              onClick={() => {
                setAuthMode("reset_request");
                setMessage("Informe seu e-mail para receber um link seguro de recuperacao.");
              }}
            >
              Esqueci minha senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder,
  isVisible,
  onToggleVisibility
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
}) {
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        type={isVisible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-12"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-3 grid place-items-center text-muted transition hover:text-cyan-100"
        onClick={onToggleVisibility}
        aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
        title={isVisible ? "Ocultar senha" : "Mostrar senha"}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function AuthMessage({ message }: { message: string }) {
  return message ? (
    <p className="rounded-lg border border-bronze/20 bg-bronze/10 px-3 py-2 text-sm font-bold text-cream">
      {message}
    </p>
  ) : null;
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

function isMissingStatusColumn(message?: string) {
  const text = (message ?? "").toLowerCase();
  return text.includes("status") && (text.includes("column") || text.includes("schema cache"));
}

async function preparePasswordRecoverySession(client: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>) {
  const hint = getPasswordRecoveryHint();

  if (!hint.isRecovery) {
    return false;
  }

  if (hint.code) {
    await client.auth.exchangeCodeForSession(hint.code).then(
      () => undefined,
      () => undefined
    );
  }

  return true;
}

function isPasswordRecoveryUrl() {
  return getPasswordRecoveryHint().isRecovery;
}

function getPasswordRecoveryHint() {
  if (typeof window === "undefined") {
    return { isRecovery: false, code: null };
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = url.searchParams.get("type") || hashParams.get("type");
  const accessToken = hashParams.get("access_token");
  const code = url.searchParams.get("code");
  const mayaRecovery = url.searchParams.get("maya_recovery") === "1";

  return {
    isRecovery: mayaRecovery || type === "recovery" || Boolean(accessToken && type === "recovery") || Boolean(code && !type),
    code
  };
}

function cleanPasswordRecoveryUrl() {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(null, "", window.location.pathname || "/");
}

function formatPasswordRecoveryError(message?: string) {
  const text = (message ?? "").toLowerCase();

  if (text.includes("expired") || text.includes("invalid")) {
    return "O link expirou ou ja foi usado. Solicite um novo link de recuperacao.";
  }

  if (text.includes("password")) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }

  if (text.includes("email")) {
    return "Confira se o e-mail esta correto e tente novamente.";
  }

  return "Nao foi possivel concluir a recuperacao agora. Tente novamente.";
}
