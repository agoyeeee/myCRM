"use client";

import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ContactFormDialog } from "@/components/contact-form";
import { LeadFormDialog } from "@/components/lead-form";
import { useActivities, useCompany, useContacts, useLeads } from "@/lib/hooks";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { formatCurrency } from "@/lib/types";
import { Globe, MapPin, Briefcase, Contact, LayoutList, Mail } from "lucide-react";
import { Breadcrumb } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: company, isLoading } = useCompany(id);
  const { data: contacts } = useContacts(id);
  const { data: leads } = useLeads({ company_id: id, per_page: 20 });
  const { data: activities } = useActivities({ company_id: id, per_page: 20 });

  if (isLoading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Breadcrumb items={[{ label: "Companies", href: "/companies" }, { label: company.name }]} />
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{company.name}</h1>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {company.website && (
            <span className="flex items-center gap-1">
              <Globe className="size-3.5" /> {company.website}
            </span>
          )}
          {company.industry && (
            <span className="flex items-center gap-1">
              <Briefcase className="size-3.5" /> {company.industry}
            </span>
          )}
          {company.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {company.location}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Contacts</CardTitle>
            <ContactFormDialog companyId={id} companyName={company.name} />
          </CardHeader>
          <CardContent className="space-y-2">
            {(contacts?.data ?? []).length === 0 && (
              <EmptyState icon={<Contact className="size-4" />} title="No contacts yet" description="Add a contact to track who you talk to at this company." />
            )}
            {(contacts?.data ?? []).map((c) => (
              <div key={c.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.job_title ?? "–"}</div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Leads</CardTitle>
            <LeadFormDialog defaultCompanyId={id} trigger={<Button variant="outline" size="sm">New lead</Button>} />
          </CardHeader>
          <CardContent className="space-y-2">
            {(leads?.data ?? []).length === 0 && (
              <EmptyState icon={<LayoutList className="size-4" />} title="No leads yet" description="Create a lead to start pursuing this company." />
            )}
            {(leads?.data ?? []).map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-secondary/40"
              >
                <div>
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{l.status.replace(/_/g, " ")}</div>
                </div>
                <span className="tabular-nums">{formatCurrency(l.estimated_value)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {(activities?.data ?? []).length === 0 && (
            <EmptyState icon={<Mail className="size-4" />} title="No activities" description="Activity from this company's leads will appear here." />
          )}
          <div className="space-y-2">
            {(activities?.data ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                <span className="capitalize text-xs font-medium text-muted-foreground">{a.type.replace(/_/g, " ")}</span>
                <span className="min-w-0 flex-1 truncate">{a.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {company.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes / Description</CardTitle>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <p className="whitespace-pre-wrap text-sm">{company.description}</p>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Created {fmtDate(company.created_at)}</p>
    </div>
  );
}
