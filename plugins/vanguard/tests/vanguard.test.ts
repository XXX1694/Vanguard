import { describe, expect, mock, test } from "claude-code/testing";

import {
  bar,
  contextLevel,
  fmtDuration,
  handoffMarkdown,
  effortDots,
  fmtReset,
  level,
  modelBadge,
  plural,
  shortModel,
  toolDetail,
  toolLabel,
  topTools,
  successStreak,
  newlyUnlocked,
  nextAchievement,
  sparkline,
  etaToFull,
  pulseBar,
  mcpServer,
  serverLabel,
  orchestratorRules,
  EMPTY_RETIRED,
  mergeSpawned,
  reconcileHeroes,
  streakWith,
  trimHeroes,
  guardStep,
  guardThresholds,
  percentLeft,
  fmtClock,
} from "../hooks/lib";
import type { Hero } from "../types";
import { iconSvg, LOGO_SVG, toolIcon } from "../hooks/icons";
import { dict, LANGS, langFromLocale } from "../hooks/i18n";

/** The engine-level tests read the Russian interface. */
const RU = { options: { language: "ru" } };

const PANE_PROPS = {
  title: "Vanguard",
  isFocused: false,
  bodyColumns: 140,
  placement: "dock" as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
};

describe("helpers", () => {
  test("maps models to badges and effort to dots", () => {
    expect(modelBadge("claude-opus-5-5").icon).toBe("sparkles");
    expect(modelBadge("claude-haiku-5-5").label).toBe("Haiku");
    expect(modelBadge("claude-sonnet-5-5").icon).toBe("shield");
    expect(shortModel("claude-opus-5-5")).toBe("opus 5.5");
    expect(effortDots("high")).toBe("●●●○○");
    expect(effortDots(undefined)).toBe("○○○○○");
  });

  test("describes tool calls", () => {
    expect(toolDetail({ file_path: "/a/b/lib.ts" })).toBe("lib.ts");
    expect(toolDetail({ command: "git  status", description: "x" })).toBe(
      "git status",
    );
    expect(toolLabel("mcp__github__create_pr")).toBe("github · create_pr");
    expect(toolIcon("Bash")).toBe("terminal");
    expect(topTools({ Read: 3, Bash: 9, Edit: 1 }, 2)).toBe("Bash 9 · Read 3");
    expect(plural(3, ["агент", "агента", "агентов"])).toBe("агента");
    expect(plural(11, ["агент", "агента", "агентов"])).toBe("агентов");
    expect(iconSvg("check", "success")).toContain('stroke="#22A06B"');
    expect(LOGO_SVG.startsWith("<svg")).toBe(true);
    const now = new Date(2026, 9, 9, 10, 0).getTime();
    expect(fmtReset(new Date(2026, 9, 9, 14, 30).getTime(), now)).toBe("14:30");
  });

  test("formats bars, durations and levels", () => {
    expect(bar(50, 10)).toBe("█████░░░░░");
    expect(bar(150, 4)).toBe("████");
    expect(fmtDuration(65_000)).toBe("1m05s");
    expect(fmtDuration(65_000, { d: "д", h: "ч", m: "м", s: "с" })).toBe(
      "1м05с",
    );
    expect(fmtDuration(3_720_000)).toBe("1h02m");
    expect(level(5, 0).level).toBe(2);
  });

  test("classifies context fill", () => {
    expect(contextLevel(undefined)).toBe("ok");
    expect(contextLevel(50)).toBe("ok");
    expect(contextLevel(75)).toBe("warn");
    expect(contextLevel(90)).toBe("critical");
  });

  test("handoff markdown carries the summary, agents and resume line", () => {
    const md = handoffMarkdown({
      at: 0,
      sessionId: "s1",
      cwd: "/repo",
      model: "claude-opus-5-5",
      tokensBefore: 900_000,
      heroes: [
        {
          id: "a1",
          title: "Deploy",
          type: "implementer",
          model: "claude-sonnet-5-5",
          status: "running",
          startedAt: 0,
          actions: 3,
        },
        {
          id: "a2",
          title: "Old",
          type: "explorer",
          model: "claude-haiku-5-5",
          status: "done",
          startedAt: 0,
          actions: 1,
        },
      ],
      summary: "Next steps: merge PR 9",
      path: "/home/u/.claude/handoffs/x.md",
    });
    expect(md).toContain("Next steps: merge PR 9");
    expect(md).toContain("- Deploy (implementer, sonnet 5.5, id a1)");
    expect(md).toContain("## Recently finished agents\n- Old (explorer): done");
    expect(md.indexOf("Old (")).toBeGreaterThan(md.indexOf("Recently finished"));
    expect(md).toContain("Read /home/u/.claude/handoffs/x.md");
  });
});

