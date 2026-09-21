"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LeadFormDialog } from "@/components/lead-form";
import { useLeads, useUpdateLead } from "@/lib/hooks";
import { LEAD_STATUSES, PRIORITIES, formatCurrency } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { toast } from "sonner";

export default function LeadsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const page = Number(params.get("page") ?? 1);
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";

  const { data, isLoading } = useLeads({
    page,
    search,
    status,
    priority,
    sort: params.get("sort") ?? "created_at",
    order: params.get("order") ?? "desc",
  });
  const updateLead = useUpdateLead();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`/leads?${next.toString()}`);
  }

  function changeStatus(id: string, newStatus: string) {
    updateLead.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => toast.success(`Status changed to ${newStatus}`),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Leads" subtitle={`${data?.meta?.total ?? 0} leads`} actions={<LeadFormDialog />} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search company, contact, title…"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setParam("search", search)}
          onBlur={() => setParam("search", search)}
        />
        <Select value={status} onValueChange={(v) => setParam("status", v === "all" ? "" : v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setParam("priority", v === "all" ? "" : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company / Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Next Follow-up</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No leads found. <Link href="/research" className="underline">Start with research</Link> or create your first
                      lead.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.company?.name ?? lead.title}
                      </Link>
                      {lead.company?.name && (
                        <div className="text-xs text-muted-foreground">{lead.title}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={lead.status} onValueChange={(v) => changeStatus(lead.id, v)}>
                        <SelectTrigger className="h-7 w-fit gap-1 border-0 bg-transparent p-1 shadow-none hover:bg-secondary">
                          <StatusBadge status={lead.status} />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lead.priority} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(lead.estimated_value)}</TableCell>
                    <TableCell>{fmtDate(lead.next_follow_up)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(lead.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data?.meta && data.meta.total_pages > 1 && (
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Page {page} of {data.meta.total_pages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.total_pages}
                onClick={() => setParam("page", String(page + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
