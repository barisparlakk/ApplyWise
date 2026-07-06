import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import type { ApplicationData, ApplicationStatus } from "@/lib/api";
import { getApplications } from "@/lib/api";
import { authOptions } from "@/lib/auth";

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
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/applications");
  }

  const applications = await getApplications(session);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Applications
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Application tracker</h1>
          </div>
          <Link
            className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
            href="/jobs/new"
          >
            Analyze job
          </Link>
        </div>

        <div className="mt-8 rounded-md border border-border bg-white">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">Table</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
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
                    <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
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
            <h2 className="text-lg font-semibold text-foreground">Board</h2>
            <p className="text-sm text-muted-foreground">{applications.length} tracked</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {STATUS_COLUMNS.map((column) => {
              const items = applications.filter((item) => item.status === column.status);
              return (
                <section className="rounded-md border border-border bg-white" key={column.status}>
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
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
    </main>
  );
}

function ApplicationRow({ application }: Readonly<{ application: ApplicationData }>) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium text-foreground">
        <Link className="hover:underline" href={`/applications/${application.id}`}>
          {application.company}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{application.role}</td>
      <td className="px-4 py-3">
        <StatusBadge status={application.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(application.deadline)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatScore(application.fit_score)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(application.applied_date)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(application.interview_date)}</td>
      <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground">
        {application.next_action ?? "Not set"}
      </td>
    </tr>
  );
}

function ApplicationCard({ application }: Readonly<{ application: ApplicationData }>) {
  return (
    <Link
      className="block rounded-md border border-border px-3 py-3 hover:border-primary"
      href={`/applications/${application.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{application.company}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{application.role}</p>
        </div>
        <span className="text-sm font-semibold text-foreground">
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
    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-foreground">
      {status}
    </span>
  );
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
