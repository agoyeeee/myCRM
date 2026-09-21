"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, useMarkNotificationRead } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/date";
import Link from "next/link";
import { BellOff } from "lucide-react";

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Due follow-ups, billing reminders, expiring proposals</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
          {!isLoading && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
              <BellOff className="size-8" />
              <p className="text-sm">All caught up</p>
            </div>
          )}
          <div>
            {rows.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 border-b px-4 py-3 text-sm last:border-0 ${!n.read_at ? "bg-secondary/30" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-muted-foreground">{n.body}</p>}
                  <span className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</span>
                </div>
                {n.link && (
                  <Button variant="ghost" size="sm" asChild onClick={() => markRead.mutate(n.id)}>
                    <Link href={n.link}>Open</Link>
                  </Button>
                )}
                {!n.read_at && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                    Read
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
