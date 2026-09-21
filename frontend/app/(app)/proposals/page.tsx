"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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
import { ProposalFormDialog } from "@/components/proposal-form";
import { useProposals } from "@/lib/sales-hooks";
import { fmtDate } from "@/lib/date";
import { formatCurrency } from "@/lib/types";
import { ScrollText } from "lucide-react";

export default function ProposalsPage() {
  const { data, isLoading } = useProposals();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Proposals" subtitle="{rows.length} proposals" />
        <ProposalFormDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Valid Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState icon={<ScrollText className="size-4" />} title="No proposals yet" description="Create a proposal to move a deal closer to a signature." />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="font-medium">{p.title}</span>
                      {p.company_id && (
                        <Link href={`/companies/${p.company_id}`} className="ml-2 text-xs text-muted-foreground hover:underline">
                          company
                        </Link>
                      )}
                      <Link href={`/leads/${p.lead_id}`} className="ml-2 text-xs text-muted-foreground hover:underline">
                        lead
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(p.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(p.sent_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(p.valid_until)}</TableCell>
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
