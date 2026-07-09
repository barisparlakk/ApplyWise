"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", shortLabel: "OV" },
  { href: "/applications", label: "Applications", shortLabel: "AP" },
  { href: "/jobs/new", label: "Analyze a job", shortLabel: "JB" },
  { href: "/profile", label: "Profile", shortLabel: "PR" },
  { href: "/resume", label: "CV library", shortLabel: "CV" },
  { href: "/projects", label: "Projects", shortLabel: "GH" },
  { href: "/roadmap", label: "Skill roadmap", shortLabel: "RM" },
];

type AppShellProps = {
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: Readonly<AppShellProps>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[252px] border-r border-border bg-[#10221f] px-4 py-5 text-white lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 px-2" href="/dashboard">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d7f75b] text-sm font-bold text-[#10221f]">
            AW
          </span>
          <span>
            <span className="block text-base font-semibold tracking-wide">ApplyWise</span>
            <span className="block text-xs text-[#a9c1ba]">Career intelligence</span>
          </span>
        </Link>

        <nav className="mt-10 space-y-1" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-white text-[#10221f] shadow-sm"
                    : "text-[#bed0cb] hover:bg-white/10 hover:text-white",
                )}
                href={item.href}
                key={item.href}
              >
                <span
                  className={cn(
                    "grid h-6 w-7 place-items-center rounded text-[10px] font-semibold tracking-wide",
                    active ? "bg-[#d7f75b] text-[#10221f]" : "bg-white/10 text-[#d6e4df]",
                  )}
                >
                  {item.shortLabel}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c1ba]">
            Your next move
          </p>
          <p className="mt-2 text-sm font-medium leading-5 text-white">
            Analyze a role to turn your profile into an application plan.
          </p>
          <Link
            className="mt-4 inline-flex h-9 items-center rounded-md bg-[#d7f75b] px-3 text-xs font-semibold text-[#10221f] transition hover:bg-[#e3ff82]"
            href="/jobs/new"
          >
            Analyze a job
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Link className="grid h-8 w-8 place-items-center rounded-md bg-[#10221f] text-[10px] font-bold text-[#d7f75b]" href="/dashboard">
                AW
              </Link>
              <p className="text-sm font-semibold text-foreground">ApplyWise</p>
            </div>
            <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex" aria-label="Breadcrumb">
              <span className="text-sm text-muted-foreground">Workspace</span>
              <span className="text-sm text-border">/</span>
              <span className="text-sm font-medium text-foreground">Career command center</span>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                className="hidden h-9 items-center rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:border-[#6cb5a3] hover:bg-[#f4fbf8] sm:inline-flex"
                href="/settings"
              >
                Settings
              </Link>
              <Link
                aria-label="Open settings"
                className="grid h-9 w-9 place-items-center rounded-full bg-[#e6f2ee] text-xs font-bold text-[#16675a] transition hover:bg-[#d7f75b]"
                href="/settings"
                title="Open settings"
              >
                AW
              </Link>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 lg:hidden" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                  isActive(pathname, item.href)
                    ? "bg-[#10221f] text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
