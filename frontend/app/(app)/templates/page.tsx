"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { TemplateFormDialog } from "@/components/template-form";
import { useTemplates } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const qc = useQueryClient();
  const rows = data?.data ?? [];

  async function duplicate(id: string) {
    try {
      await api(`/outreach-templates/${id}/duplicate`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function del(id: string) {
    if (!confirm("Delete template?")) return;
    try {
      await api(`/outreach-templates/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Outreach Templates"
        subtitle={
          <>
            Variables: <code className="rounded bg-muted px-1">{"{{company_name}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{contact_name}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{service}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{problem}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{name}}"}</code>
          </>
        }
        actions={<TemplateFormDialog />}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        {!isLoading && rows.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No templates yet</p>
        )}
        {rows.map((t) => (
          <Card key={t.id} className="py-0">
            <CardHeader className="pb-1 pt-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <StatusBadge status={t.category} />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{fmtDate(t.updated_at)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => duplicate(t.id)}>
                    <Copy className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(t.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
