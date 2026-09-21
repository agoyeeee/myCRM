import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contact, Paginated } from "@/lib/types";

export function useContactsList(companyId?: string) {
  return useQuery({
    queryKey: ["contacts", companyId],
    queryFn: () => api<Paginated<Contact>>("/contacts", { query: { company_id: companyId, per_page: 100 } }),
    enabled: true,
  });
}
