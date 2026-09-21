"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLeads, usePipeline, useUpdateLead } from "@/lib/hooks";
import { LEAD_STATUSES, formatCurrency, type Lead } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const STAGE_TONE: Record<string, string> = {
  research: "text-muted-foreground",
  qualified: "text-info",
  contacted: "text-cyan-600 dark:text-cyan-400",
  replied: "text-violet-600 dark:text-violet-400",
  interested: "text-violet-600 dark:text-violet-400",
  meeting: "text-violet-600 dark:text-violet-400",
  proposal: "text-warning",
  won: "text-success",
  lost: "text-danger",
};

export default function PipelinePage() {
  const { data, isLoading } = usePipeline();
  const { data: leadsData } = useLeads({ per_page: 500 });
  const updateLead = useUpdateLead();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const leads = useMemo(() => leadsData?.data ?? [], [leadsData]);
  const byStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of LEAD_STATUSES) map[s] = [];
    for (const l of leads) if (map[l.status]) map[l.status].push(l);
    return map;
  }, [leads]);

  const stats = data?.stages ?? LEAD_STATUSES.map((s) => ({ status: s, count: 0, value: 0 }));

  function onDrop(status: string) {
    if (dragId) {
      const lead = leads.find((l) => l.id === dragId);
      if (lead && lead.status !== status) {
        updateLead.mutate(
          { id: dragId, status },
          {
            onError: (e) => console.error(e.message),
          },
        );
      }
    }
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Pipeline" subtitle="Drag cards between columns to change stage" />

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
        {LEAD_STATUSES.map((status) => {
          const st = stats.find((s) => s.status === status);
          const count = st?.count ?? byStatus[status]?.length ?? 0;
          return (
            <div
              key={status}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-lg border bg-card transition-colors",
                overCol === status && "border-primary/40 bg-accent/40",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={() => setOverCol((v) => (v === status ? null : v))}
              onDrop={() => onDrop(status)}
            >
              <div className="border-b px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm font-medium capitalize", STAGE_TONE[status])}>{status}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
                </div>
                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{formatCurrency(st?.value ?? 0)}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                {isLoading && <Skeleton className="h-16" />}
                {(byStatus[status] ?? []).map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "cursor-grab rounded-md border bg-card p-2.5 shadow-xs transition-all hover:border-border hover:shadow-sm active:cursor-grabbing active:shadow-sm",
                      dragId === lead.id && "opacity-40 ring-2 ring-primary/30",
                    )}
                  >
                    <Link href={`/leads/${lead.id}`} className="text-sm font-medium leading-snug hover:underline">
                      {lead.company?.name ?? lead.title}
                    </Link>
                    {lead.company?.name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.title}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={lead.priority} />
                      <span className="text-xs font-medium tabular-nums">{formatCurrency(lead.estimated_value)}</span>
                    </div>
                  </div>
                ))}
                {(byStatus[status] ?? []).length === 0 && !isLoading && (
                  <p className="flex flex-1 items-center justify-center rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground/70">
                    Drop deals here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
