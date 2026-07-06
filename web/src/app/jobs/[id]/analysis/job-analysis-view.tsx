import type { JobPostData } from "@/lib/api";

type JobAnalysisViewProps = {
  jobPost: JobPostData;
};

export function JobAnalysisView({ jobPost }: JobAnalysisViewProps) {
  const analysis = jobPost.analysis;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Job Analysis
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{jobPost.title}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Company" value={jobPost.company_name} />
            <Metric label="Seniority" value={analysis.seniority_level} />
            <Metric label="Domain" value={analysis.domain} />
            <Metric label="Difficulty" value={analysis.technical_difficulty} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ListPanel items={analysis.required_skills} title="Required skills" />
          <ListPanel items={analysis.nice_to_have_skills} title="Nice-to-have skills" />
          <ListPanel items={analysis.responsibilities} title="Responsibilities" />
          <ListPanel items={analysis.hidden_expectations} title="Hidden expectations" />
          <ListPanel items={analysis.business_expectations} title="Business expectations" />
          <ListPanel
            items={analysis.communication_expectations}
            title="Communication expectations"
          />
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Signals</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="English" value={analysis.english_requirement} />
            <SummaryItem label="Source" value={jobPost.source ?? "manual"} />
            <SummaryItem label="Location" value={jobPost.location ?? "Not specified"} />
          </dl>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Raw post</h2>
          <pre
            className={
              "mt-4 max-h-[640px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground"
            }
          >
            {jobPost.description}
          </pre>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function ListPanel({ items, title }: Readonly<{ items: string[]; title: string }>) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>Not specified</li>}
      </ul>
    </div>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
