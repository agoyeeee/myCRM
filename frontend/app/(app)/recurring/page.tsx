"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { RecurringFormDialog } from "@/components/recurring-form";
import { useRecurring } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";

export default function RecurringPage() {
  const { data, isLoading } = useRecurring({ per_page: 100 });
  const rows = data?.data ?? [];
  const mrr = rows
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + (r.billing_cycle === "monthly" ? r.amount : r.billing_cycle === "quarterly" ? r.amount / 3 : r.billing_cycle === "yearly" ? r.amount / 12 : r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Recurring Services</h1>
          <p className="text-sm text-muted-foreground">
            Estimated MRR: <span className="font-medium text-foreground tabular-nums">{formatCurrency(Math.round(mrr))}</span>
          </p>
        </div>
        <RecurringFormDialog />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Next Billing</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No recurring services yet
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{r.billing_cycle}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.next_billing_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
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