for (const surface of ["terminal", "desktop"] as const) {
  test(
    `a spawned subagent shows up in the pane and the band (${surface})`,
    RU,
    async ($, on) => {
      mock.clock(on);
      on("agent.spawn", () => ({
        model: "claude-haiku-5-5",
        agentId: "agent-1",
      }));

      await $.agent.spawn({
        prompt: "Look around",
        description: "Recon the repo",
      } as never);

      const pane = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "Pane",
        props: PANE_PROPS,
        requestId: "vanguard",
      });
      expect(
        await pane.find({ type: "Text", text: "Recon the repo" }),
      ).toBeDefined();
      expect(
        await pane.find({ type: "Text", text: "Субагенты в работе" }),
      ).toBeDefined();
      expect(
        await pane.find({ type: "Button", text: "Сжать и сохранить" }),
      ).toBeDefined();

      const band = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "AbovePrompt",
        props: { hasSurvey: false } as never,
      });
      expect(
        await band.find({ type: "Text", text: "1 агент в работе" }),
      ).toBeDefined();
    },
  );
}

test(
  "a compaction keeps the plan and writes a handoff snapshot",
  RU,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    const written: Record<string, string> = {};
    let seenInstructions = "";
    on("session.compact", (_$, e) => {
      seenInstructions = e.instructions ?? "";
      return {
        messages: [
          { role: "user", text: "SUMMARY: merge PR 9 next", toolUses: [] },
        ],
        tokensBefore: 800_000,
      } as never;
    });
    on("session.id", () => ({ value: "sess-1" }));
    on("session.cwd", () => ({ value: "/repo" }));
    on("session.model", () => ({ value: "claude-opus-5-5" }));
    on("fs.write", (_$, e) => {
      written[e.path] = e.text;
      return { value: undefined } as never;
    });

    await $.session.compact({
      instructions: "focus on deploy",
      trigger: "manual",
      messages: [{ role: "user", text: "long chat", toolUses: [] }],
    } as never);

    expect(seenInstructions).toContain("focus on deploy");
    expect(seenInstructions).toContain("Background agents still running");
    const paths = Object.keys(written);
    expect(paths).toContain("/home/u/.claude/handoffs/LATEST.md");
    expect(written["/home/u/.claude/handoffs/LATEST.md"]).toContain(
      "SUMMARY: merge PR 9 next",
    );
  },
);

test(
  "a snapshot that cannot be written never breaks the compaction",
  RU,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    on(
      "session.compact",
      () =>
        ({
          messages: [{ role: "user", text: "SUMMARY", toolUses: [] }],
          tokensBefore: 1,
        }) as never,
    );
    on("fs.write", () => {
      throw new Error("disk full");
    });
    on("ui.toast", () => {
      throw new Error("no toasts here");
    });

    const r = await $.session.compact({
      trigger: "manual",
      messages: [{ role: "user", text: "chat", toolUses: [] }],
    } as never);
    expect(r.skip).toBeUndefined();
    expect((r as { tokensBefore?: number }).tokensBefore).toBe(1);
  },
);

test("a tool call goes through whatever the bookkeeping does", RU, async ($, on) => {
  on("clock.now", () => {
    throw new Error("no clock");
  });
  on("tool.call", () => ({ result: "ran" }) as never);
  const r = await $.tool.call({ tool: "Bash", command: "ls" } as never);
  expect((r as { result?: string }).result).toBe("ran");
});

