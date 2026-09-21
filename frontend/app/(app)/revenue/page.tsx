"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RevenueFormDialog } from "@/components/revenue-form";
import { useRevenue } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";

export default function RevenuePage() {
  const { data, isLoading } = useRevenue({ per_page: 100 });
  const rows = data?.data ?? [];
  const summary = data?.summary;
  const monthly = rows.filter((r) => (r.occurred_at ?? "").startsWith(new Date().toISOString().slice(0, 7)));
  const monthlyTotal = monthly.reduce((s, r) => s + r.amount, 0);
  const yearTotal = rows
    .filter((r) => (r.occurred_at ?? "").startsWith(String(new Date().getFullYear())))
    .reduce((s, r) => s + r.amount, 0);

  const cards = [
    { label: "This Month", value: formatCurrency(monthlyTotal) },
    { label: "This Year", value: formatCurrency(yearTotal) },
    { label: "MRR", value: formatCurrency(summary?.mrr ?? 0) },
    { label: "Outstanding", value: formatCurrency(summary?.outstanding ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Revenue</h1>
          <p className="text-sm text-muted-foreground">Track money in</p>
        </div>
        <RevenueFormDialog />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="py-4">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No revenue recorded yet
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">{fmtDate(r.occurred_at)}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.type} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.notes ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
