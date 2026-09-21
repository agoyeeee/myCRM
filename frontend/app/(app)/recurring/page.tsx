"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No recurring services yet
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{r.billing_cycle}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.next_billing_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
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
