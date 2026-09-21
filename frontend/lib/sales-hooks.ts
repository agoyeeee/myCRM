import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Company, Paginated, Proposal, ResearchRecord } from "@/lib/types";

export function useProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: () => api<Paginated<Proposal>>("/proposals", { query: { per_page: 100 } }),
  });
}

export function useCreateProposalMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Proposal>("/proposals", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateProposalMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<Proposal>(`/proposals/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCompaniesList() {
  return useQuery({
    queryKey: ["companies-all"],
    queryFn: () => api<Paginated<Company>>("/companies", { query: { per_page: 200 } }),
  });
}

export function useCreateCompanyMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Company>("/companies", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompanyMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<Company>(`/companies/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", vars.id] });
    },
  });
}

export function useCreateResearchMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<ResearchRecord>("/research", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research"] }),
  });
}

export function useUpdateResearchMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<ResearchRecord>(`/research/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research"] }),
  });
}

export function useDeleteResearchMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/research/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research"] }),
  });
}
