import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Flag,
  GitBranch,
  Route,
} from "lucide-react";

import { MotionBar } from "@/components/motion";
import type { SkillGraphData, SkillPathNodeData } from "@/lib/api";
import { createTranslator, type Translator } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server-i18n";

type SkillGraphPanelProps = {
  embedded?: boolean;
  graph: SkillGraphData;
};

export async function SkillGraphPanel({ embedded = false, graph }: SkillGraphPanelProps) {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  const readiness = Math.max(0, Math.min(100, graph.readiness_percent));

  return (
    <section className={embedded ? "border-t border-border" : "app-surface overflow-hidden"}>
      <header className="flex flex-col gap-5 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#D9473F]">
            <GitBranch className="h-3.5 w-3.5" />
            {t("Skill readiness graph")}
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">{t("Shortest path to role readiness")}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("Prerequisite paths connect your verified skills to this role's required capabilities.")}
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-52">
          <div className="flex items-end justify-between gap-3">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">{t("Graph readiness")}</span>
            <span className="text-2xl font-bold text-foreground">{Math.round(readiness)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eceef1]">
            <MotionBar className={readiness >= 75 ? "bg-[#2BC3CE]" : readiness >= 50 ? "bg-[#F0A13A]" : "bg-[#FF5A4E]"} value={readiness} />
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 divide-y divide-border">
          {graph.paths.length ? graph.paths.map((path) => (
            <article className="p-5 sm:p-6" key={path.target_skill}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {path.ready ? <CheckCircle2 className="h-4 w-4 text-[#167D87]" /> : <Route className="h-4 w-4 text-[#D9473F]" />}
                  {path.target_skill}
                </h3>
                <span className={path.ready ? "rounded-sm bg-[#e8f8f7] px-2 py-1 text-[10px] font-bold uppercase text-[#167D87]" : "rounded-sm bg-[#fff3e5] px-2 py-1 text-[10px] font-bold uppercase text-[#A85C00]"}>
                  {path.ready ? t("Ready") : t("Path open")}
                </span>
              </div>
              <div className="mt-4 overflow-x-auto pb-2">
                <div className="flex min-w-max items-center" role="list">
                  {path.nodes.map((node, index) => (
                    <div className="flex items-center" key={`${path.target_skill}-${node.name}`} role="listitem">
                      {index > 0 ? (
                        <div aria-hidden="true" className="flex w-12 items-center text-border sm:w-16">
                          <span className="h-px flex-1 bg-current" />
                          <ArrowRight className="-ml-px h-4 w-4" />
                        </div>
                      ) : null}
                      <SkillNode node={node} t={t} />
                    </div>
                  ))}
                </div>
              </div>
            </article>
          )) : (
            <div className="p-6 text-sm text-muted-foreground">{t("No mapped skill requirements are available for this role.")}</div>
          )}
        </div>

        <aside className="border-t border-border bg-[#f8f9fa] p-5 sm:p-6 xl:border-l xl:border-t-0">
          <h3 className="text-xs font-bold uppercase text-foreground">{t("Recommended sequence")}</h3>
          {graph.recommended_sequence.length ? (
            <ol className="mt-4 space-y-3">
              {graph.recommended_sequence.map((skill, index) => (
                <li className="grid grid-cols-[28px_1fr] items-center gap-3 text-sm font-semibold text-foreground" key={skill}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#101318] text-[10px] font-bold text-white">{index + 1}</span>
                  <span>{skill}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("Every mapped target skill already has direct evidence.")}</p>
          )}

          <div className="mt-7 border-t border-border pt-5">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">{t("Legend")}</p>
            <div className="mt-3 space-y-2.5 text-xs font-semibold text-muted-foreground">
              <LegendItem className="bg-[#167D87]" label={t("Verified evidence")} />
              <LegendItem className="bg-[#F0A13A]" label={t("Prerequisite gap")} />
              <LegendItem className="bg-[#FF5A4E]" label={t("Role target")} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SkillNode({ node, t }: Readonly<{ node: SkillPathNodeData; t: Translator }>) {
  const styles = {
    known: "border-[#167D87]/30 bg-[#e8f8f7] text-[#11666D]",
    missing: "border-[#F0A13A]/40 bg-[#fff7eb] text-[#8A4D05]",
    target: "border-[#FF5A4E]/40 bg-[#fff1f0] text-[#B83C34]",
  }[node.status];
  const Icon = node.status === "known" ? CheckCircle2 : node.status === "target" ? Flag : CircleDashed;
  const label = node.status === "known" ? t("Known") : node.status === "target" ? t("Target") : t("Missing");

  return (
    <div className={`flex h-[72px] w-36 flex-col justify-center rounded-md border px-3 ${styles}`}>
      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase opacity-75"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className="mt-1 line-clamp-2 text-xs font-bold leading-4">{node.name}</span>
    </div>
  );
}

function LegendItem({ className, label }: Readonly<{ className: string; label: string }>) {
  return <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${className}`} />{label}</div>;
}
