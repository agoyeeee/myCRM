"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateActivity } from "@/lib/hooks";
import { ACTIVITY_TYPES } from "@/lib/types";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function LeadActivityComposer({
  leadId,
  companyId,
  contactId,
}: {
  leadId: string;
  companyId?: string | null;
  contactId?: string | null;
}) {
  const [type, setType] = useState("note");
  const [description, setDescription] = useState("");
  const create = useCreateActivity();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    await create.mutateAsync(
      {
        lead_id: leadId,
        company_id: companyId ?? undefined,
        contact_id: contactId ?? undefined,
        type,
        description: description.trim(),
      },
      {
        onSuccess: () => {
          setDescription("");
          toast.success("Activity logged");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          rows={1}
          placeholder="What happened?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-0 flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(e);
          }}
        />
        <Button type="submit" size="icon" disabled={!description.trim() || create.isPending}>
          <Send className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Cmd/Ctrl+Enter to log</p>
    </form>
  );
}