describe("mechanics", () => {
  test("streaks, unlocks and the next achievement", () => {
    expect(successStreak(["failed", "done", "done"])).toBe(2);
    const stats = {
      agentsTotal: 1,
      agentsDone: 1,
      peakParallel: 3,
      streak: 1,
      mcpCalls: 0,
      mcpServersUsed: 0,
      skillUses: 0,
      reads: 0,
      edits: 0,
      bashes: 0,
      snapshots: 0,
    };
    expect(newlyUnlocked(stats, []).map((a) => a.id)).toEqual([
      "first",
      "squad",
    ]);
    expect(newlyUnlocked(stats, ["first", "squad"])).toEqual([]);
    expect(nextAchievement(stats, ["first", "squad"])).toBeDefined();
    expect(sparkline([0, 50, 100], 3)).toBe("▁▅█");
    expect(
      etaToFull(
        [
          { at: 0, value: 10 },
          { at: 600_000, value: 20 },
        ],
        600_000,
      ),
    ).toBe(600_000 + 80 * 60_000);
    expect(pulseBar(0, 6)).toHaveLength(6);
    expect(mcpServer("mcp__github__create_pr")).toBe("github");
    expect(serverLabel("claude_ai_Gmail")).toBe("Gmail");
  });
});

for (const surface of ["terminal", "desktop"] as const) {
  test(
    `the arsenal highlights a used MCP server and unlocks an achievement (${surface})`,
    RU,
    async ($, on) => {
      mock.clock(on);
      on(
        "tool.list",
        () =>
          ({
            value: [
              { name: "mcp__github__create_pr", description: "PR", mcp: true },
              { name: "mcp__linear__find", description: "x", mcp: true },
            ],
          }) as never,
      );
      on(
        "command.list",
        () =>
          ({
            value: [
              { name: "graphify", description: "graph", source: "user" },
              {
                name: "x:y",
                description: "d",
                source: "plugin",
                plugin: "superplug",
              },
            ],
          }) as never,
      );
      on("tool.call", () => ({ result: "ok" }) as never);
      on("command.register", () => ({ value: undefined }) as never);
      on("ui.open", () => ({ value: undefined }) as never);
      on("session.start", () => ({ cwd: "/repo" }) as never);
      on("session.id", () => ({ value: "sess-now" }) as never);
      mock.store(on);
      await $.session.start({ cwd: "/repo", source: "startup" } as never);
      await $.tool.call({
        tool: "mcp__github__create_pr",
        title: "t",
      } as never);

      const pane = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "Pane",
        props: { ...PANE_PROPS, bodyColumns: 150 },
        requestId: "vanguard",
      });
      await pane.press({ key: "tab-arsenal" });
      expect(await pane.find({ type: "Text", text: "Арсенал" })).toBeDefined();
      expect(await pane.find({ type: "Text", text: "github" })).toBeDefined();
      expect(await pane.find({ type: "Text", text: "×1" })).toBeDefined();
      expect(
        await pane.find({ type: "Text", text: "superplug" }),
      ).toBeDefined();
      await pane.press({ key: "tab-achievements" });
      expect(await pane.find({ type: "Text", text: "Связной" })).toBeDefined();
      await pane.press({ key: "tab-overview" });

      await pane.unmount();
      const narrow = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "Pane",
        props: { ...PANE_PROPS, bodyColumns: 60 },
        requestId: "vanguard",
      });
      expect(await narrow.find({ type: "Text", text: "Лимиты" })).toBeDefined();
    },
  );
}

/** Answers `$.fs` from files in memory, as the profile reads and writes them. */
function memFs(on: any, files: Record<string, string>) {
  on(
    "fs.exists",
    (_$: unknown, e: { path: string }) => ({ value: e.path in files }) as never,
  );
  on(
    "fs.read",
    (_$: unknown, e: { path: string }) =>
      ({ value: files[e.path] ?? "" }) as never,
  );
  on("fs.write", (_$: unknown, e: { path: string; text: string }) => {
    files[e.path] = e.text;
    return { value: undefined } as never;
  });
}

const PROFILE = "/home/u/.claude/vanguard/profile.json";
const OLD_SESSION = {
  id: "sess-1",
  at: 1,
  agentsTotal: 4,
  agentsDone: 4,
  peakParallel: 3,
  streak: 4,
  calls: 100,
  mcpCalls: 0,
  mcpServers: [],
  skillUses: 0,
  reads: 0,
  edits: 0,
  bashes: 0,
  snapshots: 0,
  usd: 2,
};

