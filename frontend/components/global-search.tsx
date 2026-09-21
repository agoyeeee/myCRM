"use client";

import { useState } from "react";
import { CommandDialog, CommandInput, CommandItem, CommandList, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useGlobalSearch } from "@/lib/hooks";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ResultItem = { label: string; sub?: string; href: string };

function flattenResults(data: {
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string; company_id: string; company_name?: string | null }[];
  leads: { id: string; title: string; company?: { name: string } | null }[];
  clients: { id: string; company?: { name: string } | null }[];
  projects: { id: string; name: string }[];
  proposals: { id: string; title: string }[];
  activities: { id: string; description: string; lead_id: string | null }[];
} | undefined): ResultItem[] {
  if (!data) return [];
  const items: ResultItem[] = [];
  for (const c of data.companies) items.push({ label: c.name, sub: "Company", href: `/companies/${c.id}` });
  for (const c of data.contacts) items.push({ label: c.name, sub: `Contact — ${c.company_name ?? ""}`, href: `/companies/${c.company_id}` });
  for (const l of data.leads) items.push({ label: l.title, sub: `Lead — ${l.company?.name ?? ""}`, href: `/leads/${l.id}` });
  for (const c of data.clients) items.push({ label: c.company?.name ?? "Client", sub: "Client", href: `/clients/${c.id}` });
  for (const p of data.projects) items.push({ label: p.name, sub: "Project", href: `/projects/${p.id}` });
  for (const p of data.proposals) items.push({ label: p.title, sub: "Proposal", href: `/proposals/${p.id}` });
  for (const a of data.activities) items.push({ label: a.description, sub: "Activity", href: a.lead_id ? `/leads/${a.lead_id}` : "/activities" });
  return items.slice(0, 40);
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const { data, isFetching } = useGlobalSearch(q);
  const items = flattenResults(data);

  function go(href: string) {
    onOpenChange(false);
    setQ("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="relative">
        <CommandInput placeholder="Search companies, leads, clients…" value={q} onValueChange={setQ} />
        {isFetching && <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />}
      </div>
      <CommandList className="min-h-60">
        <CommandEmpty>{q.length < 2 ? "Type at least 2 characters" : "No results"}</CommandEmpty>
        {items.length > 0 && (
          <CommandGroup heading="Results">
            {items.map((item, i) => (
              <CommandItem key={`${item.href}-${i}`} onSelect={() => go(item.href)}>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{item.label}</span>
                  {item.sub && <span className="truncate text-xs text-muted-foreground">{item.sub}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
