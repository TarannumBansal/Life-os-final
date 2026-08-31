import { upcomingMilestone, growthStory, pendingReviews } from "@/src/engine/story";
import { buildWeekItems } from "@/src/engine/weekLedger";

describe("story · upcoming milestone", () => {
  test("returns the nearest milestone at/after the current week", () => {
    const m = upcomingMilestone(1);
    expect(m).not.toBeNull();
    expect(m!.week).toBeGreaterThanOrEqual(1);
  });
  test("late weeks still resolve to a milestone", () => {
    expect(upcomingMilestone(32)).not.toBeNull();
  });
});

describe("story · growth narrative", () => {
  test("no evidence → only the base moments are unachieved", () => {
    const story = growthStory([], []);
    expect(story.length).toBe(7);
    expect(story.every((m) => !m.achieved)).toBe(true);
  });
  test("a repo unlocks first-proof + first-repo", () => {
    const ev = [{ id: "1", type: "repo" as const, title: "x", weekNumber: 2, domain: "tech", createdAt: 0, updatedAt: 0 }];
    const story = growthStory(ev, []);
    expect(story.find((m) => m.key === "first-proof")!.achieved).toBe(true);
    expect(story.find((m) => m.key === "first-repo")!.achieved).toBe(true);
    expect(story.find((m) => m.key === "first-oss")!.achieved).toBe(false);
  });
  test("a week-17+ repo unlocks the AI-project moment", () => {
    const ev = [{ id: "1", type: "repo" as const, title: "rag", weekNumber: 19, domain: "tech", createdAt: 0, updatedAt: 0 }];
    expect(growthStory(ev, []).find((m) => m.key === "first-ai")!.achieved).toBe(true);
  });
});

describe("story · pending reviews", () => {
  test("counts completed reviewable items minus logged feedback", () => {
    const items = buildWeekItems(19);
    const reviewable = items.filter((i) => i.reviewable);
    expect(reviewable.length).toBeGreaterThan(0);
    const progress: Record<string, number> = {};
    reviewable.forEach((i) => (progress[i.id] = i.targetContributions));
    expect(pendingReviews(items, progress, 0)).toBe(reviewable.length);
    expect(pendingReviews(items, progress, reviewable.length)).toBe(0);
  });
  test("nothing completed → zero pending", () => {
    expect(pendingReviews(buildWeekItems(1), {}, 0)).toBe(0);
  });
});
