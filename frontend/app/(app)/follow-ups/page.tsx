"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FollowUpFormDialog } from "@/components/followup-form";
import { useFollowUps, useUpdateFollowUp } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { statusLabel } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "overdue" | "today" | "upcoming" | "all";

export default function FollowUpsPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "today");
  const update = useUpdateFollowUp();

  const { data, isLoading } = useFollowUps({ view: tab, per_page: 100 });
  const rows = data?.data ?? [];

  function toggle(id: string, done: boolean) {
    update.mutate(
      { id, status: done ? "completed" : "pending" },
      {
        onSuccess: () => toast.success(done ? "Follow-up completed" : "Reopened"),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Stay on top of every deal</p>
        </div>
        <FollowUpFormDialog />
      </div>

      <div className="flex gap-1">
        {tabs.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>}
          {!isLoading && rows.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nothing {tab === "all" ? "here" : tab} — good or empty?
            </p>
          )}
          <div>
            {rows.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-0">
                <Checkbox
                  checked={f.status === "completed"}
                  onCheckedChange={(v) => toggle(f.id, Boolean(v))}
                />
                <div className="min-w-0 flex-1">
                  <div className={cn(f.status === "completed" && "text-muted-foreground line-through")}>
                    {f.description ?? "Follow-up"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.lead && (
                      <Link href={`/leads/${f.lead_id}`} className="hover:underline">
                        {f.lead.company?.name ?? f.lead.title}
                      </Link>
                    )}{" "}
                    · due {fmtDate(f.due_date)}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    f.status === "completed"
                      ? "text-emerald-600"
                      : f.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : "text-amber-600",
                  )}
                >
                  {statusLabel(f.status)}
                </span>
                {f.status !== "completed" && f.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update.mutate(
                        { id: f.id, status: "cancelled" },
                        { onSuccess: () => toast.success("Cancelled"), onError: (e) => toast.error(e.message) },
                      )
                    }
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
