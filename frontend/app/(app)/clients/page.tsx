"use client";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useClients } from "@/lib/hooks";
import { fmtDate } from "@/lib/date";
import { Building2, Contact } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientsPage() {
  const { data, isLoading } = useClients({ per_page: 100 });
  const qc = useQueryClient();
  const rows = data?.data ?? [];

  async function setStatus(id: string, status: string) {
    try {
      await api(`/clients/${id}`, { method: "PATCH", body: { status } });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Clients" subtitle="{rows.length} clients" />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Converted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState icon={<Contact className="size-4" />} title="No clients yet" description="Convert a won lead from its detail page to see clients here." />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="size-4 text-muted-foreground" />
                        {c.company?.name ?? c.company_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(c.converted_at)}</TableCell>
                    <TableCell className="text-right">
                      {c.status === "active" ? (
                        <Button variant="ghost" size="sm" onClick={() => setStatus(c.id, "inactive")}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setStatus(c.id, "active")}>
                          Activate
                        </Button>
                      )}
                    </TableCell>
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