function startHooks(on: any, id: string) {
  on("session.start", () => ({ cwd: "/repo" }) as never);
  on("session.id", () => ({ value: id }) as never);
  on("command.register", () => ({ value: undefined }) as never);
  on("ui.open", () => ({ value: undefined }) as never);
  on("ui.toast", () => ({ value: undefined }) as never);
}

test(
  "an old store profile moves into the shared file, and a section folds",
  RU,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    const files: Record<string, string> = {};
    memFs(on, files);
    mock.store(on, { sessions: { "sess-1": OLD_SESSION } });
    startHooks(on, "sess-2");
    await $.session.start({ cwd: "/repo", source: "startup" } as never);

    const saved = JSON.parse(files[PROFILE] ?? "{}");
    expect(Object.keys(saved.sessions)).toEqual(["sess-1"]);
    expect(saved.unlocked.map((x: { id: string }) => x.id)).toContain("squad");

    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "desktop",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(
      await pane.find({
        type: "Text",
        text: "Сессия №2 · модель… · агенты не запущены",
      }),
    ).toBeDefined();
    await pane.press({ key: "tab-achievements" });
    expect(await pane.find({ type: "Text", text: "Отряд" })).toBeDefined();
    expect(
      await pane.find({
        type: "Text",
        text: "За всё время: 2 сессии · 4 агента · 100 выз. · $2.00",
      }),
    ).toBeDefined();

    await pane.press({ key: "tab-overview" });
    expect(
      await pane.find({
        type: "Text",
        text: "Сейчас нет запущенных субагентов",
      }),
    ).toBeDefined();
    await pane.press({ key: "fold-party" });
    expect(
      await pane.find({
        type: "Text",
        text: "Сейчас нет запущенных субагентов",
      }),
    ).toBeUndefined();
    expect(JSON.parse(files[PROFILE] ?? "{}").collapsed).toEqual({
      party: true,
    });
  },
);

test(
  "another project's session reads the level from the shared file alone",
  RU,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    const files: Record<string, string> = {
      [PROFILE]: JSON.stringify({
        version: 1,
        sessions: { "sess-1": OLD_SESSION },
        unlocked: [{ id: "first", at: 1 }],
        collapsed: {},
      }),
    };
    memFs(on, files);
    mock.store(on);
    startHooks(on, "sess-9");
    await $.session.start({
      cwd: "/other-project",
      source: "startup",
    } as never);

    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "desktop",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(
      await pane.find({
        type: "Text",
        text: "Сессия №2 · модель… · агенты не запущены",
      }),
    ).toBeDefined();
    // 4 agents done (400) + 100 calls (200) + unlocked first, squad, flawless? (3 × 150)
    const xp = (await pane.findAll({ type: "Text" }))
      .map((x: any) => x.text)
      .find((t: string) => /XP/.test(t));
    expect(xp).toBeDefined();
    expect(Number(String(xp).match(/(\d+) XP/)?.[1])).toBeGreaterThanOrEqual(
      600,
    );
  },
);

test(
  "settings hide sections",
  { options: { showArsenal: false, showLog: false } },
  async ($, on) => {
    mock.clock(on);
    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "desktop",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(await pane.find({ key: "tab-arsenal" })).toBeUndefined();
    expect(await pane.find({ key: "tab-log" })).toBeUndefined();
    expect(await pane.find({ key: "tab-achievements" })).toBeDefined();
  },
);

