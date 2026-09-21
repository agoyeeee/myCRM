import { api } from "@/lib/api";
import type { Company, Contact, Lead, Paginated, Project, RecurringService } from "@/lib/types";

export const leadsApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<Lead>>("/leads", { query: params }),
  get: (id: string) => api<Lead>(`/leads/${id}`),
  create: (body: Partial<Lead> & { company_id: string; title: string }) => api<Lead>("/leads", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) => api<Lead>(`/leads/${id}`, { method: "PATCH", body }),
  delete: (id: string) => api<void>(`/leads/${id}`, { method: "DELETE" }),
  convert: (id: string) => api<{ id: string }>(`/leads/${id}/convert`, { method: "POST" }),
};

export const companiesApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<Company>>("/companies", { query: params }),
  get: (id: string) => api<Company>(`/companies/${id}`),
  create: (body: Partial<Company> & { name: string }) => api<Company>("/companies", { method: "POST", body }),
  update: (id: string, body: Record<string, unknown>) => api<Company>(`/companies/${id}`, { method: "PATCH", body }),
};

export const contactsApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<Contact>>("/contacts", { query: params }),
  create: (body: Partial<Contact> & { company_id: string; name: string }) => api<Contact>("/contacts", { method: "POST", body }),
};

export const followUpsApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<import("@/lib/types").FollowUp>>("/follow-ups", { query: params }),
};

export const proposalsApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<import("@/lib/types").Proposal>>("/proposals", { query: params }),
};

export const projectsApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<Project>>("/projects", { query: params }),
};

export const recurringApi = {
  list: (params?: Record<string, string | number>) => api<Paginated<RecurringService>>("/recurring-services", { query: params }),
};
