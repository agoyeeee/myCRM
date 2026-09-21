"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useActivities } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/date";

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

export default function ActivitiesPage() {
  const params = useSearchParams();
  const { data, isLoading } = useActivities({ per_page: 100, type: params.get("type") ?? "" });
  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Activities</h1>
        <p className="text-sm text-muted-foreground">All recorded communication</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>}
          {!isLoading && rows.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No activities yet. Log them from a lead detail page.</p>
          )}
          <div>
            {rows.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b px-4 py-3 text-sm last:border-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs">
                  {ACTIVITY_ICONS[a.type] ?? "•"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap">{a.description}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={a.type} />
                    <span>{fmtDateTime(a.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
