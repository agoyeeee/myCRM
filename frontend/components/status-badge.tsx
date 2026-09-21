"use client";

import { Badge } from "@/components/ui/badge";

const tones: Record<string, string> = {
  research: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  qualified: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  contacted: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  replied: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  interested: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  proposal: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  pending: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  negotiation: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  expired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  planning: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  review: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  project: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  recurring: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  one_time: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">–</span>;
  return (
    <Badge variant="outline" className={`border-transparent capitalize ${tones[status] ?? ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
