import { describe, expect, test } from "claude-code/testing";

import {
  activityOf,
  characterSvg,
  ROLE_COLOR,
  roleOf,
} from "../hooks/characters";
import type { Activity, Mood, Role } from "../hooks/characters";

const ROLES: Role[] = [
  "commander",
  "scout",
  "architect",
  "builder",
  "reviewer",
  "verifier",
  "guide",
  "soldier",
];
const ACTIVITIES: Activity[] = [
  "think",
  "read",
  "search",
  "edit",
  "shell",
  "web",
  "delegate",
  "plan",
];
const MOODS: Mood[] = ["working", "waiting", "done", "failed", "stopped"];

describe("characters", () => {
  test("the same options give the same markup, another seed another", () => {
    const o = {
      role: "builder" as const,
      activity: "edit" as const,
      mood: "working" as const,
      seed: "agent-1",
      animated: true,
    };
    expect(characterSvg(o)).toBe(characterSvg({ ...o }));
    expect(characterSvg(o)).not.toBe(characterSvg({ ...o, seed: "agent-2" }));
    expect(characterSvg({ ...o, animated: false })).toBe(
      characterSvg({ ...o, animated: false }),
    );
  });

  test("animated markup moves and stays see-through; a still does not move", () => {
    for (const mood of MOODS) {
      const o = { role: "scout" as const, activity: "read" as const, mood };
      const live = characterSvg({ ...o, seed: "s", animated: true });
      const still = characterSvg({ ...o, seed: "s", animated: false });
      expect(live).toContain("@keyframes");
      expect(live).toContain(":root{color-scheme:light dark}");
      expect(live).toContain("prefers-reduced-motion");
      expect(still).not.toContain("@keyframes");
      expect(still).not.toContain("color-scheme");
      expect(still).not.toContain("<style");
      expect(still).not.toContain("<animate");
    }
  });

  test("every role, activity and mood draws a safe, bounded svg", () => {
    for (const role of ROLES)
      for (const activity of ACTIVITIES)
        for (const mood of MOODS)
          for (const animated of [true, false]) {
            const svg = characterSvg({
              role,
              activity,
              mood,
              seed: `${role}-${activity}`,
              animated,
            });
            expect(svg.startsWith("<svg")).toBe(true);
            expect(svg.endsWith("</svg>")).toBe(true);
            expect(svg.length).toBeLessThan(131072);
            expect(svg).not.toContain("<script");
            expect(/\son[a-z]+\s*=/i.test(svg)).toBe(false);
            expect(svg).not.toContain("href");
            expect(svg).not.toContain("NaN");
          }
  });

  test("each role has a colour", () => {
    for (const role of ROLES) expect(ROLE_COLOR[role]).toBeTruthy();
  });

  test("agent types map to roles", () => {
    const cases: [string, Role][] = [
      ["scout", "scout"],
      ["Explore", "scout"],
      ["vanguard:scout", "scout"],
      ["architect", "architect"],
      ["Plan", "architect"],
      ["vanguard:builder", "builder"],
      ["reviewer", "reviewer"],
      ["pr-review-toolkit:code-reviewer", "reviewer"],
      ["security-auditor", "reviewer"],
      ["verifier", "verifier"],
      ["test-runner", "verifier"],
      ["qa-agent", "verifier"],
      ["verify-app", "verifier"],
      ["claude-code-guide", "guide"],
      ["docs-writer", "guide"],
      ["general-purpose", "soldier"],
      ["claude", "soldier"],
      ["statusline-setup", "soldier"],
      ["something-else", "soldier"],
    ];
    for (const [type, role] of cases) expect(roleOf(type)).toBe(role);
  });

  test("tools map to activities", () => {
    const cases: [string | undefined, Activity][] = [
      [undefined, "think"],
      ["Read", "read"],
      ["NotebookRead", "read"],
      ["Grep", "search"],
      ["Glob", "search"],
      ["LSP", "search"],
      ["ToolSearch", "search"],
      ["LS", "search"],
      ["Edit", "edit"],
      ["Write", "edit"],
      ["MultiEdit", "edit"],
      ["NotebookEdit", "edit"],
      ["Bash", "shell"],
      ["BashOutput", "shell"],
      ["KillShell", "shell"],
      ["Monitor", "shell"],
      ["PowerShell", "shell"],
      ["WebFetch", "web"],
      ["WebSearch", "web"],
      ["mcp__github__create_pr", "web"],
      ["Agent", "delegate"],
      ["Task", "delegate"],
      ["SendMessage", "delegate"],
      ["Workflow", "delegate"],
      ["TodoWrite", "plan"],
      ["TaskCreate", "plan"],
      ["TaskUpdate", "plan"],
      ["EnterPlanMode", "plan"],
      ["ExitPlanMode", "plan"],
      ["mcp__plugin_vanguard_sequential-thinking__sequentialthinking", "plan"],
      ["Skill", "think"],
    ];
    for (const [tool, activity] of cases)
      expect(activityOf(tool)).toBe(activity);
  });
});
