import { describe, expect, mock, test } from "claude-code/testing";

import { budgetBand, budgetNote, resolvePlan } from "../hooks/lib";
import type { RateWindow } from "../types";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const inMin = (m: number) => new Date(NOW + m * 60_000).toISOString();
const five = (percentUsed: number, resetsAt?: string): RateWindow => ({
  kind: "five_hour",
  percentUsed,
  resetsAt,
});
const week = (percentUsed: number, resetsAt?: string): RateWindow => ({
  kind: "seven_day",
  percentUsed,
  resetsAt,
});

type BandRow = [string, RateWindow[], string, string];

const BANDS: BandRow[] = [
  ["no rates", [], "max", "plenty"],
  ["low use", [five(20), week(30)], "max", "plenty"],
  ["5h at the tight line", [five(60)], "max", "tight"],
  ["5h just under", [five(59.9)], "max", "plenty"],
  ["5h critical", [five(85)], "max", "critical"],
  ["7d tight", [five(10), week(75)], "max", "tight"],
  ["7d critical", [week(90)], "team", "critical"],
  ["the worst window wins", [five(86), week(10)], "max", "critical"],
  [
    "unknown kinds read as seven_day",
    [{ kind: "spend_limit", percentUsed: 80 }],
    "max",
    "tight",
  ],
  ["pro shifts 10 points", [five(50)], "pro", "tight"],
  ["pro critical earlier", [five(76)], "pro", "critical"],
  ["pro 7d", [week(65)], "pro", "tight"],
  ["reset soon drops a band", [five(90, inMin(10))], "max", "tight"],
  ["reset soon from tight", [five(70, inMin(15))], "max", "plenty"],
  ["reset later keeps it", [five(90, inMin(16))], "max", "critical"],
  ["reset soon never below plenty", [five(10, inMin(5))], "max", "plenty"],
  ["a bad timestamp is ignored", [five(90, "soon")], "max", "critical"],
];

describe("budget band", () => {
  for (const [name, rates, plan, band] of BANDS)
    test(name, () => {
      expect(budgetBand(rates, plan, NOW)).toBe(band);
    });
});

describe("resolve plan", () => {
  test("a set plan stands", () => {
    expect(resolvePlan("pro", [], undefined)).toBe("pro");
    expect(resolvePlan("api", [five(10)], 1)).toBe("api");
  });
  test("auto reads the meters", () => {
    expect(resolvePlan("auto", [five(10)], 2)).toBe("subscription");
    expect(resolvePlan("auto", [], 0.5)).toBe("api");
    expect(resolvePlan("auto", [], undefined)).toBe("unknown");
  });
  test("an unknown setting counts as auto", () => {
    expect(resolvePlan("free", [], undefined)).toBe("unknown");
  });
});

describe("budget note", () => {
  test("names the band, the plan and each window", () => {
    const note = budgetNote(
      "tight",
      "pro",
      [five(72, inMin(100)), week(41)],
      NOW,
    );
    expect(note).toStartWith("Vanguard budget: tight");
    expect(note).toContain("plan: pro");
    expect(note).toContain("5h 72% used, resets in 1h40m");
    expect(note).toContain("7d 41% used");
    expect(note).not.toContain("7d 41% used, resets");
    expect(note).toContain("at most two agents");
  });
  test("critical and plenty carry their words", () => {
    expect(budgetNote("critical", "max", [five(90)], NOW)).toContain(
      "Vanguard budget: critical",
    );
    expect(budgetNote("plenty", "subscription", [five(5)], NOW)).toContain(
      "Vanguard budget: plenty (plan: subscription",
    );
  });
  test("API billing reads as tight with the cost", () => {
    const note = budgetNote("plenty", "api", [], NOW, 1.234);
    expect(note).toStartWith(
      "Vanguard budget: tight (API billing, session cost $1.23)",
    );
    expect(note).toContain("costs money");
  });
  test("stays one short line", () => {
    const long = budgetNote(
      "critical",
      "enterprise",
      [
        five(99, inMin(299)),
        week(95, inMin(6000)),
        { kind: "spend_limit", percentUsed: 100 },
      ],
      NOW,
    );
    expect(long.length).toBeLessThan(300);
    expect(long).not.toContain("\n");
  });
});

const usage = (rateLimits: RateWindow[], usd?: number) => ({
  context: { window: 200_000 },
  rateLimits,
  ...(usd !== undefined ? { cost: { usd } } : {}),
  changed: ["rateLimits"],
});

/** What the settings hooks beneath answer: a measure is echoed, the classic events say nothing. */
const beneath = (on: any, context: string[] = []) => {
  on("session.measure", (_$: unknown, e: any) => ({ changed: e.changed }));
  on("classic.UserPromptSubmit", () => ({ additionalContext: context }));
  on("classic.SubagentStart", () => ({}));
};

const notes = (r: { additionalContext?: string[] }) =>
  (r.additionalContext ?? []).filter((x) => x.startsWith("Vanguard budget:"));

test(
  "the budget note goes out once per change",
  { options: { language: "en", plan: "max" } },
  async ($, on) => {
    mock.clock(on);
    beneath(on, ["other hook"]);
    // all is well on the first prompt: nothing is said
    await $.session.measure(usage([five(20)]) as never);
    let r = await $.classic.UserPromptSubmit({ prompt: "a" } as never);
    expect(notes(r)).toEqual([]);
    expect(r.additionalContext).toContain("other hook");
    // the band moves to tight: one note
    await $.session.measure(usage([five(70)]) as never);
    r = await $.classic.UserPromptSubmit({ prompt: "b" } as never);
    expect(notes(r)).toHaveLength(1);
    expect(notes(r)[0]).toContain("Vanguard budget: tight (plan: max");
    expect(r.additionalContext).toContain("other hook");
    // no change: no repeat
    r = await $.classic.UserPromptSubmit({ prompt: "c" } as never);
    expect(notes(r)).toEqual([]);
    // a subagent on a tight budget is told to stay short
    const s = await $.classic.SubagentStart({
      agent_id: "a1",
      agent_type: "vanguard:scout",
    } as never);
    expect(s.additionalContext?.join(" ")).toContain(
      "Vanguard budget is tight",
    );
    // back to plenty: said once
    await $.session.measure(usage([five(10)]) as never);
    r = await $.classic.UserPromptSubmit({ prompt: "d" } as never);
    expect(notes(r)[0]).toContain("Vanguard budget: plenty");
    const s2 = await $.classic.SubagentStart({
      agent_id: "a2",
      agent_type: "vanguard:scout",
    } as never);
    expect(s2.additionalContext ?? []).toEqual([]);
  },
);

test(
  "API billing is named on the first prompt",
  { options: { language: "en" } },
  async ($, on) => {
    mock.clock(on);
    beneath(on);
    await $.session.measure(usage([], 0.42) as never);
    const r = await $.classic.UserPromptSubmit({ prompt: "a" } as never);
    expect(notes(r)[0]).toContain("API billing, session cost $0.42");
  },
);

test(
  "with the orchestrator off, no budget note",
  { options: { language: "en", orchestrator: false } },
  async ($, on) => {
    mock.clock(on);
    beneath(on);
    await $.session.measure(usage([five(95)]) as never);
    const r = await $.classic.UserPromptSubmit({ prompt: "a" } as never);
    expect(notes(r)).toEqual([]);
  },
);
