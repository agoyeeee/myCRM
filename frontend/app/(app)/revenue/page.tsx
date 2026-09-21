"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RevenueFormDialog } from "@/components/revenue-form";
import { useRevenue } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";
import { CreditCard } from "lucide-react";

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
      <PageHeader title="Revenue" subtitle="Track money in" actions={<RevenueFormDialog />} />

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState icon={<CreditCard className="size-4" />} title="No revenue recorded yet" description="Log your first payment — one-time or recurring." />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.occurred_at)}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatCurrency(r.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.type} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.notes ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
