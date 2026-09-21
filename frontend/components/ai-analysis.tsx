"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLead } from "@/lib/hooks";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const FIELDS: { key: string; label: string }[] = [
  { key: "business_summary", label: "Business Summary" },
  { key: "pain_points", label: "Potential Pain Points" },
  { key: "opportunities", label: "Potential Opportunities" },
  { key: "suggested_service", label: "Suggested Service" },
  { key: "suggested_outreach", label: "Suggested Outreach" },
  { key: "suggested_questions", label: "Suggested Questions" },
];

export function LeadAnalysisCard({ leadId }: { leadId: string }) {
  const { data: lead } = useLead(leadId);
  const [busy, setBusy] = useState(false);

  const analysis = lead?.ai_analysis ?? null;

  async function generate() {
    setBusy(true);
    try {
      const res = await api<{ analysis: Record<string, string> }>(`/ai/analyze-lead/${leadId}`, { method: "POST" });
      toast.success("Analysis generated");
      return res;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI analysis failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function draft() {
    setBusy(true);
    try {
      const res = await api<{ draft: string }>("/ai/draft-outreach", {
        method: "POST",
        body: { lead_id: leadId },
      });
      if (res.draft && lead) {
        await api("/activities", {
          method: "POST",
          body: {
            lead_id: leadId,
            company_id: lead.company_id,
            contact_id: lead.contact_id,
            type: "other",
            description: `AI outreach draft:\n${res.draft}`,
          },
        });
      }
      toast.success("Outreach draft logged as activity — review before sending");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setBusy(false);
    }
  }

  if (!analysis && !busy) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Generate insights: business summary, pain points, suggested service and outreach.
          </p>
          <Button variant="outline" onClick={generate}>
            Analyze
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (busy) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 animate-pulse" /> AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> AI Analysis
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={draft} disabled={busy}>
            Draft Outreach
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {FIELDS.map((f) =>
          analysis?.[f.key] ? (
            <div key={f.key}>
              <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
              <p className="whitespace-pre-wrap">{analysis[f.key]}</p>
            </div>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}
