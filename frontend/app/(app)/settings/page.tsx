"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { setTokens } from "@/lib/api";

type Me = { user: { id: string; name: string; email: string } };

export default function SettingsPage() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
  });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/me", {
        method: "PATCH",
        body: { ...(name ? { name } : {}), ...(password ? { password } : {}) },
      });
      toast.success("Profile updated");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const router = useRouter();

  function logout() {
    setTokens(null);
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Profile and preferences</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={me?.user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>New name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={me?.user?.name} />
            </div>
            <div className="space-y-1.5">
              <Label>New password (optional)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
