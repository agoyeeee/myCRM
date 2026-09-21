"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
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
  Menu,
  Repeat,
  Search,
  ScrollText,
  Settings,
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
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: Gauge },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/follow-ups", label: "Follow-ups", icon: Inbox },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: LayoutList },
      { href: "/proposals", label: "Proposals", icon: SheetIcon },
      { href: "/clients", label: "Clients", icon: Contact },
    ],
  },
  {
    label: "Directory",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/contacts", label: "Contacts", icon: Contact },
      { href: "/activities", label: "Activities", icon: Mail },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/recurring", label: "Recurring", icon: Repeat },
      { href: "/revenue", label: "Revenue", icon: CreditCard },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/research", label: "Research", icon: FlaskConical },
      { href: "/templates", label: "Templates", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

type Me = { user: { id: string; name: string; email: string } };

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight" onClick={onNavigate}>
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            C
          </span>
          ClientOS
        </Link>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav aria-label="Main navigation" className="flex flex-col gap-4 pb-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.label && <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{group.label}</p>}
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-accent font-medium text-accent-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
      <aside className="hidden w-56 shrink-0 border-r bg-card md:block">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-card shadow-xl">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full max-w-xs justify-start gap-2 text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-3.5" />
            Search…
            <kbd className="pointer-events-none ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="relative" onClick={() => router.push("/notifications")} title="Notifications" aria-label="Notifications">
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="ml-1 h-9 gap-2 px-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs">{(me?.user?.name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{me?.user?.name ?? "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{me?.user?.name ?? "User"}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">{me?.user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={logout}>
                  <LogOut className="mr-2 size-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function useQueryMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    retry: false,
  });
}
