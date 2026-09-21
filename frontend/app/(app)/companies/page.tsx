"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyFormDialog } from "@/components/company-form";
import { useCompanies } from "@/lib/hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

export default function CompaniesPage() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const page = Number(params.get("page") ?? 1);
  const { data, isLoading } = useCompanies({ page, search, per_page: 20 });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">{data?.meta?.total ?? 0} companies</p>
        </div>
        <CompanyFormDialog />
      </div>

      <Input
        placeholder="Search companies…"
        className="w-64"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setSearch(search)}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No companies yet. Create your first one.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.industry ?? "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.location ?? "–"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/companies/${c.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data?.meta && data.meta.total_pages > 1 && (
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => router_page(page - 1, params)}>
                <ChevronLeft className="size-4" />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                Page {page} of {data.meta.total_pages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button variant="outline" size="sm" disabled={page >= data.meta.total_pages} onClick={() => router_page(page + 1, params)}>
                <ChevronRight className="size-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function router_page(page: number, params: URLSearchParams) {
  const next = new URLSearchParams(params.toString());
  next.set("page", String(page));
  window.location.search = next.toString();
}
