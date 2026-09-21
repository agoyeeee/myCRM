"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  Contact,
  CreditCard,
  FlaskConical,
  FolderKanban,
  Gauge,
  Inbox,
  KanbanSquare,
  LayoutList,
  LogOut,
  Mail,
  Bell,
  Repeat,
  Search,
  Sheet as SheetIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalSearch } from "@/components/global-search";
import { useNotifications } from "@/lib/hooks";
import { api } from "@/lib/api";
import { toast } from "sonner";

const nav = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/leads", label: "Leads", icon: LayoutList },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/follow-ups", label: "Follow-ups", icon: Inbox },
  { href: "/activities", label: "Activities", icon: Mail },
  { href: "/proposals", label: "Proposals", icon: SheetIcon },
  { href: "/clients", label: "Clients", icon: Contact },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/revenue", label: "Revenue", icon: CreditCard },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/settings", label: "Settings", icon: Bell },
];

type Me = { user: { id: string; name: string; email: string } };

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex h-12 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={onNavigate}>
          <span className="flex size-6 items-center justify-center rounded bg-foreground text-background text-xs font-bold">
            C
          </span>
          ClientOS
        </Link>
      </div>
      <ScrollArea className="flex-1 px-2">
        <nav className="flex flex-col gap-0.5 pb-4">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { data: me } = useQueryMe();
  const { data: notifications } = useNotifications();
  const unread = (notifications?.data ?? []).filter((n) => !n.read_at).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    const { setTokens } = await import("@/lib/api");
    setTokens(null);
    router.push("/login");
    toast.success("Logged out");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-52 shrink-0 border-r bg-background md:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-background">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </Button>
          <Button variant="outline" size="sm" className="w-56 justify-start gap-2 text-muted-foreground" onClick={() => setSearchOpen(true)}>
            <Search className="size-3.5" />
            Search…
            <kbd className="pointer-events-none ml-auto rounded border bg-muted px-1 font-mono text-[10px]">Ctrl K</kbd>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="relative" onClick={() => router.push("/notifications")} title="Notifications">
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1">
                  <Avatar className="size-7">
                    <AvatarFallback>{(me?.user?.name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{me?.user?.name ?? "User"}</div>
                  <div className="text-xs text-muted-foreground">{me?.user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 size-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";

function useQueryMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    retry: false,
  });
}
