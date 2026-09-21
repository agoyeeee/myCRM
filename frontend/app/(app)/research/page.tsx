"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ResearchFormDialog } from "@/components/research-form";
import { useResearch } from "@/lib/hooks";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

export default function ResearchPage() {
  const { data, isLoading } = useResearch();
  const qc = useQueryClient();
  const rows = data?.data ?? [];

  async function toLead(id: string) {
    try {
      await api(`/research/${id}/to-lead`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["research"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Converted to lead");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function del(id: string) {
    if (!confirm("Delete research record?")) return;
    try {
      await api(`/research/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["research"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Research Center</h1>
          <p className="text-sm text-muted-foreground">Collect prospect intel before it becomes a lead</p>
        </div>
        <ResearchFormDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {!isLoading && rows.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            No research records yet. Log companies you discover.
          </p>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="py-0">
            <CardHeader className="pb-1 pt-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{r.company_name ?? "Untitled"}</CardTitle>
                {r.priority && <StatusBadge status={r.priority} />}
              </div>
              {r.website && (
                <a href={r.website} target="_blank" rel="noreferrer" className="truncate text-xs text-muted-foreground hover:underline">
                  {r.website}
                </a>
              )}
            </CardHeader>
            <CardContent className="pb-4 text-sm">
              {(r.industry || r.location) && (
                <p className="text-xs text-muted-foreground">
                  {[r.industry, r.location].filter(Boolean).join(" · ")}
                </p>
              )}
              {r.pain_point && (
                <p className="mt-2 line-clamp-2">
                  <span className="text-xs font-medium text-muted-foreground">Pain: </span>
                  {r.pain_point}
                </p>
              )}
              {r.opportunity && (
                <p className="mt-1 line-clamp-2">
                  <span className="text-xs font-medium text-muted-foreground">Opportunity: </span>
                  {r.opportunity}
                </p>
              )}
              {r.service && (
                <p className="mt-1 text-xs">
                  <span className="font-medium text-muted-foreground">Service: </span>
                  {r.service}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => toLead(r.id)}>
                  Convert to Lead
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(r.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
