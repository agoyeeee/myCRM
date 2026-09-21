"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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

export default function ContactsPage() {
  const [companyId, setCompanyId] = useState("");
  const companies = useCompanies({ per_page: 200 });
  const contacts = useContacts(companyId || undefined);
  const rows = contacts?.data?.data ?? [];
  const companyNames = new Map((companies?.data?.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{rows.length} contacts</p>
        </div>
        <ContactFormDialog
          companyId={companyId}
          trigger={companyId ? undefined : (
            <span className="hidden" />
          )}
        />
      </div>

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!contacts.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No contacts yet. Add one from a company detail page.
                    </td>
                  </tr>
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.company_id}`} className="hover:underline">
                        {companyNames.get(c.company_id) ?? c.company_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.job_title ?? "–"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "–"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
