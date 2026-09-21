"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useDashboard } from "@/lib/hooks";
import { formatCurrency } from "@/lib/types";
import { dayLabel } from "@/lib/date";
import { AlertTriangle, ArrowRight, CalendarClock, Flame, Inbox, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  href: string;
  danger?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;
  const pipeline = data?.pipeline ?? [];
  const maxPipeline = Math.max(1, ...pipeline.map((s) => s.count));
  const tasks = data?.today_tasks ?? [];
  const activity = data?.recent_activity ?? [];
  const overdue = kpi?.followups_overdue ?? 0;

  const kpis: Kpi[] = [
    { label: "Open Deals", value: kpi?.active_deals ?? 0, hint: "in pipeline", href: "/pipeline", icon: TrendingUp },
    { label: "Pipeline Value", value: formatCurrency(kpi?.pipeline_value), href: "/pipeline", icon: TrendingUp },
    { label: "New Leads (7d)", value: kpi?.new_leads ?? 0, hint: `${kpi?.total_leads ?? 0} total`, href: "/leads", icon: Flame },
    { label: "Follow-ups Today", value: kpi?.followups_today ?? 0, hint: overdue ? `${overdue} overdue` : "on track", href: "/follow-ups", danger: overdue > 0, icon: CalendarClock },
    { label: "Monthly Revenue", value: formatCurrency(kpi?.monthly_revenue), href: "/revenue", icon: TrendingUp },
    { label: "MRR", value: formatCurrency(kpi?.mrr), hint: "recurring", href: "/recurring", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of your sales pipeline and revenue" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group">
            <Card
              className={cn(
                "py-0 transition-colors group-hover:bg-accent/40",
                k.danger && "border-danger/30",
              )}
            >
              <CardContent className="flex items-start justify-between px-4 py-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={cn("mt-1.5 truncate text-2xl font-semibold tabular-nums tracking-tight", k.danger && "text-destructive")}>
                    {k.value}
                  </p>
                  {k.hint && <p className={cn("mt-0.5 text-xs", k.danger ? "text-destructive" : "text-muted-foreground")}>{k.hint}</p>}
                </div>
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-muted", k.danger && "bg-destructive/10")}>
                  <k.icon className={cn("size-4 text-muted-foreground", k.danger && "text-destructive")} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="py-6 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <Link href="/pipeline" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Open board <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pipeline.length === 0 && <EmptyState title="Pipeline is empty" description="Add leads to see stage distribution here." />}
            {pipeline.map((s) => (
              <Link
                key={s.status}
                href={`/leads?status=${s.status}`}
                className="block rounded-md p-2 transition-colors hover:bg-accent/50"
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{s.status.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.count} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all"
                    style={{ width: `${Math.max(3, (s.count / maxPipeline) * 100)}%` }}
                  />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="py-6">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" /> Today&#39;s tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {tasks.length === 0 && (
              <EmptyState icon={<Inbox className="size-4" />} title="Nothing due today" description="Scheduled follow-ups will show up here." />
            )}
            {tasks.map((t) => (
              <Link
                key={`${t.kind}-${t.id}`}
                href={t.href ?? "/follow-ups"}
                className="flex items-center gap-2.5 rounded-md p-2 text-sm transition-colors hover:bg-accent/50"
              >
                {t.kind === "overdue" ? (
                  <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <Flame className="size-3.5 shrink-0 text-warning" />
                )}
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <StatusBadge status={t.kind} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="py-6">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-muted-foreground" /> Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 && (
            <EmptyState icon={<Inbox className="size-4" />} title="No activity yet" description="Log calls, emails and notes from any lead page." />
          )}
          <div className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-accent/40">
                <div className="w-20 shrink-0 pt-0.5 text-xs text-muted-foreground">{dayLabel(a.created_at)}</div>
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
