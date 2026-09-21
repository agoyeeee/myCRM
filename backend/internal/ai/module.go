package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
)

type Module struct {
	q        *db.Queries
	provider Provider
}

func New(q *db.Queries, provider Provider) *Module { return &Module{q: q, provider: provider} }

func (m *Module) Mount(r chi.Router) {
	r.Post("/ai/analyze-lead/{id}", m.analyzeLead)
	r.Post("/ai/draft-outreach", m.draftOutreach)
}

func mustUser(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	uid, ok := middleware.UserIDFrom(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return uuid.Nil, false
	}
	id, err := uuid.Parse(uid)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized", "Invalid session")
		return uuid.Nil, false
	}
	return id, true
}

func ptr(t interface{ Valid() bool }) bool { return t.Valid() }

const analysisSystem = `You are a senior B2B sales analyst helping a freelance full-stack developer/IT engineer find and win clients.
Analyze the given company/lead information and respond with ONLY a JSON object with these string keys:
{"business_summary": "...", "pain_points": "...", "opportunities": "...", "suggested_service": "...", "suggested_outreach": "...", "suggested_questions": "..."}
Be concise and specific. suggested_outreach is a short first-message draft (max 120 words). No markdown fences.`

func (m *Module) analyzeLead(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	if m.provider == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "ai_not_configured", "LLM_API_KEY not set — AI features disabled")
		return
	}
	leadID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	lead, err := m.q.GetLead(ctx, db.GetLeadParams{ID: leadID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
		return
	}
	company, err := m.q.GetCompany(ctx, db.GetCompanyParams{ID: lead.CompanyID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Company not found")
		return
	}
	acts, err := m.q.ListActivities(ctx, db.ListActivitiesParams{
		UserID: userID, LeadID: &leadID, Limit: 10, Offset: 0,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	var b strings.Builder
	fmt.Fprintf(&b, "Company: %s\n", company.Name)
	if company.Website.Valid {
		fmt.Fprintf(&b, "Website: %s\n", company.Website.String)
	}
	if company.Industry.Valid {
		fmt.Fprintf(&b, "Industry: %s\n", company.Industry.String)
	}
	if company.Location.Valid {
		fmt.Fprintf(&b, "Location: %s\n", company.Location.String)
	}
	if company.Description.Valid {
		fmt.Fprintf(&b, "Description: %s\n", company.Description.String)
	}
	fmt.Fprintf(&b, "Lead title: %s\nLead status: %s\nLead priority: %s\n", lead.Title, lead.Status, lead.Priority)
	if lead.EstimatedValue.Valid {
		if v, err := lead.EstimatedValue.Float64Value(); err == nil && v.Valid {
			fmt.Fprintf(&b, "Estimated value: %.0f\n", v.Float64)
		}
	}
	if len(acts) > 0 {
		b.WriteString("Recent activities:\n")
		for _, a := range acts {
			fmt.Fprintf(&b, "- [%s] %s\n", a.Type, a.Description)
		}
	}
	if lead.Notes.Valid {
		fmt.Fprintf(&b, "Notes: %s\n", lead.Notes.String)
	}

	raw, err := m.provider.Complete(ctx, analysisSystem, b.String())
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "ai_error", "AI analysis failed: "+err.Error())
		return
	}
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	var analysis map[string]string
	if err := json.Unmarshal([]byte(clean), &analysis); err != nil {
		// fall back to raw text in one field
		analysis = map[string]string{"business_summary": clean}
	}

	if _, err := m.q.CreateAIAnalysis(ctx, db.CreateAIAnalysisParams{
		UserID: userID, LeadID: &leadID, Analysis: mustJSON(analysis),
	}); err != nil {
		httpx.Internal(w, err)
		return
	}

	_, _ = m.q.CreateActivity(ctx, db.CreateActivityParams{
		UserID: userID, LeadID: &leadID, CompanyID: &lead.CompanyID,
		Type: "other", Description: "AI analysis generated",
	})

	out := make(map[string]any, len(analysis))
	for k, v := range analysis {
		out[k] = v
	}
	httpx.Data(w, http.StatusOK, map[string]any{"analysis": out})
}

const outreachSystem = `You are an outreach copywriter for a freelance full-stack developer/IT engineer.
Write ONE short first-contact message (max 120 words) to the given lead. Professional, human, specific — mention a concrete pain point or opportunity for THEIR business. End with a light question. Output only the message text.`

func (m *Module) draftOutreach(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	if m.provider == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "ai_not_configured", "LLM_API_KEY not set — AI features disabled")
		return
	}
	var in struct {
		LeadID *string `json:"lead_id"`
	}
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}
	if in.LeadID == nil || *in.LeadID == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id is required")
		return
	}
	leadID, err := uuid.Parse(*in.LeadID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "lead_id must be a valid uuid")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	lead, err := m.q.GetLead(ctx, db.GetLeadParams{ID: leadID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Lead not found")
		return
	}
	company, err := m.q.GetCompany(ctx, db.GetCompanyParams{ID: lead.CompanyID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Company not found")
		return
	}
	contactName := "there"
	if lead.ContactID != nil {
		if c, err := m.q.GetContact(ctx, db.GetContactParams{ID: *lead.ContactID, UserID: userID}); err == nil {
			contactName = c.Name
		}
	}

	user := fmt.Sprintf("Company: %s\nIndustry: %s\nContact name: %s\nDeal: %s\nLead notes: %s",
		company.Name, company.Industry.String, contactName, lead.Title, lead.Notes.String)

	draft, err := m.provider.Complete(ctx, outreachSystem, user)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "ai_error", "AI draft failed: "+err.Error())
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"draft": strings.TrimSpace(draft)})
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
