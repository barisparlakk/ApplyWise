"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Plus,
  Route,
  SearchCheck,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLockup, BrandMark } from "@/components/brand";
import { PageMotion } from "@/components/motion";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home", group: "Workspace" },
  { href: "/applications", icon: BriefcaseBusiness, label: "Pipeline", group: "Workspace" },
  { href: "/jobs/new", icon: SearchCheck, label: "Analyze role", group: "Workspace" },
  { href: "/roadmap", icon: Route, label: "Roadmaps", group: "Workspace" },
  { href: "/profile", icon: UserRound, label: "Profile", group: "Evidence" },
  { href: "/resume", icon: FileText, label: "CV library", group: "Evidence" },
  { href: "/projects", icon: GitBranch, label: "Projects", group: "Evidence" },
];

const mobileNavigation = navigation.slice(0, 4);

type AppShellProps = {
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function pageContext(pathname: string) {
  if (pathname.startsWith("/applications")) return "Application pipeline";
  if (pathname.startsWith("/jobs")) return "Role intelligence";
  if (pathname.startsWith("/profile")) return "Candidate evidence";
  if (pathname.startsWith("/resume")) return "CV intelligence";
  if (pathname.startsWith("/projects")) return "Project evidence";
  if (pathname.startsWith("/roadmap")) return "Readiness roadmap";
  if (pathname.startsWith("/interview-prep")) return "Interview room";
  if (pathname.startsWith("/settings")) return "Workspace settings";
  return "Career command center";
}

export function AppShell({ children }: Readonly<AppShellProps>) {
  const pathname = usePathname();
  const groups = ["Workspace", "Evidence"];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-white/[0.08] bg-[#101318] text-white min-[960px]:flex min-[960px]:flex-col">
        <Link className="flex h-[76px] items-center border-b border-white/[0.08] px-5" href="/dashboard">
          <BrandLockup />
        </Link>

        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div className="mb-6" key={group}>
              <p className="px-3 text-[10px] font-semibold uppercase text-white/[0.35]">{group}</p>
              <div className="mt-2 space-y-1">
                {navigation.filter((item) => item.group === group).map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "motion-nav group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
                        active
                          ? "bg-white text-[#101318] shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
                          : "text-white/[0.62] hover:bg-white/[0.07] hover:text-white",
                      )}
                      href={item.href}
                      key={item.href}
                    >
                      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#FF5A4E]" /> : null}
                      <Icon aria-hidden="true" className={cn("h-[18px] w-[18px]", active ? "text-[#D9473F]" : "text-white/[0.44] group-hover:text-[#2BC3CE]")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.08] px-5 py-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-white/[0.38]">
            <Gauge className="h-3.5 w-3.5 text-[#2BC3CE]" />
            Next signal
          </div>
          <p className="mt-2 text-sm leading-5 text-white/[0.72]">Turn one target role into a scored action plan.</p>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#FF786D] hover:text-white" href="/jobs/new">
            Analyze a role <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      <div className="min-w-0 min-[960px]:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-border bg-white/[0.92] backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link className="min-[960px]:hidden" href="/dashboard">
                <BrandMark className="h-8 w-8" />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{pageContext(pathname)}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Evidence in, clearer decisions out</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                className="motion-control hidden h-10 items-center gap-2 rounded-md bg-[#101318] px-3.5 text-xs font-bold text-white shadow-sm hover:bg-[#282c34] sm:inline-flex"
                href="/jobs/new"
              >
                <Plus className="h-4 w-4 text-[#FF6B60]" />
                Analyze role
              </Link>
              <Link
                aria-label="Open settings"
                className={cn(
                  "motion-control grid h-10 w-10 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:border-[#a8afb8] hover:text-foreground",
                  pathname.startsWith("/settings") && "border-[#D9473F] text-[#D9473F]",
                )}
                href="/settings"
                title="Settings"
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 min-[960px]:pb-8">
          <PageMotion key={pathname}>{children}</PageMotion>
        </main>
      </div>

      <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-40 grid h-[62px] grid-cols-5 rounded-lg border border-white/[0.10] bg-[#101318]/[0.96] px-1 shadow-[0_16px_40px_rgba(16,19,24,0.28)] backdrop-blur-xl min-[960px]:hidden">
        {mobileNavigation.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold", active ? "text-white" : "text-white/[0.48]")} href={item.href} key={item.href}>
              <Icon className={cn("h-[18px] w-[18px]", active && "text-[#FF6B60]")} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <Link aria-current={["/profile", "/resume", "/projects", "/settings"].some((path) => pathname.startsWith(path)) ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold", ["/profile", "/resume", "/projects", "/settings"].some((path) => pathname.startsWith(path)) ? "text-white" : "text-white/[0.48]")} href="/profile">
          <UserRound className="h-[18px] w-[18px]" />
          <span>Evidence</span>
        </Link>
      </nav>
    </div>
  );
}
