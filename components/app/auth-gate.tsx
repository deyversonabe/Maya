"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type GateStatus = "loading" | "signed_out" | "signed_in" | "unconfigured";

export function AuthGate({ children }: { children: React.ReactNode }) {
    const [supabase] = useState(() => createBrowserSupabaseClient());
    const [status, setStatus] = useState<GateStatus>(() => (supabase ? "loading" : "unconfigured"));
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
        if (!supabase) {
                return;
        }

                let isMounted = true;

                supabase.auth.getSession().then((result) => {
                        if (!isMounted) {
                                  return;
                        }

                                                      const nextUser = result.data.session ? result.data.session.user : null;
                        setStatus(nextUser ? "signed_in" : "signed_out");
                });

                const sub = supabase.auth.onAuthStateChange((event, session) => {
                        const nextUser = session ? session.user : null;
                        setStatus(nextUser ? "signed_in" : "signed_out");
                });

                return () => {
                        isMounted = false;
                        sub.data.subscription.unsubscribe();
                };
  }, [supabase]);

  async function handleLogin(event: React.FormEvent) {
        event.preventDefault();

      if (!supabase) {
              return;
      }

      setIsSubmitting(true);
        setError("");

      const result = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password
      });

      if (result.error) {
              setError("E-mail ou senha incorretos.");
              setIsSubmitting(false);
              return;
      }

      setPassword("");
        setIsSubmitting(false);
  }

  if (status === "loading") {
        return (
                <div className="flex min-h-screen items-center justify-center">
                        <p className="text-sm font-bold text-muted">Verificando acesso...</p>
                </div>
              );
  }
  
    if (status === "unconfigured") {
          return (
                  <div className="flex min-h-screen items-center justify-center p-4">
                          <div className="max-w-md rounded-card border border-amber-300/30 bg-amber-300/10 p-6 text-center">
                                    <p className="font-bold text-amber-100">Autenticacao nao configurada neste deploy. Fale com o administrador.</p>
                          </div>
                  </div>
                );
    }

  if (status === "signed_out") {
        return (
                <div className="flex min-h-screen items-center justify-center p-4">
                        <div className="w-full max-w-sm rounded-card border border-bronze/20 bg-moss-950/80 p-6 shadow-soft backdrop-blur-2xl">
                                  <div className="mb-4 flex flex-col items-center gap-2 text-center">
                                              <Image src="/brand/juntos-maya-logo.png" alt="Juntos Maya" width={220} height={140} priority className="h-20 w-36 object-contain drop-shadow-[0_0_18px_rgba(196,106,67,0.35)]" />
                                              <p className="text-sm text-muted">Entre com sua conta autorizada para acessar o Juntos Maya.</p>
                                  </div>
                        
                                  <form className="grid gap-3" onSubmit={handleLogin}>
                                              <Label>
                                                            E-mail
                                                            <Input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
                                              </Label>
                                              <Label>
                                                            Senha
                                                            <Input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="sua senha" />
                                              </Label>
                                  
                                    {error ? <p className="rounded-lg border border-bronze/20 bg-bronze/10 px-3 py-2 text-sm font-bold text-cream">{error}</p> : null}
                                  
                                              <Button type="submit" disabled={isSubmitting}>
                                                            <LogIn className="size-4" aria-hidden="true" />
                                                            Entrar
                                              </Button>
                                  </form>
                        </div>
                </div>
              );
  }
  
    return children;
}
