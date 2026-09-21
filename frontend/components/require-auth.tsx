"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasTokens, loadTokens } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasTokens()) loadTokens();
    if (!hasTokens()) {
      router.replace("/login");
      return;
    }
    const id = setTimeout(() => setOk(true), 0);
    return () => clearTimeout(id);
  }, [router]);

  if (ok === null) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