for (const surface of ["terminal", "desktop"] as const) {
  test(
    `the context tab breaks the window down (${surface})`,
    RU,
    async ($, on) => {
      mock.clock(on);
      on("session.start", () => ({ cwd: "/repo" }) as never);
      on("session.id", () => ({ value: "s" }) as never);
      on("command.register", () => ({ value: undefined }) as never);
      on("ui.open", () => ({ value: undefined }) as never);
      on(
        "session.usage",
        () =>
          ({
            value: {
              startedAt: 0,
              rateLimits: [],
              context: {
                window: 1_000_000,
                breakdown: {
                  categories: [
                    {
                      name: "System prompt",
                      tokens: 12_000,
                      color: "promptBorder",
                      isDeferred: false,
                      kind: "used",
                    },
                    {
                      name: "Messages",
                      tokens: 200_000,
                      color: "permission",
                      isDeferred: false,
                      kind: "used",
                    },
                    {
                      name: "Autocompact buffer",
                      tokens: 33_000,
                      color: "inactive",
                      isDeferred: false,
                      kind: "buffer",
                    },
                    {
                      name: "Free space",
                      tokens: 755_000,
                      color: "inactive",
                      isDeferred: false,
                      kind: "free",
                    },
                  ],
                  totalTokens: 212_000,
                  maxTokens: 1_000_000,
                  rawMaxTokens: 1_000_000,
                  percentage: 21,
                  gridRows: [],
                  model: "m",
                  memoryFiles: [
                    {
                      path: "/Users/me/.claude/CLAUDE.md",
                      type: "User",
                      tokens: 900,
                    },
                  ],
                  mcpTools: [
                    {
                      name: "mcp__abc__x",
                      serverName: "claude.ai Gmail",
                      tokens: 4000,
                      isLoaded: true,
                    },
                  ],
                  agents: [],
                },
              },
            },
          }) as never,
      );
      mock.store(on);
      await $.session.start({ cwd: "/repo", source: "startup" } as never);

      const pane = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "Pane",
        props: PANE_PROPS,
        requestId: "vanguard",
      });
      await pane.press({ key: "tab-context" });
      expect(
        await pane.find({ type: "Text", text: "Из чего состоит контекст" }),
      ).toBeDefined();
      expect(await pane.find({ type: "Text", text: "Messages" })).toBeDefined();
      expect(
        await pane.find({ type: "Text", text: "claude.ai Gmail" }),
      ).toBeDefined();
      expect(
        await pane.find({ type: "Text", text: "~/.claude/CLAUDE.md" }),
      ).toBeDefined();
    },
  );
}

test(
  "an unlock raises a banner, and animations stay within the frame budget",
  RU,
  async ($, on) => {
    mock.clock(on);
    on("ui.toast", () => ({ value: undefined }) as never);
    let n = 0;
    on("agent.spawn", () => ({
      model: "claude-haiku-5-5",
      agentId: `agent-${++n}`,
    }));
    for (let i = 0; i < 12; i++)
      await $.agent.spawn({ prompt: "p", description: `Task ${i}` } as never);

    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "desktop",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(
      await pane.find({ type: "Text", text: "Достижение открыто" }),
    ).toBeDefined();
    const svgs = await pane.findAll({ type: "Svg" });
    const live = svgs.filter((x: any) => x.props?.isInteractive === true);
    expect(live.length).toBeGreaterThan(0);
    expect(live.length).toBeLessThanOrEqual(8);
  },
);

test(
  "a profile kept under the old agent-arena name carries over",
  RU,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    const files: Record<string, string> = {
      "/home/u/.claude/agent-arena/profile.json": JSON.stringify({
        version: 1,
        sessions: { "sess-1": OLD_SESSION },
        unlocked: [],
        collapsed: {},
      }),
    };
    memFs(on, files);
    mock.store(on);
    startHooks(on, "sess-3");
    await $.session.start({ cwd: "/repo", source: "startup" } as never);
    expect(Object.keys(JSON.parse(files[PROFILE] ?? "{}").sessions)).toContain(
      "sess-1",
    );
  },
);

const hero = (id: string, status: Hero["status"], extra = {}): Hero => ({
  id,
  title: id,
  type: "scout",
  model: "claude-haiku-5-5",
  status,
  startedAt: 0,
  actions: 1,
  tokens: 10,
  ...extra,
});

