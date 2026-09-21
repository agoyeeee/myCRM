"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ContactFormDialog } from "@/components/contact-form";
import { useContacts, useCompanies } from "@/lib/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Contact } from "lucide-react";

export default function ContactsPage() {
  const [companyId, setCompanyId] = useState("");
  const companies = useCompanies({ per_page: 200 });
  const contacts = useContacts(companyId || undefined);
  const rows = contacts?.data?.data ?? [];
  const companyNames = new Map((companies?.data?.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <PageHeader title="Contacts" subtitle="{rows.length} contacts" actions={<ContactFormDialog
          companyId={companyId}
          trigger={companyId ? undefined : (
            <span className="hidden" />
          )}
        />} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filter by company (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {(companies?.data?.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {companyId && companyId !== "all" && (
          <ContactFormDialog companyId={companyId} companyName={companyNames.get(companyId)} />
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!contacts.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState icon={<Contact className="size-4" />} title="No contacts yet" description="Add a contact from a company page, or create one directly here." />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Link href={`/companies/${c.company_id}`} className="hover:underline">
                        {companyNames.get(c.company_id) ?? c.company_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.job_title ?? "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "–"}</TableCell>
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
