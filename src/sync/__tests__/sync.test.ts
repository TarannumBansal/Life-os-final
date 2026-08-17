/** Cross-device sync tests — merge, serialize/apply round-trip, offline-first, and the
 *  concurrency scenarios from the acceptance spec. All deterministic; no real network. */
import { mergeRecords } from "@/src/sync/merge";
import { syncOnce } from "@/src/sync/queue";
import { MemoryProvider } from "@/src/sync/provider.memory";
import { nextStatus, statusLabel } from "@/src/sync/status";
import { intrinsicRecords, diffToRecords, applyRecordsToSettings, itemProgressRecords } from "@/src/sync/serialize";
import type { SyncRecord } from "@/src/sync/types";

const rec = (table: string, id: string, updatedAt: number, payload: any = {}, deletedAt?: number): SyncRecord => ({ table, id, updatedAt, payload, deletedAt });

describe("merge · LWW + tombstones", () => {
  test("newer record wins on the same key", () => {
    const { merged } = mergeRecords([rec("journal", "j1", 100, { text: "old" })], [rec("journal", "j1", 200, { text: "new" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].payload.text).toBe("new");
  });
  test("distinct records from both devices both survive (Test 8)", () => {
    const local = [rec("completions", "d1|tA", 100)];
    const remote = [rec("mastery", "tech:x", 100)];
    const { merged } = mergeRecords(local, remote);
    expect(merged).toHaveLength(2);
  });
  test("server-missing local record is queued to push", () => {
    const { toPush } = mergeRecords([rec("evidence", "e1", 100)], []);
    expect(toPush.map((r) => r.id)).toEqual(["e1"]);
  });
  test("remote-only record is adopted, not pushed", () => {
    const { merged, toPush } = mergeRecords([], [rec("evidence", "e2", 100)]);
    expect(merged).toHaveLength(1);
    expect(toPush).toHaveLength(0);
  });
  test("newer tombstone deletes; deleted record does not reappear", () => {
    const { merged } = mergeRecords([rec("journal", "j1", 100, { text: "x" })], [rec("journal", "j1", 200, {}, 200)]);
    expect(merged[0].deletedAt).toBe(200);
  });
});

describe("syncOnce · phone → cloud → laptop", () => {
  test("Test 2/3: a change on one device reaches the other via the cloud", async () => {
    const cloud = new MemoryProvider();
    // Phone completes Task A → pushes.
    const phoneLocal = [rec("completions", "2026-01-05|t-dsa", 1000, { done: true })];
    const r1 = await syncOnce(cloud, phoneLocal, 0);
    expect(r1.offline).toBe(false);
    expect(cloud.all()).toHaveLength(1);
    // Laptop (empty) pulls → receives Task A.
    const r2 = await syncOnce(cloud, [], 0);
    expect(r2.merged.map((r) => r.id)).toContain("2026-01-05|t-dsa");
  });
});

describe("syncOnce · offline-first (Test 4/5/7)", () => {
  test("offline pull keeps local data and reports offline", async () => {
    const cloud = new MemoryProvider(); cloud.setOnline(false);
    const local = [rec("journal", "j1", 500, { text: "written offline" })];
    const r = await syncOnce(cloud, local, 0);
    expect(r.offline).toBe(true);
    expect(r.merged).toEqual(local);      // never lost
    expect(cloud.all()).toHaveLength(0);
  });
  test("when connectivity returns, queued local changes synchronize", async () => {
    const cloud = new MemoryProvider(); cloud.setOnline(false);
    const local = [rec("journal", "j1", 500, { text: "offline" })];
    await syncOnce(cloud, local, 0);            // offline — nothing pushed
    cloud.setOnline(true);
    const r = await syncOnce(cloud, local, 0);  // back online — pushes
    expect(r.offline).toBe(false);
    expect(cloud.all().map((x) => x.id)).toContain("j1");
  });
});

describe("syncOnce · concurrent edits before reconnect (Test 8)", () => {
  test("both devices' different changes survive after both sync", async () => {
    const cloud = new MemoryProvider();
    const phone = [rec("completions", "d|tA", 1000, { done: true })];
    const laptop = [rec("mastery", "tech:di", 1002, { state: "demonstrated" })];
    await syncOnce(cloud, phone, 0);     // phone syncs first
    const r = await syncOnce(cloud, laptop, 0); // laptop syncs — pulls phone's, pushes its own
    const ids = r.merged.map((x) => x.id).sort();
    expect(ids).toEqual(["d|tA", "tech:di"]);
    expect(cloud.all()).toHaveLength(2);
  });
});

describe("serialize · settings ⇄ records round-trip", () => {
  const base: any = {
    roadmapStartDate: "2026-01-05",
    dayOrderConfig: { anchorDate: "2026-01-05", anchorDayOrder: 1, holidays: [], examDates: [] },
    flexBudgetPerMonth: 4, cutoffHourForDowngrade: 18,
    completions: [{ date: "2026-01-05", taskId: "t-dsa", completedAt: 1000 }],
    itemProgress: { "w1:dsa": 3 },
    journal: [{ id: "j1", date: "2026-01-05", text: "hi", ts: 900, updatedAt: 900 }],
    feedbackLog: [], followUps: [], mastery: [], evidence: [],
    modeHistory: [], flexDayLedger: [], updatedAt: 1000,
  };
  test("intrinsic records carry their own timestamps", () => {
    const recs = intrinsicRecords(base);
    const comp = recs.find((r) => r.table === "completions")!;
    expect(comp.updatedAt).toBe(1000);
    expect(comp.id).toBe("2026-01-05|t-dsa");
  });
  test("itemProgress diff emits only changed keys stamped now", () => {
    const recs = itemProgressRecords({ "w1:dsa": 3 }, { "w1:dsa": 4, "w1:code": 1 }, 5000);
    expect(recs.map((r) => r.id).sort()).toEqual(["w1:code", "w1:dsa"]);
    expect(recs.every((r) => r.updatedAt === 5000)).toBe(true);
  });
  test("apply(records) reconstructs the same completions + itemProgress", () => {
    const recs = diffToRecords(null, base, 5000);
    const empty: any = { ...base, completions: [], itemProgress: {}, journal: [] };
    const rebuilt = applyRecordsToSettings(empty, recs);
    expect(rebuilt.completions).toHaveLength(1);
    expect(rebuilt.itemProgress["w1:dsa"]).toBe(3);
    expect(rebuilt.journal[0].text).toBe("hi");
  });
  test("a tombstone record removes the row on apply", () => {
    const withEv: any = { ...base, evidence: [{ id: "e1", type: "repo", title: "x", weekNumber: 1, domain: "tech", createdAt: 0, updatedAt: 0 }] };
    const tomb: SyncRecord = { table: "evidence", id: "e1", updatedAt: 9999, deletedAt: 9999, payload: {} };
    const out = applyRecordsToSettings(withEv, [tomb]);
    expect(out.evidence).toHaveLength(0);
  });
});

describe("status machine", () => {
  test("transitions are calm and correct", () => {
    expect(nextStatus("idle", "start", false)).toBe("syncing");
    expect(nextStatus("syncing", "success", false)).toBe("synced");
    expect(nextStatus("syncing", "success", true)).toBe("pending");
    expect(nextStatus("syncing", "offline", false)).toBe("offline");
    expect(statusLabel("offline")).toBe("Offline · saved locally");
  });
});
