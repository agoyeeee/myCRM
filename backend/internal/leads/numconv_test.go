package leads

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestNumericFromString(t *testing.T) {
	var n pgtype.Numeric
	if err := n.Scan("15000000"); err != nil {
		t.Fatalf("string scan: %v", err)
	}
	f, e := n.Float64Value()
	if e != nil || !f.Valid || f.Float64 != 15000000 {
		t.Fatalf("got %v %v", f, e)
	}
}
