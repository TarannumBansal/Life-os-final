/**
 * Motivational layer (V1.1) — stable ritual messages + a contextual quote. Pure, offline,
 * deterministic. Creates no tasks and never touches PGOS. Quotes are either well-attributed
 * public-domain lines or original LifeOS lines — nothing fabricated, none over ~15 words.
 */
export type Moment = "morning" | "afternoon" | "completion";

/** Stable ritual messages — intentionally repeatable, recognised over time. */
export const STABLE: Record<Moment, string> = {
  morning: "Good morning. Something beautiful can begin today. Start where you are.",
  afternoon: "You're doing well. Keep going, one meaningful thing at a time.",
  completion: "Today's work is done. You showed up for yourself.",
};

export type Ctx =
  | "first-day" | "new-week" | "new-phase" | "returning" | "difficult" | "recovery"
  | "flex" | "exam" | "milestone" | "learning" | "consistency" | "completion" | "default";

export interface Quote { text: string; author: string | null } // author null = original LifeOS line

// Curated pool. Public-domain attributions kept short; the rest are original LifeOS lines.
const POOL: Record<Ctx, Quote[]> = {
  "first-day": [
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "The beginning is the most important part of the work.", author: "Plato" },
    { text: "Begin, and the rest is momentum.", author: null },
  ],
  "new-week": [
    { text: "It does not matter how slowly you go so long as you do not stop.", author: "Confucius" },
    { text: "A new week is just the next stretch of the same road.", author: null },
  ],
  "new-phase": [
    { text: "Every next level of your life demands a different you.", author: null },
    { text: "Growth is the only evidence of life.", author: "John Henry Newman" },
  ],
  "returning": [
    { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
    { text: "You're not starting over; you're continuing.", author: null },
  ],
  "difficult": [
    { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
    { text: "Hard days are how quiet strength is built.", author: null },
  ],
  "recovery": [
    { text: "Rest is not idleness; it is repair.", author: null },
    { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
  ],
  "flex": [
    { text: "The reed that bends in the wind is stronger than the oak.", author: null },
    { text: "A sustainable pace beats a heroic sprint.", author: null },
  ],
  "milestone": [
    { text: "We are what we repeatedly do.", author: "Will Durant" },
    { text: "Something you built now exists that did not before.", author: null },
  ],
  "learning": [
    { text: "I have no special talent. I am only passionately curious.", author: "Albert Einstein" },
    { text: "Understanding is the reward for staying with the hard part.", author: null },
  ],
  "consistency": [
    { text: "Little strokes fell great oaks.", author: "Benjamin Franklin" },
    { text: "Consistency is the quiet engine under every result.", author: null },
  ],
  "completion": [
    { text: "Well done is better than well said.", author: "Benjamin Franklin" },
    { text: "You did what you set out to do today. Let that be enough.", author: null },
  ],
  "default": [
    { text: "One meaningful thing, done well, is a full day's worth.", author: null },
    { text: "Do the next right thing.", author: null },
  ],
};

export interface MotivationState {
  isFirstDay?: boolean; isNewWeek?: boolean; isNewPhase?: boolean; returning?: boolean;
  isFlex?: boolean; isExam?: boolean; hitMilestone?: boolean; recovered?: boolean;
  weekExecutionPct?: number; todayComplete?: boolean;
}

/** Detect the most relevant context from real LifeOS state (no scores exposed). */
export function detectContext(st: MotivationState, moment: Moment): Ctx {
  if (moment === "completion") {
    if (st.isFlex) return "flex";
    if (st.hitMilestone) return "milestone";
    if (st.recovered) return "recovery";
    return "completion";
  }
  if (st.isFirstDay) return "first-day";
  if (st.isExam) return "difficult";
  if (st.isFlex) return "flex";
  if (st.isNewPhase) return "new-phase";
  if (st.isNewWeek) return "new-week";
  if (st.returning) return "returning";
  if (st.recovered) return "recovery";
  if (moment === "afternoon" && (st.weekExecutionPct ?? 100) < 30) return "difficult";
  if (st.hitMilestone) return "milestone";
  return "default";
}

/** Deterministic daily pick within a context (varies by date, stable within a day). */
export function pickQuote(ctx: Ctx, dateISO: string): Quote {
  const pool = POOL[ctx] ?? POOL.default;
  const seed = [...dateISO].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

export function motivationFor(moment: Moment, st: MotivationState, dateISO: string): { stable: string; quote: Quote; context: Ctx } {
  const context = detectContext(st, moment);
  return { stable: STABLE[moment], quote: pickQuote(context, dateISO), context };
}
