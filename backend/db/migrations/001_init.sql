-- +goose Up
-- ClientOS core schema.

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    token      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    website     TEXT,
    industry    TEXT,
    location    TEXT,
    description TEXT,
    phone       TEXT,
    email       TEXT,
    notes       TEXT,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_companies_name ON companies(name);

CREATE TABLE contacts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    job_title  TEXT,
    email      TEXT,
    phone      TEXT,
    whatsapp   TEXT,
    linkedin   TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_company ON contacts(company_id);

CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'research'
                    CHECK (status IN ('research','qualified','contacted','replied','interested','meeting','proposal','won','lost')),
    priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    source          TEXT CHECK (source IN ('manual','web_research','referral','linkedin','google_maps','website','existing_network','other')),
    estimated_value NUMERIC(14,2),
    notes           TEXT,
    next_follow_up  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_user ON leads(user_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_company ON leads(company_id);

CREATE TABLE lead_activities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    type       TEXT NOT NULL CHECK (type IN ('note','email','whatsapp','phone','meeting','proposal','follow_up','other')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_activities_company ON lead_activities(company_id, created_at DESC);

CREATE TABLE follow_ups (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    due_date     DATE NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_user_status ON follow_ups(user_id, status, due_date);

CREATE TABLE outreach_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    category   TEXT NOT NULL CHECK (category IN ('initial_contact','follow_up_1','follow_up_2','after_meeting','proposal','lost_lead','maintenance_offer')),
    channel    TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp','linkedin','phone')),
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE proposals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','negotiation','accepted','rejected','expired')),
    sent_at     TIMESTAMPTZ,
    valid_until DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposals_lead ON proposals(lead_id);

CREATE TABLE clients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id   UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
    notes        TEXT,
    converted_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_company ON clients(company_id);

CREATE TABLE projects (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'planning'
                   CHECK (status IN ('planning','in_progress','review','completed','cancelled')),
    start_date     DATE,
    end_date       DATE,
    budget         NUMERIC(14,2),
    actual_revenue NUMERIC(14,2),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_client ON projects(client_id);

CREATE TABLE recurring_services (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,
    name               TEXT NOT NULL,
    amount             NUMERIC(14,2) NOT NULL DEFAULT 0,
    billing_cycle      TEXT NOT NULL DEFAULT 'monthly'
                       CHECK (billing_cycle IN ('monthly','quarterly','yearly','custom')),
    start_date         DATE,
    next_billing_date  DATE,
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_client ON recurring_services(client_id);
CREATE INDEX idx_recurring_next_billing ON recurring_services(next_billing_date);

CREATE TABLE revenues (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id            UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id           UUID REFERENCES projects(id) ON DELETE SET NULL,
    recurring_service_id UUID REFERENCES recurring_services(id) ON DELETE SET NULL,
    amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
    type                 TEXT NOT NULL CHECK (type IN ('project','recurring','one_time')),
    occurred_at          DATE NOT NULL,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenues_user_date ON revenues(user_id, occurred_at);

CREATE TABLE research_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    industry     TEXT,
    location     TEXT,
    keyword      TEXT,
    company_name TEXT,
    website      TEXT,
    description  TEXT,
    pain_point   TEXT,
    opportunity  TEXT,
    service      TEXT,
    priority     TEXT CHECK (priority IN ('low','medium','high')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT,
    link       TEXT,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE ai_analyses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
    analysis   JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_analyses_lead ON ai_analyses(lead_id, created_at DESC);

-- +goose Down
DROP TABLE ai_analyses;
DROP TABLE notifications;
DROP TABLE research_records;
DROP TABLE revenues;
DROP TABLE recurring_services;
DROP TABLE projects;
DROP TABLE clients;
DROP TABLE proposals;
DROP TABLE outreach_templates;
DROP TABLE follow_ups;
DROP TABLE lead_activities;
DROP TABLE leads;
DROP TABLE contacts;
DROP TABLE companies;
DROP TABLE refresh_tokens;
DROP TABLE users;
