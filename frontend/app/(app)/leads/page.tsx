"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} leads</p>
        </div>
        <LeadFormDialog />
      </div>

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Company / Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Next Follow-up</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No leads found. <Link href="/research" className="underline">Start with research</Link> or create your first
                      lead.
                    </td>
                  </tr>
                )}
                {rows.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.company?.name ?? lead.title}
                      </Link>
                      {lead.company?.name && (
                        <div className="text-xs text-muted-foreground">{lead.title}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.priority} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(lead.estimated_value)}</td>
                    <td className="px-4 py-3">{fmtDate(lead.next_follow_up)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(lead.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data?.meta && data.meta.total_pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {data.meta.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.total_pages}
            onClick={() => setParam("page", String(page + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
