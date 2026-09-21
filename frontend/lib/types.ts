export type Paginated<T> = { data: T[]; meta: { page: number; per_page: number; total: number; total_pages: number } };

export type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  company_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  status: string;
  priority: string;
  source: string | null;
  estimated_value: number | null;
  notes: string | null;
  next_follow_up: string | null;
  ai_analysis?: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "name"> | null;
};

export type Activity = {
  id: string;
  lead_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  type: string;
  description: string;
  created_at: string;
};

export type FollowUp = {
  id: string;
  lead_id: string;
  due_date: string;
  description: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  lead?: Lead | null;
};

export type Proposal = {
  id: string;
  lead_id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  sent_at: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  company_id: string;
  contact_id: string | null;
  lead_id: string | null;
  status: string;
  notes: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  company?: Pick<Company, "id" | "name"> | null;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  actual_revenue: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringService = {
  id: string;
  client_id: string;
  project_id: string | null;
  name: string;
  amount: number;
  billing_cycle: string;
  start_date: string | null;
  next_billing_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Revenue = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  recurring_service_id: string | null;
  amount: number;
  type: string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
};

export type ResearchRecord = {
  id: string;
  industry: string | null;
  location: string | null;
  keyword: string | null;
  company_name: string | null;
  website: string | null;
  description: string | null;
  pain_point: string | null;
  opportunity: string | null;
  service: string | null;
  priority: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OutreachTemplate = {
  id: string;
  name: string;
  category: string;
  channel: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type DashboardKPI = {
  total_leads: number;
  new_leads: number;
  followups_today: number;
  followups_overdue: number;
  active_deals: number;
  pipeline_value: number;
  monthly_revenue: number;
  mrr: number;
};

export type TodayTask = { id: string; kind: string; title: string; href?: string };

export type PipelineStage = { status: string; count: number; value: number };

export type DashboardTask = { id: string; kind: string; title: string; href?: string };

export type RecentActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  lead_id: string | null;
  company_name: string | null;
};

export type SearchResults = {
  companies: Company[];
  contacts: (Contact & { company_name: string | null })[];
  leads: Lead[];
  clients: Client[];
  projects: Project[];
  proposals: Proposal[];
  activities: (Activity & { company_name: string | null })[];
};

export type RevenueSummary = { mrr: number; outstanding: number; total: number };

export const LEAD_STATUSES = [
  "research",
  "qualified",
  "contacted",
  "replied",
  "interested",
  "meeting",
  "proposal",
  "won",
  "lost",
] as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export const LEAD_SOURCES = [
  "manual",
  "web_research",
  "referral",
  "linkedin",
  "google_maps",
  "website",
  "existing_network",
  "other",
] as const;
export const ACTIVITY_TYPES = ["note", "email", "whatsapp", "phone", "meeting", "proposal", "follow_up", "other"] as const;
export const PROPOSAL_STATUSES = ["draft", "sent", "negotiation", "accepted", "rejected", "expired"] as const;
export const CLIENT_STATUSES = ["active", "inactive", "archived"] as const;
export const PROJECT_STATUSES = ["planning", "in_progress", "review", "completed", "cancelled"] as const;
export const BILLING_CYCLES = ["monthly", "quarterly", "yearly", "custom"] as const;
export const REVENUE_TYPES = ["project", "recurring", "one_time"] as const;
export const RECURRING_STATUSES = ["active", "paused", "cancelled"] as const;
export const TEMPLATE_CATEGORIES = [
  "initial_contact",
  "follow_up_1",
  "follow_up_2",
  "after_meeting",
  "proposal",
  "lost_lead",
  "maintenance_offer",
] as const;

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
