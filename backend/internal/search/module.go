package search

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
)

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Get("/search", m.search)
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

func (m *Module) search(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		httpx.Data(w, http.StatusOK, map[string]any{})
		return
	}
	ctx := r.Context()

	companies, err := m.q.ListCompanies(ctx, db.ListCompaniesParams{
		UserID: userID, Search: pgtype.Text{String: q, Valid: true}, Limit: 5, Offset: 0,
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	contacts, err := m.q.SearchContacts(ctx, db.SearchContactsParams{UserID: userID, Column2: pgtype.Text{String: q, Valid: true}})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	leads, err := m.q.ListLeads(ctx, db.ListLeadsParams{
		UserID: userID, Search: pgtype.Text{String: q, Valid: true}, Limit: 5, Offset: 0, Sort: "created_at", Order: "desc",
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	clients, err := m.q.SearchClients(ctx, db.SearchClientsParams{UserID: userID, Column2: pgtype.Text{String: q, Valid: true}})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	projects, err := m.q.SearchProjects(ctx, db.SearchProjectsParams{UserID: userID, Column2: pgtype.Text{String: q, Valid: true}})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	activities, err := m.q.SearchActivities(ctx, db.SearchActivitiesParams{UserID: userID, Column2: pgtype.Text{String: q, Valid: true}})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	research, err := m.q.SearchResearch(ctx, db.SearchResearchParams{UserID: userID, Column2: pgtype.Text{String: q, Valid: true}})
	if err != nil {
		httpx.Internal(w, err)
		return
	}

	companiesOut := make([]map[string]any, 0, len(companies))
	for _, c := range companies {
		companiesOut = append(companiesOut, map[string]any{"id": c.ID.String(), "name": c.Name})
	}
	contactsOut := make([]map[string]any, 0, len(contacts))
	for _, c := range contacts {
		contactsOut = append(contactsOut, map[string]any{"id": c.ID.String(), "name": c.Name, "company_id": c.CompanyID.String()})
	}
	leadsOut := make([]map[string]any, 0, len(leads))
	for _, l := range leads {
		leadsOut = append(leadsOut, map[string]any{"id": l.ID.String(), "title": l.Title, "company_id": l.CompanyID.String()})
	}
	clientsOut := make([]map[string]any, 0, len(clients))
	for _, c := range clients {
		clientsOut = append(clientsOut, map[string]any{"id": c.ID.String(), "company_id": c.CompanyID.String()})
	}
	projectsOut := make([]map[string]any, 0, len(projects))
	for _, p := range projects {
		projectsOut = append(projectsOut, map[string]any{"id": p.ID.String(), "name": p.Name})
	}
	activitiesOut := make([]map[string]any, 0, len(activities))
	for _, a := range activities {
		lead := any(nil)
		if a.LeadID != nil {
			lead = a.LeadID.String()
		}
		company := any(nil)
		if a.CompanyName.Valid {
			company = a.CompanyName.String
		}
		activitiesOut = append(activitiesOut, map[string]any{
			"id": a.ID.String(), "description": a.Description, "lead_id": lead, "company_name": company,
		})
	}
	researchOut := make([]map[string]any, 0, len(research))
	for _, rr := range research {
		researchOut = append(researchOut, map[string]any{"id": rr.ID.String(), "company_name": rr.CompanyName})
	}

	httpx.Data(w, http.StatusOK, map[string]any{
		"companies": companiesOut, "contacts": contactsOut, "leads": leadsOut,
		"clients": clientsOut, "projects": projectsOut, "activities": activitiesOut,
		"research": researchOut,
	})
}
