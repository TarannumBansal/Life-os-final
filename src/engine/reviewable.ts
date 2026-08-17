/**
 * AI Review workflow — model-agnostic.
 * Detect reviewable artefacts, prepare copy-paste-ready review prompts embedding
 * PGOS week context, and expose a feedback log with feedback→task conversion.
 */
import { WeekItem, getWeekTheme, getWeekObjectives } from "./weekLedger";

export type ReviewKind =
  | "repo-review"
  | "code-quality"
  | "dsa-optimisation"
  | "system-design"
  | "architecture-review"
  | "resume-review"
  | "writing-review"
  | "portfolio-review"
  | "interview-answer"
  | "project-evaluation"
  | "pr-review";

export interface ReviewPromptInput {
  kind: ReviewKind;
  weekNumber: number;
  itemTitle: string;
  itemDetail: string;
  artefactLink?: string;
  extraContext?: string;
}

export interface FeedbackEntry {
  id: string;
  ts: number;
  updatedAt: number;
  date: string;                       // ISO
  weekNumber: number;
  itemId: string;                     // WeekItem.id
  itemTitle: string;
  kind: ReviewKind;
  artefactLink?: string;
  reviewer?: string;                  // "ChatGPT" / "Claude" / user-typed
  strengths: string;
  weaknesses: string;
  improvements: string;
  actionItems: string[];              // extracted follow-ups (may become new tasks)
  applied: boolean;
}

const KIND_LABEL: Record<ReviewKind, string> = {
  "repo-review": "Repository review",
  "code-quality": "Code quality review",
  "dsa-optimisation": "DSA optimisation review",
  "system-design": "System-design critique",
  "architecture-review": "Architecture review",
  "resume-review": "Resume review",
  "writing-review": "Writing review",
  "portfolio-review": "Portfolio review",
  "interview-answer": "Interview-answer critique",
  "project-evaluation": "Project evaluation",
  "pr-review": "Pull-request review",
};

const KIND_ASK: Record<ReviewKind, string> = {
  "repo-review":       "Please review this repository as an experienced engineer. Look at code structure, naming, README clarity, dependency choices, tests, error handling, and commit hygiene. Point out specific improvements.",
  "code-quality":      "Please do a strict code-quality review. Focus on readability, naming, function boundaries, side effects, edge cases, and idiomatic use of the language.",
  "dsa-optimisation":  "Please critique this DSA solution. Comment on correctness, time & space complexity, edge cases, and any cleaner or more optimal approaches.",
  "system-design":     "Please critique this system-design sketch. Comment on trade-offs, failure modes, scalability, data model, and what a senior engineer would push back on.",
  "architecture-review": "Please review this architecture. Comment on separation of concerns, testability, coupling, and choices I should reconsider.",
  "resume-review":     "Please review this resume as a hiring manager for entry-level AI engineering. Comment on clarity of impact, specificity of numbers, project framing, and formatting.",
  "writing-review":    "Please review this technical writing. Comment on structure, clarity, active voice, jargon, examples, and whether the target audience will understand.",
  "portfolio-review":  "Please review this portfolio page. Comment on first-impression clarity, project selection, evidence quality, and what to add/remove.",
  "interview-answer":  "Please critique this interview answer using the STAR framework. Suggest a tighter version and follow-up questions I should be ready for.",
  "project-evaluation":"Please evaluate this project end-to-end — problem framing, execution, engineering choices, documentation, and demo. Where would you push back?",
  "pr-review":         "Please review this pull request. Comment on scope, tests, review-etiquette (title, description, screenshots), and whether the change is well-scoped.",
};

export function isReviewable(item: WeekItem): boolean {
  return !!item.reviewable && !!item.reviewKind;
}

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const theme = getWeekTheme(input.weekNumber);
  const objectives = getWeekObjectives(input.weekNumber);
  const kind = input.kind;
  const ask = KIND_ASK[kind] || "Please review this work and give me specific, actionable feedback.";
  const lines: string[] = [];
  lines.push(`I'm working through week ${input.weekNumber} of a 32-week engineering roadmap.`);
  lines.push(`Week ${input.weekNumber} theme: ${theme}`);
  if (objectives.length) lines.push(`Objective: ${objectives[0]}`);
  lines.push("");
  lines.push(`Task type: ${KIND_LABEL[kind] || kind}`);
  lines.push(`What I built / wrote: ${input.itemTitle}`);
  if (input.itemDetail) lines.push(`Context from the roadmap: ${input.itemDetail}`);
  if (input.artefactLink) lines.push(`Artefact: ${input.artefactLink}`);
  if (input.extraContext) lines.push(`Extra context: ${input.extraContext}`);
  lines.push("");
  lines.push(ask);
  lines.push("");
  lines.push("Please respond in this format so I can log it:");
  lines.push("1. Strengths (3-5 bullets)");
  lines.push("2. Weaknesses (3-5 bullets)");
  lines.push("3. Concrete improvements to make now (numbered)");
  lines.push("4. Action items I should schedule as future tasks (numbered)");
  return lines.join("\n");
}

export function extractActionItems(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(?:[-*•]|\d+[.)])\s+(.+)/);
    if (m) out.push(m[1].trim());
  }
  return out.slice(0, 8);
}
