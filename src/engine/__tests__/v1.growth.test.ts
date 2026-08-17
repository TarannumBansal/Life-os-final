/** V1 characterization tests — priority wiring, mastery, evidence, analytics, rebalance,
 *  coaching, review-loop closure, repositories. Pure-logic; run in node. */
import { buildWeekItems } from "@/src/engine/weekLedger";
import { scoreWeekItem, rankItems, PriorityCtx } from "@/src/engine/priority";
import { buildDayPlan } from "@/src/engine/planner";
import { deriveDay } from "@/src/engine/dayOrder";
import { masterySummary, allCompetencies, masteryGapForDomain } from "@/src/engine/mastery";
import { evidenceCountByType } from "@/src/engine/evidence";
import * as A from "@/src/engine/analytics";
import { weeklyInsights } from "@/src/engine/coaching";
import { rebalanceWeek } from "@/src/engine/rebalance";
import * as repo from "@/src/store/repositories";

const cfg = { anchorDate: "2026-01-05", anchorDayOrder: 1 as const, holidays: [], examDates: [] };
const monday = deriveDay("2026-01-05", cfg);
const ctx: PriorityCtx = { weekNumber: 1, mode: "full", isSunday: false, isExam: false, isSatStep: false, isCollegeHeavy: false, progress: {} };

describe("priority engine (wired)", () => {
  test("DSA is the highest-priority Week-1 item", () => {
    const items = buildWeekItems(1);
    const ranked = rankItems(items, ctx);
    expect(ranked[0].field).toBe("dsa");
  });
  test("scores are deterministic and DSA beats a weekly item", () => {
    const items = buildWeekItems(1);
    const dsa = items.find((i) => i.field === "dsa")!;
    const weekly = items.find((i) => i.cadence === "weekly")!;
    expect(scoreWeekItem(dsa, ctx)).toBeGreaterThan(scoreWeekItem(weekly, ctx));
    expect(scoreWeekItem(dsa, ctx)).toBe(scoreWeekItem(dsa, ctx));
  });
  test("planner NBA is still the protected DSA habit (0.1 invariant preserved)", () => {
    const plan = buildDayPlan("2026-01-05", 1, monday, "full", {});
    expect(plan.nextBestAction).toEqual({
      itemId: "w1:dsa", title: "DSA · foundation drill",
      reason: "DSA is protected — habit continuity beats intensity.",
    });
  });
});

describe("review-loop closure (follow-ups → planner)", () => {
  test("open follow-ups due this week appear as a review block", () => {
    const plan = buildDayPlan("2026-01-05", 1, monday, "full", {}, {
      followUps: [{ id: "f1", title: "Improve variable naming", dueWeek: 1, done: false }],
    });
    const fu = plan.blocks.find((b) => b.id === "b-followups");
    expect(fu).toBeDefined();
    expect(fu!.tasks[0].title).toBe("Improve variable naming");
  });
  test("no follow-up block when none supplied (0.1 behaviour preserved)", () => {
    const plan = buildDayPlan("2026-01-05", 1, monday, "full", {});
    expect(plan.blocks.some((b) => b.id === "b-followups")).toBe(false);
  });
  test("done or future-week follow-ups do not appear", () => {
    const plan = buildDayPlan("2026-01-05", 1, monday, "full", {}, {
      followUps: [
        { id: "f2", title: "done one", dueWeek: 1, done: true },
        { id: "f3", title: "future one", dueWeek: 9, done: false },
      ],
    });
    expect(plan.blocks.some((b) => b.id === "b-followups")).toBe(false);
  });
});

describe("mastery model", () => {
  test("competencies are derived from DOMAIN_SYLLABI", () => {
    expect(allCompetencies().length).toBeGreaterThan(0);
  });
  test("summary treats execution and mastery as distinct (empty = 0%)", () => {
    expect(masterySummary([]).pct).toBe(0);
    expect(masteryGapForDomain([], "tech")).toBeGreaterThan(0);
  });
  test("strong + demonstrated raise pct correctly", () => {
    const comps = allCompetencies().filter((c) => c.domain === "tech").slice(0, 2);
    const recs = comps.map((c, i) => ({ id: c.id, domain: "tech", competency: c.label, state: (i === 0 ? "strong" : "demonstrated") as any, updatedAt: 0 }));
    const s = masterySummary(recs, "tech");
    expect(s.strong).toBe(1);
    expect(s.demonstrated).toBe(1);
  });
});

