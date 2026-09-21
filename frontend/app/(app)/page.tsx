"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useDashboard } from "@/lib/hooks";
import { formatCurrency } from "@/lib/types";
import { dayLabel } from "@/lib/date";
import { AlertTriangle, CalendarClock, Flame, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;
  const pipeline = data?.pipeline ?? [];
  const maxPipeline = Math.max(1, ...pipeline.map((s) => s.count));
  const tasks = data?.today_tasks ?? [];
  const activity = data?.recent_activity ?? [];

  const kpis = [
    { label: "Total Leads", value: kpi?.total_leads ?? 0, href: "/leads" },
    { label: "New Leads (7d)", value: kpi?.new_leads ?? 0, href: "/leads" },
    { label: "Follow-ups Today", value: kpi?.followups_today ?? 0, href: "/follow-ups" },
    { label: "Overdue", value: kpi?.followups_overdue ?? 0, href: "/follow-ups", danger: (kpi?.followups_overdue ?? 0) > 0 },
    { label: "Active Deals", value: kpi?.active_deals ?? 0, href: "/pipeline" },
    { label: "Pipeline Value", value: formatCurrency(kpi?.pipeline_value), href: "/pipeline" },
    { label: "Monthly Revenue", value: formatCurrency(kpi?.monthly_revenue), href: "/revenue" },
    { label: "MRR", value: formatCurrency(kpi?.mrr), href: "/recurring" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your sales pipeline and revenue</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className={`py-4 transition-colors hover:bg-secondary/40 ${k.danger ? "border-destructive/40" : ""}`}>
              <CardContent className="px-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${k.danger ? "text-destructive" : ""}`}>{k.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipeline.map((s) => (
              <Link
                key={s.status}
                href={`/leads?status=${s.status}`}
                className="block rounded-md p-2 transition-colors hover:bg-secondary/40"
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{s.status}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.count} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(4, (s.count / maxPipeline) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Today&#39;s Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks today</p>}
            {tasks.map((t) => (
              <Link
                key={`${t.kind}-${t.id}`}
                href={t.href ?? "/follow-ups"}
                className="flex items-center gap-2 rounded-md border p-2 text-sm transition-colors hover:bg-secondary/40"
              >
                {t.kind === "overdue" ? (
                  <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <Flame className="size-3.5 shrink-0 text-amber-500" />
                )}
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <StatusBadge status={t.kind} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet</p>}
          <div className="space-y-3">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className="w-20 shrink-0 text-xs text-muted-foreground">{dayLabel(a.created_at)}</div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium capitalize text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
                  <p className="truncate">
                    {a.description}
                    {a.company_name && <span className="text-muted-foreground"> — {a.company_name}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
