/**
 * Characterization tests — reviewable (AI review workflow, model-agnostic).
 *
 * Locks: reviewable detection, that the generated review prompt embeds PGOS week
 * context + a structured response format, and that action-item extraction parses
 * bullet/number lists and caps at eight.
 */
import { buildWeekItems } from "@/src/engine/weekLedger";
import { buildReviewPrompt, extractActionItems, isReviewable } from "@/src/engine/reviewable";

describe("reviewable · detection", () => {
  test("an item is reviewable only when flagged with a review kind", () => {
    const reviewable = buildWeekItems(19).find((i) => i.reviewable)!;
    expect(reviewable).toBeDefined();
    expect(isReviewable(reviewable)).toBe(true);

    const notReviewable = buildWeekItems(1).find((i) => i.field === "dsa")!;
    expect(isReviewable(notReviewable)).toBe(false);
  });
});

describe("reviewable · prompt building (context-rich, model-agnostic)", () => {
  const item = buildWeekItems(19).find((i) => i.reviewable && i.reviewKind === "repo-review")!;
  const prompt = buildReviewPrompt({
    kind: "repo-review",
    weekNumber: 19,
    itemTitle: item.title,
    itemDetail: item.detail,
  });

  test("embeds the current PGOS week context", () => {
    expect(prompt).toContain("week 19 of a 32-week engineering roadmap");
    expect(prompt).toContain("Week 19 theme:");
    expect(prompt).toContain("Objective:");
  });

  test("includes the kind-specific reviewer instruction", () => {
    expect(prompt).toContain("review this repository as an experienced engineer");
  });

  test("requests a structured, loggable response format", () => {
    expect(prompt).toContain("1. Strengths");
    expect(prompt).toContain("2. Weaknesses");
    expect(prompt).toContain("3. Concrete improvements");
    expect(prompt).toContain("4. Action items");
  });

  test("falls back to a generic ask for an unknown kind", () => {
    const p = buildReviewPrompt({ kind: "totally-unknown" as any, weekNumber: 5, itemTitle: "X", itemDetail: "" });
    expect(p).toContain("week 5 of a 32-week engineering roadmap");
    expect(p.length).toBeGreaterThan(0);
  });
});

describe("reviewable · action-item extraction", () => {
  test("parses '-', '•' and numbered lines; ignores prose", () => {
    const out = extractActionItems("Intro line\n- learn DI\n2. write tests\n• improve naming\nnot a bullet");
    expect(out).toEqual(["learn DI", "write tests", "improve naming"]);
  });

  test("caps at eight action items", () => {
    const many = Array.from({ length: 12 }, (_, i) => `- item ${i}`).join("\n");
    expect(extractActionItems(many).length).toBe(8);
  });

  test("returns an empty list when there are no list items", () => {
    expect(extractActionItems("just a paragraph with no bullets")).toEqual([]);
  });
});
