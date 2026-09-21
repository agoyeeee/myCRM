"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ProposalFormDialog } from "@/components/proposal-form";
import { useProposals } from "@/lib/sales-hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";

export default function ProposalsPage() {
  const { data, isLoading } = useProposals();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-muted-foreground">{rows.length} proposals</p>
        </div>
        <ProposalFormDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No proposals yet
                    </td>
                  </tr>
                )}
                {rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.title}</span>
                      {p.company_id && (
                        <Link href={`/companies/${p.company_id}`} className="ml-2 text-xs text-muted-foreground hover:underline">
                          company
                        </Link>
                      )}
                      <Link href={`/leads/${p.lead_id}`} className="ml-2 text-xs text-muted-foreground hover:underline">
                        lead
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.sent_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.valid_until)}</td>
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
