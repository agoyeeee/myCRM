"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLogin, useRegister } from "@/lib/auth";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const login = useLogin();
  const register = useRegister();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        await register(name, email, password);
        await login(email, password);
      } else {
        await login(email, password);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm py-2 shadow-sm">
        <CardHeader className="pb-2">
          <div className="mx-auto mb-1 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">C</span>
          </div>
          <CardTitle className="text-center text-lg">
            {mode === "login" ? "Sign in to ClientOS" : "Create your account"}
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Your personal CRM and sales workspace" : "Start organizing your pipeline in minutes"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Protected by email & password. Sessions expire automatically.
            </p>
            <Button
              type="button"
              variant="link"
              className="text-sm text-muted-foreground"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "No account? Register" : "Have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