describe("evidence + analytics + coaching + rebalance", () => {
  const input: A.AnalyticsInput = {
    roadmapStartDate: "2026-01-05", todayISO: "2026-01-19", currentWeek: 3,
    itemProgress: { "w1:dsa": 6, "w2:dsa": 3 },
    completions: [
      { date: "2026-01-15", completedAt: new Date("2026-01-15").getTime() },
      { date: "2026-01-16", completedAt: new Date("2026-01-16").getTime() },
    ],
    mastery: [], evidence: [
      { id: "e1", type: "repo", title: "x", weekNumber: 1, domain: "tech", createdAt: 0, updatedAt: 0 },
    ], feedbackLog: [{ createdAt: 0 }],
  };
  test("weekly execution is bounded 0..100 and length matches currentWeek", () => {
    const w = A.weeklyExecution(input);
    expect(w.length).toBe(3);
    w.forEach((x) => { expect(x.pct).toBeGreaterThanOrEqual(0); expect(x.pct).toBeLessThanOrEqual(100); });
  });
  test("phase progress returns 4 phases", () => {
    expect(A.phaseProgress(input).length).toBe(4);
  });
  test("evidence + counts", () => {
    expect(A.evidenceProduced(input).total).toBe(1);
    expect(evidenceCountByType(input.evidence).repo).toBe(1);
  });
  test("consistency counts distinct active days", () => {
    expect(A.consistency(input).activeDays).toBe(2);
  });
  test("summary + insights are produced without throwing", () => {
    const sum = A.analyticsSummary(input);
    expect(sum.currentWeek).toBe(3);
    expect(Array.isArray(weeklyInsights(input))).toBe(true);
  });
  test("rebalance spreads remaining work across remaining days", () => {
    const items = buildWeekItems(1);
    const plan = rebalanceWeek(items, { "w1:dsa": 2 }, 2, ctx);
    expect(plan.remainingDays).toBe(5);
    const dsa = plan.perDayTargets.find((t) => t.itemId === "w1:dsa")!;
    expect(dsa.remaining).toBe(4); // target 6 - 2 done
    expect(plan.note).toMatch(/Rebalanced across 5 days/);
  });
});

describe("repositories (pure CRUD)", () => {
  const base: any = {
    itemProgress: {}, completions: [], journal: [], followUps: [], mastery: [], evidence: [],
    roadmapStartDate: "2026-01-05",
  };
  test("logContribution increments and never goes negative", () => {
    let s = repo.logContribution(base, "w1:dsa", 1);
    expect(s.itemProgress["w1:dsa"]).toBe(1);
    s = repo.logContribution(s, "w1:dsa", -5);
    expect(s.itemProgress["w1:dsa"]).toBe(0);
  });
  test("evidence add/remove", () => {
    let s = repo.addEvidence(base, { type: "repo", title: "t", weekNumber: 1, domain: "tech" });
    expect(s.evidence.length).toBe(1);
    s = repo.removeEvidence(s, s.evidence[0].id);
    expect(s.evidence.length).toBe(0);
  });
  test("mastery set + update", () => {
    let s = repo.setMastery(base, "tech:x", "tech", "X", "demonstrated");
    expect(s.mastery[0].state).toBe("demonstrated");
    s = repo.setMastery(s, "tech:x", "tech", "X", "strong");
    expect(s.mastery.length).toBe(1);
    expect(s.mastery[0].state).toBe("strong");
  });
  test("follow-up done + open filter", () => {
    let s = repo.upsertFollowUps(base, [{ id: "f1", fromFeedbackId: "x", title: "t", dueWeek: 1, done: false, createdAt: 0, updatedAt: 0 }]);
    expect(repo.openFollowUps(s, 1).length).toBe(1);
    s = repo.setFollowUpDone(s, "f1", true);
    expect(repo.openFollowUps(s, 1).length).toBe(0);
  });
  test("export/import round-trips", () => {
    const s = repo.addEvidence(base, { type: "note", title: "n", weekNumber: 1, domain: "tech" });
    const json = repo.exportData(s as any);
    const back = repo.importData(json);
    expect(back?.evidence.length).toBe(1);
    expect(repo.importData("garbage")).toBeNull();
  });
});
