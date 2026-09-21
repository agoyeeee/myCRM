"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanies, useCreateCompany, useCreateContact, useCreateLead } from "@/lib/hooks";
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } from "@/lib/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  trigger?: React.ReactNode;
  defaultCompanyId?: string;
};

export function LeadFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    company_id: props.defaultCompanyId ?? "",
    new_company_name: "",
    new_company_website: "",
    new_company_industry: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    title: "",
    status: "research",
    priority: "medium",
    source: "manual",
    estimated_value: "",
    notes: "",
  });

  const companies = useCompanies({ per_page: 200 });
  const createLead = useCreateLead();
  const createCompany = useCreateCompany();
  const createContact = useCreateContact();
  const qc = useQueryClient();

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let companyId = form.company_id;
      if (mode === "new") {
        if (!form.new_company_name.trim()) {
          toast.error("Company name required");
          return;
        }
        const company = await createCompany.mutateAsync({
          name: form.new_company_name,
          website: form.new_company_website || null,
          industry: form.new_company_industry || null,
        });
        companyId = company.id;
        if (form.contact_name.trim()) {
          const contact = await createContact.mutateAsync({
            company_id: companyId,
            name: form.contact_name,
            email: form.contact_email || null,
            phone: form.contact_phone || null,
          });
          await createLead.mutateAsync({
            company_id: companyId,
            contact_id: contact.id,
            title: form.title || `Deal with ${company.name}`,
            status: form.status,
            priority: form.priority,
            source: form.source,
            estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
            notes: form.notes || null,
          });
          setOpen(false);
          toast.success("Lead created");
          return;
        }
      }
      if (!companyId) {
        toast.error("Select or create a company");
        return;
      }
      await createLead.mutateAsync({
        company_id: companyId,
        title: form.title || "New lead",
        status: form.status,
        priority: form.priority,
        source: form.source,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        notes: form.notes || null,
      });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      toast.success("Lead created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create lead");
    }
  }

  const trigger = props.trigger ?? (
    <Button>
      <Plus className="mr-2 size-4" /> New Lead
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <DialogDescription>Create a lead for a company you want to pursue.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
            >
              Existing company
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              New company
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={form.company_id} onValueChange={(v) => set("company_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies.data?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Company name</Label>
                <Input value={form.new_company_name} onChange={(e) => set("new_company_name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={form.new_company_website} onChange={(e) => set("new_company_website", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={form.new_company_industry} onChange={(e) => set("new_company_industry", e.target.value)} />
              </div>
            </div>
          )}

          {mode === "new" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact name (optional)</Label>
                <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Deal title</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Website revamp for PT X" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estimated value (IDR)</Label>
              <Input
                type="number"
                min="0"
                value={form.estimated_value}
                onChange={(e) => set("estimated_value", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? "Saving…" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
