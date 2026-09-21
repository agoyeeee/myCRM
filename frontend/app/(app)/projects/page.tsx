"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ProjectFormDialog } from "@/components/project-form";
import { useProjects } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";

export default function ProjectsPage() {
  const { data, isLoading } = useProjects({ per_page: 100 });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">{rows.length} projects</p>
        </div>
        <ProjectFormDialog />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        {!isLoading && rows.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            No projects yet. Create one for a client.
          </p>
        )}
        {rows.map((p) => (
          <Card key={p.id} className="py-0">
            <CardHeader className="pb-1 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <StatusBadge status={p.status} />
              </div>
            </CardHeader>
            <CardContent className="pb-4 text-sm">
              <Link href={`/clients/${p.client_id}`} className="text-muted-foreground hover:underline">
                Client
              </Link>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">Budget</span>
                <span className="tabular-nums">{formatCurrency(p.budget)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Revenue</span>
                <span className="tabular-nums">{formatCurrency(p.actual_revenue)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{fmtDate(p.start_date)}</span>
                <span>{fmtDate(p.end_date)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
