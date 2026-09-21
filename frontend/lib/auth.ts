import { api, setTokens } from "@/lib/api";
import type { Client as ClientT } from "@/lib/types";

export function useLogin() {
  return async function login(email: string, password: string) {
    const res = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setTokens(res);
  };
}

export async function fetchMe(): Promise<{ user: { id: string; name: string; email: string } }> {
  return api("/me");
}

export function useRegister() {
  return async function register(name: string, email: string, password: string) {
    await api<{ user: { id: string } }>("/auth/register", { method: "POST", body: { name, email, password } });
  };
}

export type { ClientT };
