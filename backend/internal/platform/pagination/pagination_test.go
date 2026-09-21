package pagination

import "testing"

func TestParseDefaults(t *testing.T) {
	p := Parse("", "", "", "", "")
	if p.Page != 1 || p.PerPage != 20 || p.Order != "desc" {
		t.Fatalf("defaults wrong: %+v", p)
	}
}

func TestParseLimits(t *testing.T) {
	p := Parse("3", "500", "", "asc", "hello")
	if p.Page != 3 || p.PerPage != 200 || p.Order != "asc" || p.Search != "hello" {
		t.Fatalf("got %+v", p)
	}
}

func TestOffsetAndTotalPages(t *testing.T) {
	if got := Offset(Params{Page: 3, PerPage: 20}); got != 40 {
		t.Fatalf("offset = %d", got)
	}
	if got := TotalPages(45, 20); got != 3 {
		t.Fatalf("totalPages = %d", got)
	}
	if got := TotalPages(0, 20); got != 1 {
		t.Fatalf("empty totalPages = %d", got)
	}
}
