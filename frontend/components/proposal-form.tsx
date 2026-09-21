"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

import { useCreateProposalMut } from "@/lib/sales-hooks";
import { useLeads } from "@/lib/hooks";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function ProposalFormDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lead_id: "", title: "", description: "", amount: "", valid_until: "" });
  const create = useCreateProposalMut();
  const leads = useLeads({ per_page: 200 });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lead_id || !form.title) {
      toast.error("Lead and title required");
      return;
    }
    try {
      await create.mutateAsync({
        lead_id: form.lead_id,
        title: form.title,
        description: form.description || null,
        amount: Number(form.amount || 0),
        valid_until: form.valid_until || null,
        status: "draft",
      });
      setOpen(false);
      toast.success("Proposal created as draft");
      setForm({ lead_id: "", title: "", description: "", amount: "", valid_until: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 size-4" /> New Proposal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Proposal</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Lead</Label>
            <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {(leads.data?.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.company?.name ?? l.title} — {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (IDR)</Label>
              <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valid until</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create Draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
