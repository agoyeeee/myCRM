"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyFormDialog } from "@/components/company-form";
import { useCompanies } from "@/lib/hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No companies yet. Create your first one.
                    </td>
                  </tr>
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.industry ?? "–"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.location ?? "–"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/companies/${c.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data?.meta && data.meta.total_pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => router_page(page - 1, params)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {data.meta.total_pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.total_pages}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function router_page(page: number, params: URLSearchParams) {
  const next = new URLSearchParams(params.toString());
  next.set("page", String(page));
  window.location.search = next.toString();
}
