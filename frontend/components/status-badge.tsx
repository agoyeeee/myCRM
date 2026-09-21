"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "violet" | "cyan" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success-foreground ring-success/20",
  warning: "bg-warning-soft text-warning-foreground ring-warning/20",
  danger: "bg-danger-soft text-danger-foreground ring-danger/20",
  info: "bg-info-soft text-info-foreground ring-info/20",
  violet: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  cyan: "bg-cyan-100 text-cyan-800 ring-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-900",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const STATUS_TONE: Record<string, Tone> = {
  // lead stages
  research: "neutral",
  qualified: "info",
  contacted: "cyan",
  replied: "violet",
  interested: "violet",
  meeting: "violet",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  accepted: "success",
  lost: "danger",
  rejected: "danger",
  // priority
  high: "danger",
  medium: "warning",
  low: "neutral",
  // generic lifecycle
  active: "success",
  completed: "success",
  won_stage: "success",
  inactive: "neutral",
  archived: "neutral",
  expired: "neutral",
  draft: "neutral",
  planning: "neutral",
  cancelled: "danger",
  lost_stage: "danger",
  paused: "warning",
  pending: "info",
  sent: "info",
  overdue: "danger",
  in_progress: "info",
  review: "violet",
  // revenue kinds
  project: "info",
  recurring: "success",
  one_time: "warning",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-muted-foreground">–</span>;
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-full border-transparent px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