describe("squad", () => {
  test("the list adds, finishes and stops agents", () => {
    const known = [
      hero("a", "running", { listed: true }),
      hero("b", "running"),
      hero("c", "running", { listed: true }),
      hero("d", "done", { listed: true }),
    ];
    const next = reconcileHeroes(
      known,
      [
        { id: "c", status: "completed", type: "scout" },
        { id: "e", status: "running", type: "builder", description: "Build" },
        { id: "f", status: "failed", type: "builder" },
      ],
      500,
    );
    const by = (id: string) => next.find((x) => x.id === id);
    // listed before, now gone: its loop ended without a turn.complete
    expect(by("a")?.status).toBe("stopped");
    expect(by("a")?.endedAt).toBe(500);
    // never listed (a remote agent): left to its own events
    expect(by("b")?.status).toBe("running");
    expect(by("c")?.status).toBe("done");
    expect(by("d")?.status).toBe("done");
    expect(by("e")?.title).toBe("Build");
    expect(by("e")?.listed).toBe(true);
    // finished before we ever saw it: nothing to show
    expect(by("f")).toBeUndefined();
  });

  test("a spawn keeps what the list and the first steps already told", () => {
    const early = hero("a", "running", {
      model: "claude-opus-5-5",
      actions: 4,
      startedAt: 100,
      title: "a",
    });
    const merged = mergeSpawned(
      early,
      hero("a", "running", { actions: 0, startedAt: 300, title: "Recon" }),
    );
    expect(merged.actions).toBe(4);
    expect(merged.startedAt).toBe(100);
    expect(merged.title).toBe("Recon");
    expect(merged.model).toBe("claude-opus-5-5");
  });

  test("the squad stays bounded and its totals stay right", () => {
    const list = [
      hero("x", "failed"),
      ...Array.from({ length: 5 }, (_, i) => hero(`d${i}`, "done")),
      hero("run", "running"),
    ];
    const r = trimHeroes(list, EMPTY_RETIRED, 2);
    expect(r.list.map((x) => x.id)).toEqual(["d3", "d4", "run"]);
    expect(r.retired.total).toBe(4);
    expect(r.retired.done).toBe(3);
    expect(r.retired.failed).toBe(1);
    expect(r.retired.streak).toBe(3);
    expect(r.retired.actions).toBe(4);
    expect(r.retired.tokens).toBe(40);
    // the streak runs on through the agents still listed
    expect(streakWith(["done", "done"], r.retired)).toBe(5);
    expect(streakWith(["failed", "done"], r.retired)).toBe(1);
    // trimming again folds in on top
    const again = trimHeroes(r.list, r.retired, 0);
    expect(again.list.map((x) => x.id)).toEqual(["run"]);
    expect(again.retired.total).toBe(6);
    expect(again.retired.streak).toBe(5);
  });
});

