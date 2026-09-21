import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Activity,
  TodayTask,
  Company,
  Contact,
  DashboardKPI,
  FollowUp,
  Lead,
  Notification,
  OutreachTemplate,
  Paginated,
  PipelineStage,
  RecentActivity,
  RecurringService,
  ResearchRecord,
  SearchResults,
} from "@/lib/types";

export const keys = {
  leads: (params?: Record<string, string>) => ["leads", params] as const,
  lead: (id: string) => ["lead", id] as const,
  activities: (params?: Record<string, string>) => ["activities", params] as const,
  followups: (params?: Record<string, string>) => ["followups", params] as const,
  companies: (params?: Record<string, string>) => ["companies", params] as const,
  company: (id: string) => ["company", id] as const,
  contacts: (companyId?: string) => ["contacts", companyId] as const,
  dashboard: () => ["dashboard"] as const,
  pipeline: () => ["pipeline"] as const,
  notifications: () => ["notifications"] as const,
  templates: () => ["templates"] as const,
  search: (q: string) => ["search", q] as const,
  clients: (params?: Record<string, string>) => ["clients", params] as const,
  projects: (params?: Record<string, string>) => ["projects", params] as const,
  recurring: (params?: Record<string, string>) => ["recurring", params] as const,
  revenue: (params?: Record<string, string>) => ["revenue", params] as const,
  research: () => ["research"] as const,
};

export function useLeads(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.leads(params as Record<string, string>),
    queryFn: () => api<Paginated<Lead>>("/leads", { query: params }),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: keys.lead(id),
    queryFn: () => api<Lead>(`/leads/${id}`),
    enabled: Boolean(id),
  });
}

export function useActivities(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.activities(params as Record<string, string>),
    queryFn: () => api<Paginated<Activity>>("/activities", { query: params }),
    enabled: Object.keys(params).length > 0,
  });
}

export function useFollowUps(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.followups(params as Record<string, string>),
    queryFn: () => api<Paginated<FollowUp>>("/follow-ups", { query: params }),
  });
}

export function useCompanies(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.companies(params as Record<string, string>),
    queryFn: () => api<Paginated<Company>>("/companies", { query: params }),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: keys.company(id),
    queryFn: () => api<Company>(`/companies/${id}`),
    enabled: Boolean(id),
  });
}

export function useContacts(companyId?: string) {
  return useQuery({
    queryKey: keys.contacts(companyId),
    queryFn: () =>
      api<Paginated<Contact>>("/contacts", { query: { company_id: companyId, per_page: 100 } }),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard(),
    queryFn: () =>
      api<{ kpi: DashboardKPI; pipeline: PipelineStage[]; recent_activity: RecentActivity[]; today_tasks: TodayTask[] }>("/dashboard"),
    refetchInterval: 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications(),
    queryFn: () => api<Paginated<Notification>>("/notifications"),
    refetchInterval: 30_000,
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates(),
    queryFn: () => api<Paginated<OutreachTemplate>>("/outreach-templates", { query: { per_page: 100 } }),
  });
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => api<SearchResults>("/search", { query: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 5_000,
  });
}

export function useClients(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.clients(params as Record<string, string>),
    queryFn: () => api<Paginated<ClientT>>("/clients", { query: params }),
  });
}

export type ClientT = import("@/lib/types").Client;

export function useProjects(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.projects(params as Record<string, string>),
    queryFn: () => api<Paginated<import("@/lib/types").Project>>("/projects", { query: params }),
  });
}

export function useRecurring(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.recurring(params as Record<string, string>),
    queryFn: () => api<Paginated<RecurringService>>("/recurring-services", { query: params }),
  });
}

export function useRevenue(params: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: keys.revenue(params as Record<string, string>),
    queryFn: () =>
      api<Paginated<import("@/lib/types").Revenue> & { summary: import("@/lib/types").RevenueSummary }>("/revenue", {
        query: params,
      }),
  });
}

export function useResearch() {
  return useQuery({
    queryKey: keys.research(),
    queryFn: () => api<Paginated<ResearchRecord>>("/research", { query: { per_page: 100 } }),
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: keys.pipeline(),
    queryFn: () => api<{ stages: PipelineStage[] }>("/pipeline"),
  });
}

type MutOpts = { invalidate?: readonly unknown[][] };

export function useCreateLead(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Lead>("/leads", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateLead(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<Lead>(`/leads/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.lead(vars.id) });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useDeleteLead(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateActivity(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Activity>("/activities", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateFollowUp(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<FollowUp>("/follow-ups", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateFollowUp(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<FollowUp>(`/follow-ups/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateCompany(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Company>("/companies", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateCompany(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<Company>(`/companies/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.company(vars.id) });
      qc.invalidateQueries({ queryKey: ["companies"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateContact(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Contact>("/contacts", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateProposal(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<import("@/lib/types").Proposal>("/proposals", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateProposal(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<import("@/lib/types").Proposal>(`/proposals/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useConvertLead(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => api<ClientT>(`/leads/${leadId}/convert`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateClient(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<ClientT>("/clients", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateProject(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<import("@/lib/types").Project>("/projects", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateProject(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<import("@/lib/types").Project>(`/projects/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateRecurring(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<RecurringService>("/recurring-services", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateRecurring(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<RecurringService>(`/recurring-services/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateRevenue(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<import("@/lib/types").Revenue>("/revenue", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useCreateResearch(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ResearchRecord & { lead_id?: string }>("/research", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["research"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useUpdateResearch(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api<ResearchRecord>(`/research/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["research"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useDeleteResearch(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/research/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["research"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useAnalyzeLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) =>
      api<{ analysis: Record<string, string> }>(`/ai/analyze-lead/${leadId}`, { method: "POST" }),
    onSuccess: (_d, leadId) => {
      qc.invalidateQueries({ queryKey: keys.lead(leadId) });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useDraftOutreach() {
  return useMutation({
    mutationFn: (body: { lead_id?: string; context?: Record<string, unknown> }) =>
      api<{ draft: string }>("/ai/draft-outreach", { method: "POST", body }),
  });
}

export function useSaveTemplate(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<OutreachTemplate>("/outreach-templates", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useDeleteTemplate(opts?: MutOpts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/outreach-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      opts?.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
