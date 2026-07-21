import type { SupabaseClient } from "@supabase/supabase-js";

export function isPushAvailable() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerCurrentDeviceForPush(supabase: SupabaseClient) {
  if (!isPushAvailable()) {
    throw new Error("Este navegador nao suporta push real.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("A chave publica VAPID ainda nao foi configurada.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Permissao de notificacao nao concedida.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    }));
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("Entre na sua conta para salvar este aparelho.");
  }

  const response = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(subscription.toJSON())
  });

  const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || "Nao consegui salvar este aparelho para push.");
  }

  return subscription.endpoint;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