test(
  "an agent that vanishes from the list is stopped, shown briefly, then leaves",
  { options: { language: "en" } },
  async ($, on) => {
    const clock = mock.clock(on);
    mock.store(on);
    startHooks(on, "sess-squad");
    let listed: { id: string; status: string; type: string }[] = [];
    on("agent.list", () => ({ value: listed }) as never);
    on("agent.spawn", () => ({
      model: "claude-haiku-5-5",
      agentId: "agent-1",
    }));
    await $.session.start({ cwd: "/repo", source: "startup" } as never);
    await $.agent.spawn({ prompt: "p", description: "Map the repo" } as never);
    listed = [{ id: "agent-1", status: "running", type: "scout" }];
    await clock.advance(3000);
    listed = [];
    await clock.advance(3000);

    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "terminal",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(await pane.find({ type: "Text", text: "Map the repo" })).toBeDefined();
    expect(await pane.find({ type: "Text", text: "Stopped" })).toBeDefined();

    await clock.advance(7000);
    await pane.unmount();
    const later = await $.ui.mount({
      plugin: "vanguard",
      surface: "terminal",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    expect(await later.find({ type: "Text", text: "Map the repo" })).toBeUndefined();
    expect(
      await later.find({ type: "Text", text: "No subagents running" }),
    ).toBeDefined();
    await later.press({ key: "tab-log" });
    expect(await later.find({ type: "Text", text: /Map the repo/ })).toBeDefined();
  },
);

describe("context guard", () => {
  test("thresholds are made sane", () => {
    expect(guardThresholds(70, 85)).toEqual({ warn: 70, critical: 85 });
    expect(guardThresholds(90, 80)).toEqual({ warn: 90, critical: 91 });
    expect(guardThresholds("x", undefined)).toEqual({ warn: 70, critical: 85 });
    expect(guardThresholds(-5, 400)).toEqual({ warn: 1, critical: 100 });
    expect(guardThresholds(99.6, 99)).toEqual({ warn: 99, critical: 100 });
    expect(contextLevel(95, 90, 91)).toBe("critical");
  });

  test("the alert fires once per climb and re-arms below the warning", () => {
    let armed = true;
    const fired: boolean[] = [];
    for (const level of [
      "ok",
      "critical",
      "critical",
      "warn",
      "critical",
      "ok",
      "critical",
    ] as const) {
      const s = guardStep(armed, level);
      armed = s.armed;
      fired.push(s.alert);
    }
    expect(fired).toEqual([false, true, false, false, false, false, true]);
  });

  test("the snapshot says what started it and how full the window was", () => {
    const md = handoffMarkdown({
      at: 0,
      sessionId: "s",
      cwd: "/r",
      model: "m",
      tokensBefore: 170_000,
      contextPercent: 85.4,
      trigger: "auto",
      heroes: [
        {
          id: "a",
          title: "Tests",
          type: "verifier",
          model: "claude-haiku-5-5",
          status: "running",
          startedAt: 0,
          actions: 2,
          lastAction: "Bash",
          lastDetail: "npm test",
        },
      ],
      summary: "x",
      path: "/p.md",
    });
    expect(md).toContain("auto compaction · context before compaction 170k, 85%");
    expect(md).toContain("· last: Bash npm test");
    expect(md).not.toContain("Recently finished");
  });
});

test(
  "the guard toasts once when the context turns critical",
  { options: { language: "en", ctxWarn: 70, ctxCritical: 85 } },
  async ($, on) => {
    mock.clock(on);
    const toasts: string[] = [];
    on("session.measure", (_$, e) => ({ changed: e.changed }));
    on("ui.toast", (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e));
      return { value: undefined } as never;
    });
    const measure = (percent: number) =>
      ($ as any).session.measure({
        context: { window: 200_000, tokens: percent * 2000, percent },
        rateLimits: [],
        changed: ["context"],
      });
    for (const p of [40, 86, 90, 75, 88, 50, 91]) await measure(p);
    const alerts = toasts.filter((t) => t.includes("/handoff"));
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toContain("86%");

    const band = await $.ui.mount({
      plugin: "vanguard",
      surface: "terminal",
      component: "AbovePrompt",
      props: { hasSurvey: false } as never,
    });
    expect(await band.find({ type: "Button", key: "handoff" })).toBeDefined();
  },
);

describe("limits", () => {
  test("the forecast reads only the readings since the last reset", () => {
    const m = 60_000;
    // 80% before a reset, then climbing from 5% by 1% a minute
    const points = [
      { at: 0, value: 80 },
      { at: 5 * m, value: 82 },
      { at: 10 * m, value: 5 },
      { at: 20 * m, value: 15 },
    ];
    expect(etaToFull(points, 20 * m)).toBe(20 * m + 85 * m);
    // too little since the reset to tell
    expect(etaToFull(points.slice(0, 3), 10 * m)).toBeUndefined();
    // already at the limit: no forecast
    expect(
      etaToFull(
        [
          { at: 0, value: 90 },
          { at: 10 * m, value: 100 },
        ],
        10 * m,
      ),
    ).toBeUndefined();
  });

  test("what is left stays within 0 and 100", () => {
    expect(percentLeft(23.5)).toBe(76.5);
    expect(percentLeft(120)).toBe(0);
    expect(percentLeft(-3)).toBe(100);
    expect(percentLeft(Number.NaN)).toBe(100);
  });
});

