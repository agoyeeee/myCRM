"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFollowUp } from "@/lib/hooks";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

export function FollowUpComposer({ leadId }: { leadId: string }) {
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateFollowUp();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dueDate) {
      toast.error("Pick a date");
      return;
    }
    await create.mutateAsync(
      { lead_id: leadId, due_date: dueDate, description: description.trim() || null },
      {
        onSuccess: () => {
          setDueDate("");
          setDescription("");
          toast.success("Follow-up scheduled");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
      <Input type="date" className="w-40" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <Input
        placeholder="Description (optional)"
        className="min-w-40 flex-1"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button type="submit" disabled={create.isPending}>
        <CalendarPlus className="mr-2 size-4" /> Schedule
      </Button>
    </form>
  );
}
