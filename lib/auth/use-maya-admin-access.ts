"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isMayaAdminEmail } from "./admin";

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

  return access;
}