test(
  "a passed reset reads as a fresh window, and an exceeded budget as empty",
  { options: { language: "en" } },
  async ($, on) => {
    const now = Date.UTC(2026, 9, 9, 12, 0);
    mock.clock(on, { now });
    on("session.measure", (_$, e) => ({ changed: e.changed }));
    const resetAt = Date.UTC(2026, 9, 9, 11, 0);
    await ($ as any).session.measure({
      context: { window: 200_000, tokens: 20_000, percent: 10 },
      rateLimits: [
        {
          kind: "five_hour",
          percentUsed: 97,
          resetsAt: new Date(resetAt).toISOString(),
        },
        { kind: "spend_limit", percentUsed: 120 },
      ],
      changed: ["context", "rateLimits"],
    });
    const pane = await $.ui.mount({
      plugin: "vanguard",
      surface: "terminal",
      component: "Pane",
      props: { ...PANE_PROPS, bodyColumns: 150 },
      requestId: "vanguard",
    });
    const texts = (await pane.findAll({ type: "Text" })).map((x: any) =>
      String(x.text),
    );
    expect(texts).toContain(
      `reset at ${fmtClock(resetAt)} · fresh reading on the next reply`,
    );
    expect(texts.some((t: string) => t.trim() === "3%")).toBe(false);
    expect(texts.some((t: string) => /^-\d+%/.test(t.trim()))).toBe(false);
    expect(texts.some((t: string) => t.trim() === "0%")).toBe(true);
  },
);

describe("orchestrator rules", () => {
  test("name the plugin's agents and follow the context threshold", () => {
    const text = orchestratorRules(77);
    expect(text).toContain("`vanguard:scout`");
    expect(text).toContain("`vanguard:verifier`");
    expect(text).toContain("past 77% full");
  });
});

describe("languages", () => {
  test("every language gives every message", () => {
    const keys = Object.keys(dict("en")).sort();
    for (const l of LANGS) {
      const d = dict(l.id);
      expect(Object.keys(d).sort()).toEqual(keys);
      expect(Object.keys(d.ach).sort()).toEqual(
        Object.keys(dict("en").ach).sort(),
      );
      expect(typeof d.agentsWorking(2)).toBe("string");
    }
  });

  test("the locale picks the language", () => {
    expect(langFromLocale("ru_RU.UTF-8")).toBe("ru");
    expect(langFromLocale("zh-Hans")).toBe("zh");
    expect(langFromLocale("pt-BR")).toBe("pt");
    expect(langFromLocale("sv_SE")).toBe("en");
    expect(langFromLocale(undefined)).toBe("en");
  });
});

for (const surface of ["terminal", "desktop"] as const) {
  test(
    `the pane speaks the chosen language and the switcher changes it (${surface})`,
    { options: { language: "en" } },
    async ($, on) => {
      mock.clock(on);
      mock.env(on, { HOME: "/home/u" });
      memFs(on, {});
      const pane = await $.ui.mount({
        plugin: "vanguard",
        surface,
        component: "Pane",
        props: { ...PANE_PROPS, bodyColumns: 150 },
        requestId: "vanguard",
      });
      expect(
        await pane.find({ type: "Text", text: "Subagents at work" }),
      ).toBeDefined();
      expect(
        await pane.find({ type: "Text", text: "No subagents running" }),
      ).toBeDefined();
      if (surface === "desktop") {
        await pane.select({ key: "lang", value: "zh" });
      } else {
        // the terminal cycles: en → ru → zh
        await pane.press({ key: "lang" });
        await pane.press({ key: "lang" });
      }
      expect(
        await pane.find({ type: "Text", text: "工作中的子智能体" }),
      ).toBeDefined();
    },
  );
}

for (const l of LANGS)
  test(
    `every tab draws in ${l.name}`,
    { options: { language: l.id } },
    async ($, on) => {
      mock.clock(on);
      mock.env(on, { HOME: "/home/u" });
      memFs(on, {});
      on("agent.spawn", () => ({
        model: "claude-haiku-5-5",
        agentId: "agent-1",
      }));
      await $.agent.spawn({ prompt: "p", description: "Task" } as never);
      for (const surface of ["terminal", "desktop"] as const) {
        const pane = await $.ui.mount({
          plugin: "vanguard",
          surface,
          component: "Pane",
          props: {
            ...PANE_PROPS,
            bodyColumns: surface === "terminal" ? 34 : 150,
          },
          requestId: "vanguard",
        });
        for (const tab of [
          "overview",
          "context",
          "arsenal",
          "achievements",
          "log",
        ]) {
          await pane.press({ key: `tab-${tab}` });
          expect(await pane.drawn()).toBeDefined();
        }
        await pane.unmount();
      }
    },
  );
