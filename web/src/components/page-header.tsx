import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  action?: React.ReactNode;
  className?: string;
  description?: string;
  eyebrow: string;
  icon?: LucideIcon;
  title: string;
};

export function PageHeader({ action, className, description, eyebrow, icon: Icon, title }: PageHeaderProps) {
  return (
    <header className={cn("border-b border-border pb-6", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[var(--signal-coral)]" /> : null}
            <span>{eyebrow}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-[2rem]">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeading({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
