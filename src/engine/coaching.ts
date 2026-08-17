/**
 * Weekly coaching insights (V1) — rule-based, data-backed, calm. Interprets analytics
 * into plain-language patterns. Never guilt; each insight cites a real number.
 */
import { AnalyticsInput, weeklyExecution, consistency, masteryProgress, evidenceProduced } from "./analytics";

export interface Insight { tone: "positive" | "neutral" | "watch"; text: string }

export function weeklyInsights(input: AnalyticsInput): Insight[] {
  const out: Insight[] = [];
  const weekly = weeklyExecution(input);
  const cons = consistency(input);
  const mastery = masteryProgress(input);
  const evidence = evidenceProduced(input);

  if (weekly.length >= 2) {
    const last = weekly[weekly.length - 1].pct;
    const prev = weekly[weekly.length - 2].pct;
    if (last >= prev + 10) out.push({ tone: "positive", text: `Execution rose to ${last}% this week, up from ${prev}%.` });
    else if (last <= prev - 15) out.push({ tone: "watch", text: `Execution eased to ${last}% (from ${prev}%). A lighter week is fine — consistency matters more than any single week.` });
    else out.push({ tone: "neutral", text: `Execution held steady around ${last}% this week.` });
  }

  if (cons.activeDays >= Math.round(cons.windowDays * 0.6)) {
    out.push({ tone: "positive", text: `You showed up on ${cons.activeDays} of the last ${cons.windowDays} days — that's the real engine of progress.` });
  } else if (cons.activeDays > 0) {
    out.push({ tone: "neutral", text: `Active on ${cons.activeDays} of the last ${cons.windowDays} days.` });
  }

  if (evidence.total > 0) {
    out.push({ tone: "positive", text: `${evidence.total} piece${evidence.total > 1 ? "s" : ""} of evidence logged so far — proof beats memory.` });
  }

  if (mastery.overall > 0) {
    out.push({ tone: "neutral", text: `Mastery is at ${mastery.overall}% across your competencies (tracked separately from execution).` });
  }

  return out;
}
