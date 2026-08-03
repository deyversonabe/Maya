"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isMayaAdminEmail } from "./admin";

const SESSION_LOCK_KEY = "maya.finance.session_locked.v1";
const BEFORE_SIGN_OUT_EVENT = "maya:before-sign-out";

export function useMayaAdminAccess() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [access, setAccess] = useState({
    checked: false,
    email: null as string | null,
    isAdmin: false
  });

  useEffect(() => {
    if (!supabase) {
      setAccess({ checked: true, email: null, isAdmin: false });
      return;
    }

    let isMounted = true;

    function updateAccess(email?: string | null) {
      if (!isMounted) {
        return;
      }

      setAccess({
        checked: true,
        email: email ?? null,
        isAdmin: isMayaAdminEmail(email)
      });
    }

    supabase.auth.getUser().then(
      ({ data }) => updateAccess(data.user?.email),
      () => updateAccess(null)
    );

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAccess(session?.user.email);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const pendingSaves: Promise<unknown>[] = [];
    window.dispatchEvent(
      new CustomEvent(BEFORE_SIGN_OUT_EVENT, {
        detail: {
          waitUntil: (promise: Promise<unknown>) => pendingSaves.push(promise)
        }
      })
    );

    if (pendingSaves.length > 0) {
      await Promise.allSettled(pendingSaves.map((promise) => withTimeout(promise, 4000)));
    }

    window.localStorage.setItem(SESSION_LOCK_KEY, "true");
    await supabase.auth.signOut();
    setAccess({ checked: true, email: null, isAdmin: false });
  }, [supabase]);

  return {
    ...access,
    signOut
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("sync_timeout")), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
