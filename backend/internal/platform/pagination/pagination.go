package pagination

import (
	"strconv"
	"strings"
)

type Params struct {
	Page    int
	PerPage int
	Sort    string
	Order   string
	Search  string
}

func Parse(page, perPage, sort, order, search string) Params {
	p := Params{Page: 1, PerPage: 20, Order: "desc"}
	if v, err := strconv.Atoi(page); err == nil && v > 0 {
		p.Page = v
	}
	if v, err := strconv.Atoi(perPage); err == nil && v > 0 {
		p.PerPage = v
	}
	if p.PerPage > 200 {
		p.PerPage = 200
	}
	if sort != "" {
		p.Sort = sort
	}
	if order == "asc" {
		p.Order = "asc"
	}
	p.Search = strings.TrimSpace(search)
	return p
}

func Offset(p Params) int {
	return (p.Page - 1) * p.PerPage
}

func TotalPages(total, perPage int) int {
	if perPage <= 0 {
		return 1
	}
	tp := total / perPage
	if total%perPage > 0 {
		tp++
	}
	if tp == 0 {
		return 1
	}
	return tp
}
