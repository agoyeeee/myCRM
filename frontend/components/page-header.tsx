import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: React.ReactNode; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {item.href ? (
            <a href={item.href} className="transition-colors hover:text-foreground hover:underline">
              {item.label}
            </a>
          ) : (
            <span className="truncate text-foreground/80">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
