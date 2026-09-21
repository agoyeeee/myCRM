package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// Response envelope: every success/error follows { data } / { error }.
type Response struct {
	Data  any     `json:"data,omitempty"`
	Meta  *Meta   `json:"meta,omitempty"`
	Error *ErrObj `json:"error,omitempty"`
}

type Meta struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

type ErrObj struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

func Data(w http.ResponseWriter, status int, data any) {
	WriteJSON(w, status, Response{Data: data})
}

func DataWithMeta(w http.ResponseWriter, status int, data any, meta Meta) {
	WriteJSON(w, status, Response{Data: data, Meta: &meta})
}

func Error(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, Response{Error: &ErrObj{Code: code, Message: message}})
}

func MethodNotAllowed(w http.ResponseWriter) {
	Error(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
}

func DecodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

func LogAndError(w http.ResponseWriter, status int, code, message string, err error) {
	if err != nil {
		slog.Error("request failed", "code", code, "err", err)
	} else {
		slog.Error("request failed", "code", code)
	}
	Error(w, status, code, message)
}

func Internal(w http.ResponseWriter, err error) {
	slog.Error("internal error", "err", err)
	Error(w, http.StatusInternalServerError, "internal", "Something went wrong")
}

var ErrValidation = errors.New("validation error")
