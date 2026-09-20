"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export async function mayaFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createBrowserSupabaseClient();
  const headers = new Headers(init.headers);

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers
  });
}
