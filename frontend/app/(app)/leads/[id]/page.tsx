"use client";

import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LeadActivityComposer } from "@/components/activity-composer";
import { FollowUpComposer } from "@/components/followup-composer";
import { LeadAnalysisCard } from "@/components/ai-analysis";
import { useActivities, useAnalyzeLead, useConvertLead, useLead, useUpdateLead } from "@/lib/hooks";
import { api } from "@/lib/api";
import { LEAD_STATUSES, PRIORITIES, formatCurrency } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { ArrowRight, Building2, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const ACTIVITY_ICONS: Record<string, string> = {
  note: "📝",
  email: "✉️",
  whatsapp: "💬",
  phone: "📞",
  meeting: "📅",
  proposal: "📄",
  follow_up: "🔔",
  other: "•",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: lead, isLoading } = useLead(id);
  const { data: activities, isLoading: actsLoading } = useActivities({ lead_id: id, per_page: 50 });
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const analyze = useAnalyzeLead();

  if (isLoading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  async function onDelete() {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      await api(`/leads/${id}`, { method: "DELETE" });
      toast.success("Lead deleted");
      router.push("/leads");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/leads" className="hover:underline">
              Leads
            </Link>
            <span>/</span>
            <span>{lead.company?.name ?? "Lead"}</span>
          </div>
          <h1 className="text-2xl font-semibold">{lead.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              analyze.mutate(id, {
                onSuccess: () => toast.success("AI analysis complete"),
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={analyze.isPending}
          >
            <Sparkles className="mr-2 size-4" />
            {analyze.isPending ? "Analyzing…" : "AI Analysis"}
          </Button>
          <Button
            onClick={() =>
              convertLead.mutate(id, {
                onSuccess: () => {
                  toast.success("Lead converted to client");
                  router.push("/clients");
                },
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={lead.status !== "won" || convertLead.isPending}
          >
            Convert to Client <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <Link href={`/companies/${lead.company_id}`} className="hover:underline">
                {lead.company?.name ?? lead.company_id}
              </Link>
            </div>
            {lead.contact && (
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" />
                <span>{lead.contact.name}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Select value={lead.status} onValueChange={(v) => updateLead.mutate({ id, status: v })}>
                <SelectTrigger className="h-7 w-fit gap-1 border-0 bg-transparent p-1 shadow-none">
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
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Priority</span>
              <Select value={lead.priority} onValueChange={(v) => updateLead.mutate({ id, priority: v })}>
                <SelectTrigger className="h-7 w-fit gap-1 border-0 bg-transparent p-1 shadow-none">
                  <StatusBadge status={lead.priority} />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Est. Value</span>
              <span className="font-medium tabular-nums">{formatCurrency(lead.estimated_value)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source</span>
              <span className="capitalize">{lead.source?.replace(/_/g, " ") ?? "–"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Next follow-up</span>
              <span>{fmtDateTime(lead.next_follow_up)}</span>
            </div>
            {lead.notes && (
              <>
                <Separator />
                <p className="whitespace-pre-wrap text-muted-foreground">{lead.notes}</p>
              </>
            )}
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 size-4" /> Delete
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <LeadAnalysisCard leadId={id} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Log Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadActivityComposer leadId={id} companyId={lead.company_id} contactId={lead.contact_id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Schedule Follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUpComposer leadId={id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {actsLoading && <Skeleton className="h-20 w-full" />}
              {!actsLoading && (activities?.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              )}
              <div className="space-y-0">
                {(activities?.data ?? []).map((a, i, arr) => (
                  <div key={a.id} className="relative flex gap-3 pb-4">
                    {i < arr.length - 1 && <div className="absolute left-[11px] top-6 h-full w-px bg-border" />}
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs">
                      {ACTIVITY_ICONS[a.type] ?? "•"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium capitalize text-muted-foreground">
                          {a.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
