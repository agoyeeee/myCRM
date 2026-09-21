package notifications

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	db "github.com/agoy/clientos/backend/db/sqlc"
	"github.com/agoy/clientos/backend/internal/platform/httpx"
	"github.com/agoy/clientos/backend/internal/platform/middleware"
	"github.com/agoy/clientos/backend/internal/platform/pagination"
)

type Module struct {
	q *db.Queries
}

func New(q *db.Queries) *Module { return &Module{q: q} }

func (m *Module) Mount(r chi.Router) {
	r.Route("/notifications", func(r chi.Router) {
		r.Get("/", m.list)
		r.Patch("/read-all", m.readAll)
		r.Patch("/{id}/read", m.markRead)
		r.Delete("/{id}", m.remove)
	})
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

func (m *Module) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	p := pagination.Parse(r.URL.Query().Get("page"), r.URL.Query().Get("per_page"), "", "", "")
	rows, err := m.q.ListNotifications(r.Context(), db.ListNotificationsParams{
		UserID: userID, Limit: int32(p.PerPage), Offset: int32(pagination.Offset(p)),
	})
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	total, err := m.q.CountNotifications(r.Context(), userID)
	if err != nil {
		httpx.Internal(w, err)
		return
	}
	data := make([]map[string]any, 0, len(rows))
	for _, n := range rows {
		readAt := any(nil)
		if n.ReadAt.Valid {
			readAt = n.ReadAt.Time
		}
		data = append(data, map[string]any{
			"id": n.ID.String(), "type": n.Type, "title": n.Title,
			"body": n.Body, "link": n.Link, "read_at": readAt, "created_at": n.CreatedAt.Time,
		})
	}
	httpx.DataWithMeta(w, http.StatusOK, data, httpx.Meta{
		Page: p.Page, PerPage: p.PerPage, Total: int(total), TotalPages: pagination.TotalPages(int(total), p.PerPage),
	})
}

func (m *Module) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	n, err := m.q.MarkNotificationRead(r.Context(), db.MarkNotificationReadParams{ID: id, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Notification not found")
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"id": n.ID.String(), "read_at": n.ReadAt.Time})
}

func (m *Module) readAll(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	if err := m.q.MarkAllNotificationsRead(r.Context(), userID); err != nil {
		httpx.Internal(w, err)
		return
	}
	httpx.Data(w, http.StatusOK, map[string]any{"ok": true})
}

func (m *Module) remove(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_id", "Invalid id")
		return
	}
	if err := m.q.DeleteNotification(r.Context(), db.DeleteNotificationParams{ID: id, UserID: userID}); err != nil {
		httpx.Internal(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
