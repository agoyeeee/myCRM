"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useCreateResearchMut } from "@/lib/sales-hooks";
import { PRIORITIES } from "@/lib/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function ResearchFormDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    website: "",
    industry: "",
    location: "",
    keyword: "",
    description: "",
    pain_point: "",
    opportunity: "",
    service: "",
    priority: "medium",
    notes: "",
  });
  const create = useCreateResearchMut();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name && !form.keyword) {
      toast.error("Company or keyword required");
      return;
    }
    try {
      await create.mutateAsync({
        company_name: form.company_name || null,
        website: form.website || null,
        industry: form.industry || null,
        location: form.location || null,
        keyword: form.keyword || null,
        description: form.description || null,
        pain_point: form.pain_point || null,
        opportunity: form.opportunity || null,
        service: form.service || null,
        priority: form.priority,
        notes: form.notes || null,
      });
      setOpen(false);
      toast.success("Research saved");
      setForm({
        company_name: "",
        website: "",
        industry: "",
        location: "",
        keyword: "",
        description: "",
        pain_point: "",
        opportunity: "",
        service: "",
        priority: "medium",
        notes: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 size-4" /> New Research
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Research Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Keyword</Label>
            <Input value={form.keyword} onChange={(e) => set("keyword", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Potential Pain Point</Label>
            <Textarea rows={2} value={form.pain_point} onChange={(e) => set("pain_point", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Potential Opportunity</Label>
            <Textarea rows={2} value={form.opportunity} onChange={(e) => set("opportunity", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Potential Service</Label>
            <Input value={form.service} onChange={(e) => set("service", e.target.value)} />
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
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
