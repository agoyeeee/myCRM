"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLeads, usePipeline, useUpdateLead } from "@/lib/hooks";
import { LEAD_STATUSES, formatCurrency, type Lead } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
        updateLead.mutate({ id: dragId, status });
      }
    }
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Drag cards between columns to change stage</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((status) => {
          const st = stats.find((s) => s.status === status);
          return (
            <div
              key={status}
              className={cn(
                "flex w-60 shrink-0 flex-col rounded-lg border bg-muted/30",
                overCol === status && "ring-2 ring-primary/40",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => onDrop(status)}
            >
              <div className="border-b px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{status}</span>
                  <span className="text-xs text-muted-foreground">{st?.count ?? byStatus[status]?.length ?? 0}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(st?.value ?? 0)}</span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {isLoading && <Skeleton className="h-16" />}
                {(byStatus[status] ?? []).map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn("cursor-grab py-0 active:cursor-grabbing", dragId === lead.id && "opacity-50")}
                  >
                    <CardContent className="px-3 py-2.5">
                      <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:underline">
                        {lead.company?.name ?? lead.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{lead.title}</p>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-medium capitalize">
                          {lead.priority}
                        </span>
                        <span className="tabular-nums">{formatCurrency(lead.estimated_value)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(byStatus[status] ?? []).length === 0 && !isLoading && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
