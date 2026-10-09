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
} from "../hooks/lib";
import { iconSvg, LOGO_SVG, toolIcon } from "../hooks/icons";

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
    expect(fmtDuration(65_000)).toBe("1м05с");
    expect(fmtDuration(3_720_000)).toBe("1ч02м");
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
    expect(md).not.toContain("Old (");
    expect(md).toContain("Read /home/u/.claude/handoffs/x.md");
  });
});

for (const surface of ["terminal", "desktop"] as const) {
  test(`a spawned subagent shows up in the pane and the band (${surface})`, async ($, on) => {
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
  });
}

test("a compaction keeps the plan and writes a handoff snapshot", async ($, on) => {
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
  test(`the arsenal highlights a used MCP server and unlocks an achievement (${surface})`, async ($, on) => {
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
    await $.tool.call({ tool: "mcp__github__create_pr", title: "t" } as never);

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
    expect(await pane.find({ type: "Text", text: "superplug" })).toBeDefined();
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
  });
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

test("an old store profile moves into the shared file, and a section folds", async ($, on) => {
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
    await pane.find({ type: "Text", text: "Сейчас нет запущенных субагентов" }),
  ).toBeDefined();
  await pane.press({ key: "fold-party" });
  expect(
    await pane.find({ type: "Text", text: "Сейчас нет запущенных субагентов" }),
  ).toBeUndefined();
  expect(JSON.parse(files[PROFILE] ?? "{}").collapsed).toEqual({ party: true });
});

test("another project's session reads the level from the shared file alone", async ($, on) => {
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
  await $.session.start({ cwd: "/other-project", source: "startup" } as never);

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
  expect(Number(String(xp).match(/(\d+) XP/)?.[1])).toBeGreaterThanOrEqual(600);
});

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
  test(`the context tab breaks the window down (${surface})`, async ($, on) => {
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
  });
}

test("an unlock raises a banner, and animations stay within the frame budget", async ($, on) => {
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
});

test("a profile kept under the old agent-arena name carries over", async ($, on) => {
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
});

describe("orchestrator rules", () => {
  test("name the plugin's agents and follow the context threshold", () => {
    const text = orchestratorRules(77);
    expect(text).toContain("`vanguard:scout`");
    expect(text).toContain("`vanguard:verifier`");
    expect(text).toContain("past 77% full");
  });
});
