import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import type { ApplicationData, ApplicationStatus } from "@/lib/api";
import { getApplications } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

const STATUS_COLUMNS: Array<{ status: ApplicationStatus; label: string }> = [
  { status: "saved", label: "Saved" },
  { status: "preparing", label: "Preparing" },
  { status: "applied", label: "Applied" },
  { status: "assessment", label: "Assessment" },
  { status: "interview", label: "Interview" },
  { status: "rejected", label: "Rejected" },
  { status: "offer", label: "Offer" },
  { status: "archived", label: "Archived" },
];

export default async function ApplicationsPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/applications");
  }

  const applications = await getApplications(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-[1500px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="app-kicker">Pipeline</p>
            <h1 className="app-title">Application tracker</h1>
            <p className="app-subtitle">Keep each opportunity, deadline, and follow-up visible in one working view.</p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-[#176e60]"
            href="/jobs/new"
          >
            Analyze job
          </Link>
        </div>

        <div className="mt-8 app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">All opportunities</h2>
              <p className="mt-1 text-sm text-muted-foreground">{applications.length} tracked applications</p>
            </div>
            <span className="data-chip">Table view</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[#f3f8f6] text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Deadline</th>
                  <th className="px-4 py-3 font-medium">Fit</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                  <th className="px-4 py-3 font-medium">Interview</th>
                  <th className="px-4 py-3 font-medium">Next action</th>
                </tr>
              </thead>
              <tbody>
                {applications.length ? (
                  applications.map((application) => (
                    <ApplicationRow application={application} key={application.id} />
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-8 text-muted-foreground" colSpan={8}>
                      Analyze a job and save it to start tracking applications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Pipeline board</h2>
              <p className="mt-1 text-sm text-muted-foreground">Scan work by stage and open an item to update it.</p>
            </div>
            <p className="data-chip">{applications.length} tracked</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {STATUS_COLUMNS.map((column) => {
              const items = applications.filter((item) => item.status === column.status);
              return (
                <section className="app-surface overflow-hidden" key={column.status}>
                  <div className="flex items-center justify-between border-b border-border bg-[#f8fbfa] px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                    <span className="grid h-6 min-w-6 place-items-center rounded-md bg-white px-1 text-xs font-semibold text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-3 p-3">
                    {items.length ? (
                      items.map((application) => (
                        <ApplicationCard application={application} key={application.id} />
                      ))
                    ) : (
                      <p className="px-1 py-4 text-sm text-muted-foreground">No applications</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function ApplicationRow({ application }: Readonly<{ application: ApplicationData }>) {
  return (
    <tr className="border-t border-border transition hover:bg-[#f7fbf9]">
      <td className="px-5 py-4 font-medium text-foreground">
        <Link className="font-semibold hover:text-primary" href={`/applications/${application.id}`}>
          {application.company}
        </Link>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{application.role}</td>
      <td className="px-4 py-4">
        <StatusBadge status={application.status} />
      </td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.deadline)}</td>
      <td className="px-4 py-4 font-semibold text-[#16675a]">{formatScore(application.fit_score)}</td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.applied_date)}</td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.interview_date)}</td>
      <td className="max-w-[260px] truncate px-4 py-4 text-muted-foreground">
        {application.next_action ?? "Not set"}
      </td>
    </tr>
  );
}

function ApplicationCard({ application }: Readonly<{ application: ApplicationData }>) {
  return (
    <Link
      className="block rounded-lg border border-border bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#6cb5a3] hover:shadow-md"
      href={`/applications/${application.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{application.company}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{application.role}</p>
        </div>
        <span className="text-sm font-semibold text-[#16675a]">
          {formatScore(application.fit_score)}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {application.next_action ?? "No next action"}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Deadline {formatDate(application.deadline)}</span>
        <span>{application.interview_prep_id ? "Prep ready" : "No prep"}</span>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: Readonly<{ status: ApplicationStatus }>) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusTone(status)}`}>
      {status}
    </span>
  );
}

function statusTone(status: ApplicationStatus) {
  const tones: Record<ApplicationStatus, string> = {
    saved: "bg-[#e8eefb] text-[#3b5b9f]",
    preparing: "bg-[#f0e9fb] text-[#7045a0]",
    applied: "bg-[#e6f2ee] text-[#16675a]",
    assessment: "bg-[#fff1d9] text-[#9a5d10]",
    interview: "bg-[#ffe5e4] text-[#a33e3a]",
    rejected: "bg-[#f0f1f2] text-[#5e6770]",
    offer: "bg-[#eaf7cf] text-[#49720e]",
    archived: "bg-[#f0f1f2] text-[#5e6770]",
  };
  return tones[status];
}

function formatScore(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
