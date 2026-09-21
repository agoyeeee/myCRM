import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button size="sm" className="mt-2" asChild>
          {action}
        </Button>
      )}
    </div>
  );
}

export function EmptyStateLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="contents">
      {children}
    </Link>
  );
}
