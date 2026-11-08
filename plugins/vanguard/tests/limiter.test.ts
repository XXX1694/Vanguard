import { describe, expect, mock, test } from "claude-code/testing";

import { limiterOffRules } from "../hooks/lib";
import { dict, LANGS } from "../hooks/i18n";

const EN = { options: { language: "en" } };
const PROFILE = "/home/u/.claude/vanguard/profile.json";
const PANE_PROPS = {
  title: "Vanguard",
  isFocused: false,
  bodyColumns: 140,
  placement: "dock" as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
};

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

function startHooks(on: any) {
  on("session.start", () => ({ cwd: "/repo" }) as never);
  on("session.id", () => ({ value: "sess-1" }) as never);
  on("command.register", () => ({ value: undefined }) as never);
  on("ui.open", () => ({ value: undefined }) as never);
  on("ui.toast", () => ({ value: undefined }) as never);
}

const mountPane = ($: any) =>
  $.ui.mount({
    plugin: "vanguard",
    surface: "desktop",
    component: "Pane",
    props: PANE_PROPS,
    requestId: "vanguard",
  });

const COMPOSE = {
  model: "claude-opus-5-5",
  promptModel: "claude-opus-5-5",
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
};
const sectionIds = async ($: any) =>
  ((await $.prompt.compose(COMPOSE)).sections as { id: string }[]).map(
    (s) => s.id,
  );

describe("limiter: texts", () => {
  test("the prompt section stops the asking and keeps the refusals", () => {
    const rules = limiterOffRules();
    expect(rules).toContain("# Vanguard: limiter off");
    expect(rules).toContain("without stopping for confirmation");
    expect(rules).toContain("rm -rf /");
    expect(limiterOffRules()).toBe(rules);
  });

  test("every language names the switch both ways", () => {
    for (const { id } of LANGS) {
      const d = dict(id);
      expect(d.limiterOn).not.toBe(d.limiterOff);
      expect(d.logLimiter(true)).not.toBe(d.logLimiter(false));
      expect(d.limiterUsage).toContain("/limiter");
      expect(d.cmdLimiter.length).toBeGreaterThan(0);
    }
  });
});

test(
  "the pane switch turns every ask into an allow, and back",
  EN,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    const files: Record<string, string> = {};
    memFs(on, files);
    startHooks(on);
    let verdict: "ask" | "deny" = "ask";
    on("tool.check", () => ({ decision: verdict }));
    await $.session.start({ cwd: "/repo", source: "startup" } as never);
    const check = () =>
      $.tool.check({ tool: "Bash", input: { command: "npm install" } });

    expect((await check()).decision).toBe("ask");
    const pane = await mountPane($);
    expect(
      await pane.find({ type: "Text", text: "Claude asks before risky steps" }),
    ).toBeDefined();

    await pane.press({ key: "limiter" });
    expect((await check()).decision).toBe("allow");
    expect(JSON.parse(files[PROFILE] ?? "{}").limiter).toBe(false);
    expect(
      await pane.find({
        type: "Text",
        text: "No permission prompts: Claude does it all itself",
      }),
    ).toBeDefined();
    // a refusal is not an ask: it stays
    verdict = "deny";
    expect((await check()).decision).toBe("deny");

    verdict = "ask";
    await pane.press({ key: "limiter" });
    expect((await check()).decision).toBe("ask");
    expect(JSON.parse(files[PROFILE] ?? "{}").limiter).toBeUndefined();
  },
);

test("/limiter sets, flips and explains itself", EN, async ($, on) => {
  mock.clock(on);
  mock.env(on, { HOME: "/home/u" });
  memFs(on, {});
  startHooks(on);
  on("prompt.compose", () => ({
    sections: [{ id: "engine", text: "core", scope: "shared" as const }],
  }));
  await $.session.start({ cwd: "/repo", source: "startup" } as never);
  const run = (args: string) =>
    $.command.run({ command: "limiter", args } as never) as Promise<{
      text?: string;
    }>;

  expect((await run("off")).text).toBe(
    "Limiter off: Claude acts without asking",
  );
  expect(await sectionIds($)).toContain("vanguard:limiter");
  expect((await run("")).text).toBe(
    "Limiter on: Claude asks for permission again",
  );
  expect(await sectionIds($)).not.toContain("vanguard:limiter");
  expect(await sectionIds($)).toContain("vanguard:orchestrator");
  expect((await run("maybe")).text).toContain("Usage: /limiter");
});

test(
  "a profile with the limiter off starts the session off",
  EN,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    memFs(on, {
      [PROFILE]: JSON.stringify({
        version: 1,
        sessions: {},
        unlocked: [],
        collapsed: {},
        limiter: false,
      }),
    });
    startHooks(on);
    on("tool.check", () => ({ decision: "ask" as const }));
    await $.session.start({ cwd: "/repo", source: "startup" } as never);

    expect(
      (
        await $.tool.check({
          tool: "Write",
          input: { file_path: "/repo/a.md" },
        })
      ).decision,
    ).toBe("allow");
    const band = await $.ui.mount({
      plugin: "vanguard",
      surface: "terminal",
      component: "AbovePrompt",
      props: {} as never,
    } as never);
    expect(
      await band.find({ type: "Text", text: "Limiter: off" }),
    ).toBeDefined();
  },
);

test(
  "with the limiter off the guard stops asking but still refuses rm -rf /",
  EN,
  async ($, on) => {
    mock.clock(on);
    mock.env(on, { HOME: "/home/u" });
    memFs(on, {});
    startHooks(on);
    let ran = 0;
    on("tool.call", () => {
      ran++;
      return { result: "ok" } as never;
    });
    await $.session.start({ cwd: "/repo", source: "startup" } as never);
    await $.command.run({ command: "limiter", args: "off" } as never);

    const push = await $.tool.call({
      tool: "Bash",
      command: "git push --force origin main",
    } as never);
    expect(push.isError).toBeFalsy();
    const pane = await mountPane($);
    await pane.press({ key: "tab-log" });
    expect(
      await pane.find({
        type: "Text",
        text: "Guard asked: git push --force origin main",
      }),
    ).toBeUndefined();

    const root = await $.tool.call({
      tool: "Bash",
      command: "rm -rf /",
    } as never);
    expect(root.isError).toBe(true);
    expect(root.text).toContain("Vanguard guard refused");
    expect(ran).toBe(1);
  },
);
