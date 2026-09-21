import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project, RecurringService, Revenue } from "@/lib/types";

export function useProjectsList() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ data: Project[] }>("/projects", { query: { per_page: 100 } }),
  });
}

export function useRecurringList() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: () => api<{ data: RecurringService[] }>("/recurring-services", { query: { per_page: 100 } }),
  });
}

export function useRevenueList() {
  return useQuery({
    queryKey: ["revenue"],
    queryFn: () => api<{ data: Revenue[]; summary?: Record<string, number> }>("/revenue", { query: { per_page: 100 } }),
  });
}

export function useCreateProjectMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Project>("/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProjectMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<Project>(`/projects/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateRecurringMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<RecurringService>("/recurring-services", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateRecurringMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<RecurringService>(`/recurring-services/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateRevenueMut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Revenue>("/revenue", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
