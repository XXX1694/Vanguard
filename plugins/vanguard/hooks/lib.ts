// Pure helpers for Vanguard: no engine calls, so tests can reach them directly.

import type { Hero, RateWindow, SessionRecord } from "../types";

import type { IconName } from "./icons";

export type ModelBadge = {
  key: string;
  label: string;
  icon: IconName;
  color: string;
};

const BADGES: [RegExp, ModelBadge][] = [
  [/fable/i, { key: "fable", label: "Fable", icon: "flame", color: "claude" }],
  [/opus/i, { key: "opus", label: "Opus", icon: "sparkles", color: "merged" }],
  [
    /sonnet/i,
    { key: "sonnet", label: "Sonnet", icon: "shield", color: "suggestion" },
  ],
  [
    /haiku/i,
    { key: "haiku", label: "Haiku", icon: "feather", color: "success" },
  ],
];

/** Icon, colour and name for a model family. */
export function modelBadge(model: string): ModelBadge {
  const hit = BADGES.find(([re]) => re.test(model));

  return hit
    ? hit[1]
    : { key: "other", label: "Model", icon: "bot", color: "text" };
}

export function shortModel(model: string): string {
  const m = model.match(/(fable|opus|sonnet|haiku)[-\s]?(\d+)?(?:[-.](\d+))?/i);
  if (!m) return model || "?";
  const version = m[2] ? ` ${m[2]}${m[3] ? "." + m[3] : ""}` : "";

  return (m[1] ?? "").toLowerCase() + version;
}

const EFFORT_LEVEL: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  xhigh: 4,
  max: 5,
};

/** Five dots filled to the effort level: `●●●○○`. */
export function effortDots(effort?: string): string {
  const n = effort ? EFFORT_LEVEL[effort] : undefined;
  if (n === undefined) return "○○○○○";

  return "●".repeat(n) + "○".repeat(5 - n);
}

/** The effort level in words, from the language's table (`labels`). */
export function effortLabel(
  effort: string | undefined,
  labels: Record<string, string> = {},
): string {
  if (!effort) return "—";

  return labels[effort] ?? effort;
}

export function bar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const full = Math.round((clamped / 100) * width);

  return "█".repeat(full) + "░".repeat(width - full);
}

/** Colour for a "how much is left" meter. */
export function meterColor(percentLeft: number): string {
  if (percentLeft < 20) return "error";
  if (percentLeft < 40) return "warning";

  return "success";
}

export type Units = { d: string; h: string; m: string; s: string };
const EN_UNITS: Units = { d: "d", h: "h", m: "m", s: "s" };

export function fmtDuration(ms: number, u: Units = EN_UNITS): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}${u.d}${h}${u.h}`;
  if (h > 0) return `${h}${u.h}${String(m).padStart(2, "0")}${u.m}`;
  if (m > 0) return `${m}${u.m}${String(sec).padStart(2, "0")}${u.s}`;

  return `${sec}${u.s}`;
}

/**
 * A running length that changes once a minute: `<1m`, `4m`, `1h05m`, `2d3h`.
 * The pane redraws on that minute, not every second.
 */
export function fmtAge(ms: number, u: Units = EN_UNITS): string {
  if (ms < 60_000) return `<1${u.m}`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}${u.m}`;

  return fmtDuration(ms, u);
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;

  return String(n);
}

export function fmtClock(ms: number): string {
  const d = new Date(ms);

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** XP: 100 per finished quest, 2 per action. Every 500 XP is a level. */
export function level(
  questsDone: number,
  actions: number,
  bonus = 0,
): { level: number; xp: number; progress: number } {
  const xp = questsDone * 100 + actions * 2 + bonus;

  return {
    level: Math.floor(xp / 500) + 1,
    xp,
    progress: ((xp % 500) / 500) * 100,
  };
}

/** A tool name as people read it: `mcp__github__create_pr` → `github · create_pr`. */
export function toolLabel(
  tool: string,
  names: Record<string, string> = {},
): string {
  const m = tool.match(/^mcp__(.+?)__(.+)$/);
  if (!m) return tool;
  const key = m[1] ?? "";
  const server = names[key] ?? key.replace(/^[0-9a-f-]{20,}$/, "mcp");

  return `${server} · ${m[2]}`;
}

/** What a tool call works on: the command, the file, the pattern or the URL. */
export function toolDetail(args: Record<string, unknown>): string | undefined {
  const str = (k: string) => {
    const v = args[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const path = str("file_path") ?? str("notebook_path");
  if (path) return path.split("/").pop();
  const pick =
    str("command") ??
    str("pattern") ??
    str("url") ??
    str("query") ??
    str("description") ??
    str("skill") ??
    str("path");

  return pick?.replace(/\s+/g, " ");
}

/** The most used tools, `Read 12 · Bash 8 · Edit 5`. */
export function topTools(
  counts: Record<string, number>,
  n: number,
  names: Record<string, string> = {},
): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tool, count]) => `${toolLabel(tool, names)} ${count}`)
    .join(" · ");
}

/** When a rate window resets: today's `14:30`, or `Fri 09:00` further out, in `locale`. */
export function fmtReset(
  resetsAt: number,
  now: number,
  locale = "en-US",
): string {
  const at = new Date(resetsAt);
  const time = fmtClock(resetsAt);
  if (
    resetsAt - now < 20 * 3600_000 &&
    at.getDate() === new Date(now).getDate()
  )
    return time;
  let day: string;
  try {
    day = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at);
  } catch {
    day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][at.getDay()] ?? "";
  }

  return `${day} ${time}`;
}

/**
 * Model text made safe to draw: line breaks normalised, terminal escapes and
 * other control characters (all but tab and newline) taken out.
 */
export function plainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}

export function clip(text: string, max: number): string {
  if (max <= 1) return "";

  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function rateLabel(
  kind: string,
  labels: Record<string, string> = {},
): string {
  return labels[kind] ?? kind;
}

/** Context fill at which Vanguard warns, and at which it urges a handoff. */
export const CONTEXT_WARN = 70;
export const CONTEXT_CRITICAL = 85;

export type ContextLevel = "ok" | "warn" | "critical";

export function contextLevel(
  percentUsed: number | undefined,
  warn = CONTEXT_WARN,
  critical = CONTEXT_CRITICAL,
): ContextLevel {
  if (percentUsed === undefined || percentUsed < warn) return "ok";

  return percentUsed < critical ? "warn" : "critical";
}

/** Appended to every compaction of the main loop so the summary keeps what the work needs. */
export const PRESERVE_INSTRUCTIONS = [
  "Keep in full, as concrete facts, not vague prose:",
  "1. The user's goals, standing instructions and preferences (language, approvals given, things they refused).",
  "2. Every decision taken, with its ID or file and the reason.",
  "3. Work state: repositories, branches, worktrees, PR numbers with CI and merge state, server changes made, files created.",
  "4. Background agents still running: their task, branch, and what to do with their result.",
  "5. Blockers and questions waiting on the user.",
  "6. The next steps, in order.",
  "Drop raw tool output, file dumps and dead-end exploration.",
].join("\n");

export type HandoffInput = {
  at: number;
  sessionId: string;
  cwd: string;
  model: string;
  tokensBefore?: number;
  heroes: Hero[];
  summary: string;
  path: string;
};

export function handoffMarkdown(h: HandoffInput): string {
  const running = h.heroes.filter((x) => x.status === "running");
  const agents =
    running.length === 0
      ? "- none"
      : running
          .map(
            (x) =>
              `- ${x.title} (${x.type}, ${shortModel(x.model)}, id ${x.id})`,
          )
          .join("\n");
  const lines = [
    `# Handoff ${new Date(h.at).toISOString()}`,
    "",
    `Session \`${h.sessionId}\` · cwd \`${h.cwd}\` · model \`${h.model}\`` +
      (h.tokensBefore
        ? ` · context before compaction ${fmtTokens(h.tokensBefore)}`
        : ""),
    "",
    "## Agents running at the time",
    agents,
    "",
    "## Summary",
    h.summary.trim() || "(the compaction returned no summary text)",
    "",
    "## Resume in a new session",
    `Paste: Read ${h.path} and continue from its next steps. Check running agents and open PRs first.`,
    "",
  ];

  return lines.join("\n");
}

/** Russian plural: `plural(3, ["агент", "агента", "агентов"])` → `агента`. */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];

  return forms[2];
}

/**
 * When a percentage reaches 100 at the pace of the last hour of readings;
 * undefined while it is flat, falling, or too little was read.
 */
export function etaToFull(
  points: { at: number; value: number }[],
  now: number,
): number | undefined {
  const recent = points.filter((p) => now - p.at <= 3_600_000);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.at - first.at < 5 * 60_000) return undefined;
  const slope = (last.value - first.value) / (last.at - first.at);
  if (slope <= 0) return undefined;

  return now + (100 - last.value) / slope;
}

/** Append a reading when it moved or a minute passed; keep the last 120. */
export function pushSample<T extends { at: number }>(
  list: T[],
  sample: T,
  same: (a: T, b: T) => boolean,
): T[] {
  const last = list[list.length - 1];
  if (last && sample.at - last.at < 60_000 && same(last, sample)) return list;

  return [...list, sample].slice(-120);
}

/** The server a tool belongs to: `mcp__github__create_pr` → `github`. */
export function mcpServer(tool: string): string | undefined {
  const m = tool.match(/^mcp__(.+?)__/);

  return m ? m[1] : undefined;
}

/** A server name as people read it: a bare connector id becomes `connector`. */
export function serverLabel(name: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(name))
    return `connector ${name.slice(0, 4)}`;

  return name.replace(/^claude_ai_/, "").replace(/_/g, " ");
}

export type VanguardStats = {
  agentsTotal: number;
  agentsDone: number;
  peakParallel: number;
  streak: number;
  mcpCalls: number;
  mcpServersUsed: number;
  skillUses: number;
  reads: number;
  edits: number;
  bashes: number;
  snapshots: number;
};

export type Achievement = {
  id: string;
  title: string;
  hint: string;
  progress: (s: VanguardStats) => [number, number];
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first",
    title: "First sortie",
    hint: "Launch a subagent",
    progress: (s) => [s.agentsTotal, 1],
  },
  {
    id: "squad",
    title: "Squad",
    hint: "3 subagents at once",
    progress: (s) => [s.peakParallel, 3],
  },
  {
    id: "legion",
    title: "Legion",
    hint: "10 subagents in a session",
    progress: (s) => [s.agentsTotal, 10],
  },
  {
    id: "flawless",
    title: "Flawless",
    hint: "5 successful subagents in a row",
    progress: (s) => [s.streak, 5],
  },
  {
    id: "connector",
    title: "Connector",
    hint: "Call an MCP tool",
    progress: (s) => [s.mcpCalls, 1],
  },
  {
    id: "polyglot",
    title: "Polyglot",
    hint: "Use 3 different MCP servers",
    progress: (s) => [s.mcpServersUsed, 3],
  },
  {
    id: "skillful",
    title: "Skill master",
    hint: "Run skills 3 times",
    progress: (s) => [s.skillUses, 3],
  },
  {
    id: "scholar",
    title: "Bookworm",
    hint: "Read 50 files",
    progress: (s) => [s.reads, 50],
  },
  {
    id: "builder",
    title: "Builder",
    hint: "Make 25 file edits",
    progress: (s) => [s.edits, 25],
  },
  {
    id: "shell",
    title: "Shell master",
    hint: "Run 50 terminal commands",
    progress: (s) => [s.bashes, 50],
  },
  {
    id: "keeper",
    title: "Keeper",
    hint: "Save a context snapshot",
    progress: (s) => [s.snapshots, 1],
  },
];

/** Successes in a row, counted back from the latest finished agent. */
export function successStreak(statuses: string[]): number {
  let n = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] !== "done") break;
    n += 1;
  }

  return n;
}

/** The achievements `stats` reaches that `have` does not hold yet. */
export function newlyUnlocked(
  stats: VanguardStats,
  have: string[],
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => {
    const [cur, goal] = a.progress(stats);
    return cur >= goal && !have.includes(a.id);
  });
}

/** The locked achievement closest to done, for "next up". */
export function nextAchievement(
  stats: VanguardStats,
  have: string[],
): Achievement | undefined {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id))
    .map((a) => {
      const [cur, goal] = a.progress(stats);
      return { a, ratio: Math.min(1, cur / goal) };
    })
    .sort((x, y) => y.ratio - x.ratio)[0]?.a;
}

export function emptyRecord(id = "", at = 0): SessionRecord {
  return {
    id,
    at,
    agentsTotal: 0,
    agentsDone: 0,
    peakParallel: 0,
    streak: 0,
    calls: 0,
    mcpCalls: 0,
    mcpServers: [],
    skillUses: 0,
    reads: 0,
    edits: 0,
    bashes: 0,
    snapshots: 0,
    usd: 0,
  };
}

/** Two records as one: counts add up, records (peak, streak) keep the best. */
export function mergeRecords(
  a: SessionRecord,
  b: SessionRecord,
): SessionRecord {
  return {
    id: b.id || a.id,
    at: Math.max(a.at, b.at),
    agentsTotal: a.agentsTotal + b.agentsTotal,
    agentsDone: a.agentsDone + b.agentsDone,
    peakParallel: Math.max(a.peakParallel, b.peakParallel),
    streak: Math.max(a.streak, b.streak),
    calls: a.calls + b.calls,
    mcpCalls: a.mcpCalls + b.mcpCalls,
    mcpServers: [...new Set([...a.mcpServers, ...b.mcpServers])],
    skillUses: a.skillUses + b.skillUses,
    reads: a.reads + b.reads,
    edits: a.edits + b.edits,
    bashes: a.bashes + b.bashes,
    snapshots: a.snapshots + b.snapshots,
    usd: a.usd + b.usd,
  };
}

export function statsOfRecord(r: SessionRecord): VanguardStats {
  return {
    agentsTotal: r.agentsTotal,
    agentsDone: r.agentsDone,
    peakParallel: r.peakParallel,
    streak: r.streak,
    mcpCalls: r.mcpCalls,
    mcpServersUsed: r.mcpServers.length,
    skillUses: r.skillUses,
    reads: r.reads,
    edits: r.edits,
    bashes: r.bashes,
    snapshots: r.snapshots,
  };
}

/** XP a record earns: 100 a finished agent, 2 a call, 10 a skill, 5 an MCP call. */
export function xpOf(r: SessionRecord): number {
  return r.agentsDone * 100 + r.calls * 2 + r.skillUses * 10 + r.mcpCalls * 5;
}

/** XP to level: every 500 XP is a level. */
export function levelOf(xp: number): {
  level: number;
  xp: number;
  progress: number;
} {
  return {
    level: Math.floor(xp / 500) + 1,
    xp,
    progress: ((xp % 500) / 500) * 100,
  };
}

/** The newest `keep` records, by when they were last written. */
export function trimSessions(
  all: Record<string, SessionRecord>,
  keep: number,
): Record<string, SessionRecord> {
  return Object.fromEntries(
    Object.entries(all)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, keep),
  );
}

/** Colours for the breakdown's used rows, in order; the reserve is grey. */
export const PART_COLORS = [
  "claude",
  "suggestion",
  "merged",
  "success",
  "warning",
  "error",
];

/**
 * Splits `width` cells among parts by percent, every non-empty part at least
 * one cell, the total never past `width`.
 */
export function splitCells(percents: number[], width: number): number[] {
  const cells = percents.map((p) =>
    p > 0 ? Math.max(1, Math.round((p / 100) * width)) : 0,
  );
  let over = cells.reduce((a, b) => a + b, 0) - width;
  while (over > 0) {
    const i = cells.indexOf(Math.max(...cells));
    if (i < 0 || (cells[i] ?? 0) <= 1) break;
    cells[i] = (cells[i] ?? 0) - 1;
    over -= 1;
  }

  return cells;
}

/** A path as people read it: the home folder as `~`, long ones from the tail. */
export function shortPath(path: string, max: number): string {
  const p = path.replace(/^\/(Users|home)\/[^/]+/, "~");

  return p.length > max ? "…" + p.slice(p.length - max + 1) : p;
}

/**
 * The orchestration rules Vanguard adds to the system prompt (setting
 * "orchestrator"). Static on purpose: the section is cached with the prompt,
 * so live numbers go in the `Vanguard budget:` note (budgetNote), never here.
 */
export function orchestratorRules(criticalPercent: number): string {
  return [
    "# Vanguard: orchestration",
    "",
    "You lead a squad of subagents. Size the task first, then pick the lightest mode that does it well:",
    "- Small (a question, a lookup, an edit in one or two files, a few tool calls): do it yourself. No subagents, no architect, no reviewer agent; run the one relevant check yourself.",
    "- Medium (one area, a few files): one or two agents at most, where they save main-thread context (a scout for a broad search, a builder for a self-contained piece). Review with an agent only when the change is risky (security, data, concurrency, public API).",
    "- Large (several areas or unfamiliar code, independent parts): the full squad via /vanguard:orchestrate, in parallel: `vanguard:scout`, `vanguard:architect`, `vanguard:builder`, `vanguard:reviewer`, `vanguard:verifier`.",
    "",
    "- Models. Set the Agent `model` to the job: haiku for search and mechanical reads; sonnet for mechanical edits, tests and verification; the main model (inherit) only for design, tricky builds and review. Lower the effort of simple agents when the tool allows.",
    "- Tokens. Brief agents with exactly what they need; ask for short reports (conclusions and path:line, no dumps); do not re-read what an agent summarised; no agent for what one Grep answers.",
    "- Budget. Vanguard adds a `Vanguard budget:` note to the conversation when your plan or remaining limits change. Follow it: `plenty` - normal; `tight` - prefer doing it yourself, at most two agents at once, haiku/sonnet only, skip optional review; `critical` - no new subagents except a haiku scout, finish the current step, tell the user when the limit resets and suggest /handoff. On API billing (pay per token) every agent costs money: same as `tight` unless the task is large.",
    "- Docs. Look up library, framework and SDK APIs through the context7 MCP tools, not memory.",
    "- Hard plans. Think multi-step plans with real trade-offs through with the sequential-thinking MCP tool.",
    "- Prove it. Verify in proportion to the change (tests; a changed web UI through playwright) and report what was and was not verified.",
    `- Mind the context. When the context window is past ${criticalPercent}% full, suggest /handoff before starting new large work.`,
    "",
    "Skills: /vanguard:orchestrate (large task), /vanguard:recon (unfamiliar codebase), /vanguard:docs, /vanguard:ship-check (gate before done).",
    "These rules yield to the user's own instructions and the project's CLAUDE.md.",
  ].join("\n");
}

/**
 * The section Vanguard adds to the system prompt while the limiter is off
 * (the switch in the pane, or /limiter off). Static, like the orchestration
 * rules: the prompt changes only when the switch flips.
 */
export function limiterOffRules(): string {
  return [
    "# Vanguard: limiter off",
    "",
    "The user switched the Vanguard limiter off. Tool permission prompts are approved automatically, and the user durably authorizes you to work without stopping for confirmation:",
    '- Do not ask "should I proceed?", "want me to...?" or wait for a go-ahead between steps; decide and carry the task through to the end.',
    "- Where a choice would be the user's, take the sensible default, name it in your report and keep going.",
    "- Afterwards, report what you did, including anything hard to undo.",
    "- Ask only when you cannot go on without information only the user has.",
    "",
    "Only the asking stops: what the guard refuses (rm -rf /, mkfs, a write to a raw disk) and the never-do rules of CLAUDE.md still hold.",
  ].join("\n");
}

// ---- Budget: how many agents the plan and the limits left can afford ----

/** The `plan` setting: the Claude plan, or `auto` to tell a subscription from API billing. */
export type Plan = "auto" | "pro" | "max" | "team" | "enterprise" | "api";

/** A plan as Vanguard knows it: the setting, or what `auto` could tell. */
export type ResolvedPlan = Exclude<Plan, "auto"> | "subscription" | "unknown";

export type BudgetBand = "plenty" | "tight" | "critical";

const BANDS: BudgetBand[] = ["plenty", "tight", "critical"];
const PLANS = new Set<string>(["pro", "max", "team", "enterprise", "api"]);
/** A window this close to its reset counts one band lower. */
const RESET_SOON_MS = 15 * 60_000;

/** One window's band as an index into BANDS: 0 plenty, 1 tight, 2 critical. */
function windowBand(r: RateWindow, plan: string, nowMs: number): number {
  // Pro has the smallest limits: its thresholds sit 10 points lower
  const p = r.percentUsed + (plan === "pro" ? 10 : 0);
  const [tight, critical] = r.kind === "five_hour" ? [60, 85] : [75, 90];
  let band = p >= critical ? 2 : p >= tight ? 1 : 0;
  const resets = r.resetsAt ? Date.parse(r.resetsAt) : NaN;
  if (band > 0 && resets - nowMs <= RESET_SOON_MS) band -= 1;

  return band;
}

/**
 * How much room the rate limits leave: the worst window decides. No windows
 * (API billing, or no reading yet) is `plenty`; budgetNote speaks for API cost.
 */
export function budgetBand(
  rates: RateWindow[],
  plan: string,
  nowMs: number,
): BudgetBand {
  const worst = Math.max(0, ...rates.map((r) => windowBand(r, plan, nowMs)));

  return BANDS[worst] ?? "plenty";
}

/** The plan in force: the setting, or for `auto` a subscription (rate limits) or API billing (cost, no limits). */
export function resolvePlan(
  setting: string,
  rates: RateWindow[],
  cost?: number,
): ResolvedPlan {
  if (PLANS.has(setting)) return setting as ResolvedPlan;
  if (rates.length > 0) return "subscription";

  return cost !== undefined ? "api" : "unknown";
}

const BAND_ADVICE: Record<BudgetBand, string> = {
  plenty: "Orchestrate as usual.",
  tight: "Prefer doing it yourself; at most two agents, haiku/sonnet.",
  critical:
    "No new subagents but a haiku scout; finish this step, give the reset time, suggest /handoff.",
};

function windowLabel(kind: string): string {
  if (kind === "five_hour") return "5h";
  if (kind === "seven_day") return "7d";

  return kind.replace(/_/g, " ");
}

/**
 * The one-line note Vanguard hands the model when the plan or the band
 * changes, in English since it is for the model: the band, the plan, each
 * window, and what to do.
 */
export function budgetNote(
  band: BudgetBand,
  plan: ResolvedPlan,
  rates: RateWindow[],
  nowMs: number,
  usd?: number,
): string {
  if (plan === "api" && rates.length === 0) {
    // pay per token: the rules treat it as tight unless the task is large
    const cost = usd !== undefined ? `, session cost $${usd.toFixed(2)}` : "";

    return `Vanguard budget: tight (API billing${cost}). Every agent costs money; keep the squad small.`;
  }
  const windows = rates.map((r) => {
    const resets = r.resetsAt ? Date.parse(r.resetsAt) : NaN;
    const soon =
      windowBand(r, plan, nowMs) > 0 || r.percentUsed >= 50
        ? Number.isFinite(resets) && resets > nowMs
          ? `, resets in ${fmtDuration(resets - nowMs)}`
          : ""
        : "";

    return `${windowLabel(r.kind)} ${Math.round(r.percentUsed)}% used${soon}`;
  });
  const detail = [plan === "unknown" ? "" : `plan: ${plan}`, ...windows]
    .filter((x) => x !== "")
    .join("; ");

  return `Vanguard budget: ${band}${detail ? ` (${detail})` : ""}. ${BAND_ADVICE[band]}`;
}

// ---- Guard: a screen in front of destructive commands and secret files ----

/** What the guard says about a tool call: refuse it, or ask the user first. */
export type GuardVerdict = { level: "deny" | "ask"; rule: string };

/** Every rule the guard can name, so each language can explain each one. */
export const GUARD_RULES = [
  "rm-root",
  "rm-rf",
  "mkfs",
  "dd-device",
  "fork-bomb",
  "chmod-777-root",
  "chmod-777",
  "find-delete",
  "force-push",
  "reset-hard",
  "git-clean",
  "branch-delete",
  "sudo",
  "pipe-to-shell",
  "terraform",
  "kubectl-delete",
  "publish",
  "sql-drop",
  "secret-file",
] as const;

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);
const ROOT_TARGETS = new Set([
  "/",
  "/*",
  "~",
  "~/",
  "~/*",
  "$HOME",
  "$HOME/",
  "$HOME/*",
  "${HOME}",
  "${HOME}/",
  "${HOME}/*",
]);
const READERS = new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "bat",
  "cp",
  "scp",
]);
const SAFE_DEVICES = /^\/dev\/(null|zero|stdout|stderr|tty|fd\/)/;
const SECRET_DIRS = new Set([".ssh", ".aws", ".gnupg"]);
const SECRET_NAMES = new Set([
  ".npmrc",
  ".netrc",
  ".pypirc",
  ".git-credentials",
  ".pgpass",
  "credentials",
  "credentials.json",
]);
const ENV_TEMPLATES = /\.(example|sample|template)$/;
const FORK_BOMB = /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/;
const SQL_DROP = /\bdrop\s+(table|database|schema)\b|\btruncate\s+table\b/i;
// `truncate -s 0 file` is a shell command; SQL's TRUNCATE is written in capitals
const SQL_TRUNCATE = /\bTRUNCATE\s+\w/;
const PROCESS_SUB_SHELL = /\b(ba|z|da|k)?sh\s+<\(\s*(curl|wget)\b/;

/** A file a tool should not read or change without the user knowing: keys, tokens, `.env`. */
export function isSecretPath(path: string): boolean {
  const parts = path.split("/").filter((x) => x !== "");
  const name = parts[parts.length - 1] ?? "";
  if (parts.slice(0, -1).some((x) => SECRET_DIRS.has(x))) return true;
  if (name === ".env") return true;
  if (name.startsWith(".env.") && !ENV_TEMPLATES.test(name)) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(name)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(name) && !name.endsWith(".pub"))
    return true;

  return SECRET_NAMES.has(name);
}

type Segment = { words: string[]; piped: boolean };

/**
 * Splits a command line on `;`, `&&`, `||`, `|`, `&` and newlines into words,
 * quotes removed. Quoted text stays one word, so `echo "rm -rf /"` is an echo.
 */
function segments(command: string): Segment[] {
  const out: Segment[] = [];
  let words: string[] = [];
  let word = "";
  let inWord = false;
  let quote = "";
  let piped = false;
  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endSegment = (nextPiped: boolean) => {
    endWord();
    if (words.length > 0) out.push({ words, piped });
    words = [];
    piped = nextPiped;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? "";
    if (quote) {
      if (c === quote) quote = "";
      else if (c === "\\" && quote === '"' && i + 1 < command.length) {
        word += command[++i];
      } else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === "\\" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (c === " " || c === "\t") {
      endWord();
    } else if (c === ";" || c === "\n") {
      endSegment(false);
    } else if (
      c === "&" &&
      (command[i - 1] === ">" || command[i + 1] === ">")
    ) {
      // a redirection (`2>&1`, `&>`), not a separator
      word += c;
      inWord = true;
    } else if (c === "&" || c === "|") {
      const double = command[i + 1] === c;
      if (double) i++;
      endSegment(c === "|" && !double);
    } else if (c === "(" || c === ")" || c === "{" || c === "}") {
      // a subshell or group: its words are inspected as their own command
      if (c === "(" || c === ")") endSegment(false);
      else if (!inWord && (command[i + 1] ?? " ").trim() === "")
        endSegment(false);
      else {
        word += c;
        inWord = true;
      }
    } else {
      word += c;
      inWord = true;
    }
  }
  endSegment(false);

  return out;
}

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const isAssignment = (w: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w);

/** Drops `VAR=x` and wrappers (`sudo`, `env`, `nohup`...), noting a `sudo`. */
function unwrap(words: string[]): { words: string[]; sudo: boolean } {
  let rest = words;
  let sudo = false;
  for (let guard = 0; guard < 20 && rest.length > 0; guard++) {
    const head = rest[0] ?? "";
    if (isAssignment(head)) {
      rest = rest.slice(1);
      continue;
    }
    const exe = basename(head);
    if (exe === "sudo" || exe === "doas") {
      sudo = true;
      let i = 1;
      while (i < rest.length && (rest[i] ?? "").startsWith("-")) {
        if (/^-[ugCDhpRrT]$/.test(rest[i] ?? "")) i++;
        i++;
      }
      rest = rest.slice(i);
    } else if (exe === "env") {
      let i = 1;
      while (
        i < rest.length &&
        ((rest[i] ?? "").startsWith("-") || isAssignment(rest[i] ?? ""))
      ) {
        if (/^-[uSC]$/.test(rest[i] ?? "")) i++;
        i++;
      }
      rest = rest.slice(i);
    } else if (
      exe === "command" ||
      exe === "exec" ||
      exe === "nohup" ||
      exe === "time" ||
      exe === "nice"
    ) {
      let i = 1;
      while (i < rest.length && (rest[i] ?? "").startsWith("-")) {
        if (/^-[an]$/.test(rest[i] ?? "")) i++;
        i++;
      }
      rest = rest.slice(i);
    } else if (exe === "xargs") {
      let i = 1;
      while (i < rest.length && (rest[i] ?? "").startsWith("-")) {
        if (/^-[nIPLsdEa]$/.test(rest[i] ?? "")) i++;
        i++;
      }
      rest = rest.slice(i);
    } else break;
  }

  return { words: rest, sudo };
}

/** Short flags as one set: `-rf -v` gives r, f, v; long flags as they are. */
function flagsOf(args: string[]): { short: Set<string>; long: Set<string> } {
  const short = new Set<string>();
  const long = new Set<string>();
  for (const a of args) {
    if (a === "--") break;
    if (a.startsWith("--")) long.add(a.split("=")[0] ?? a);
    else if (a.startsWith("-") && a.length > 1)
      for (const ch of a.slice(1)) short.add(ch);
  }

  return { short, long };
}

/** Git's own options before the subcommand: `-C path`, `-c k=v`, `--git-dir=...`. */
function gitSubcommand(args: string[]): { sub: string; rest: string[] } {
  let i = 0;
  while (i < args.length) {
    const a = args[i] ?? "";
    if (a === "-C" || a === "-c" || a === "--git-dir" || a === "--work-tree")
      i += 2;
    else if (a === "--namespace" || a === "--exec-path") i += 2;
    else if (a.startsWith("-")) i += 1;
    else break;
  }

  return { sub: args[i] ?? "", rest: args.slice(i + 1) };
}

function gitVerdict(args: string[]): GuardVerdict | null {
  const { sub, rest } = gitSubcommand(args);
  const { short, long } = flagsOf(rest);
  const ask = (rule: string): GuardVerdict => ({ level: "ask", rule });
  if (sub === "push") {
    if (
      short.has("f") ||
      long.has("--force") ||
      long.has("--force-with-lease") ||
      long.has("--force-if-includes") ||
      rest.some((a) => a.startsWith("+") && a.length > 1)
    )
      return ask("force-push");
  } else if (sub === "reset") {
    if (long.has("--hard")) return ask("reset-hard");
  } else if (sub === "clean") {
    if (short.has("f") || long.has("--force")) return ask("git-clean");
  } else if (sub === "branch") {
    if (short.has("D") || (long.has("--delete") && long.has("--force")))
      return ask("branch-delete");
  }

  return null;
}

/** The verdicts on one simple command; `depth` bounds `bash -c` unwrapping. */
function commandVerdicts(
  words: string[],
  depth: number,
  out: GuardVerdict[],
): void {
  const { words: w, sudo } = unwrap(words);
  if (sudo) out.push({ level: "ask", rule: "sudo" });
  if (w.length === 0) return;
  const exe = basename(w[0] ?? "");
  const args = w.slice(1);
  const operands = args.filter((a) => !a.startsWith("-") || a === "-");
  const { short, long } = flagsOf(args);
  const deny = (rule: string) => out.push({ level: "deny", rule });
  const ask = (rule: string) => out.push({ level: "ask", rule });

  if (SHELLS.has(exe)) {
    const at = args.findIndex((a) => /^-[a-z]*c[a-z]*$/.test(a));
    const script = at >= 0 ? args[at + 1] : undefined;
    if (script !== undefined && depth < 4) lineVerdicts(script, depth + 1, out);
    return;
  }
  if (exe === "eval" && depth < 4) {
    lineVerdicts(args.join(" "), depth + 1, out);
    return;
  }
  if (exe === "rm") {
    const recursive =
      short.has("r") || short.has("R") || long.has("--recursive");
    const force = short.has("f") || long.has("--force");
    if (recursive && operands.some((a) => ROOT_TARGETS.has(a))) deny("rm-root");
    else if (recursive && force) ask("rm-rf");
  } else if (exe.startsWith("mkfs")) {
    deny("mkfs");
  } else if (exe === "dd") {
    const of = args.find((a) => a.startsWith("of="))?.slice(3);
    if (of?.startsWith("/dev/") && !SAFE_DEVICES.test(of)) deny("dd-device");
  } else if (exe === "chmod") {
    const recursive = short.has("R") || long.has("--recursive");
    if (recursive && operands.some((a) => /^0?777$/.test(a))) {
      if (operands.some((a) => ROOT_TARGETS.has(a))) deny("chmod-777-root");
      else ask("chmod-777");
    }
  } else if (exe === "find") {
    const exec = args.findIndex((a) => a === "-exec" || a === "-execdir");
    if (
      args.includes("-delete") ||
      (exec >= 0 && basename(args[exec + 1] ?? "") === "rm")
    )
      ask("find-delete");
  } else if (exe === "git") {
    const v = gitVerdict(args);
    if (v) out.push(v);
  } else if (exe === "terraform" || exe === "tofu") {
    const sub = operands[0];
    if (sub === "destroy") ask("terraform");
    else if (
      sub === "apply" &&
      args.some((a) => /^--?auto-approve(=true)?$/.test(a))
    )
      ask("terraform");
  } else if (exe === "kubectl") {
    if (operands.includes("delete")) ask("kubectl-delete");
  } else if (exe === "npm" || exe === "pnpm" || exe === "yarn") {
    if (
      operands[0] === "publish" ||
      (operands[0] === "npm" && operands[1] === "publish")
    )
      ask("publish");
  } else if (READERS.has(exe)) {
    if (operands.some((a) => isSecretPath(a.replace(/^[^:\s]+@[^:]+:/, ""))))
      ask("secret-file");
  }
}

/** The verdicts on a whole command line, its pipelines and nested shells. */
function lineVerdicts(line: string, depth: number, out: GuardVerdict[]): void {
  if (FORK_BOMB.test(line)) out.push({ level: "deny", rule: "fork-bomb" });
  if (SQL_DROP.test(line) || SQL_TRUNCATE.test(line))
    out.push({ level: "ask", rule: "sql-drop" });
  if (PROCESS_SUB_SHELL.test(line))
    out.push({ level: "ask", rule: "pipe-to-shell" });
  let fetched = false;
  for (const seg of segments(line)) {
    if (!seg.piped) fetched = false;
    const { words } = unwrap(seg.words);
    const exe = basename(words[0] ?? "");
    if (seg.piped && fetched && SHELLS.has(exe))
      out.push({ level: "ask", rule: "pipe-to-shell" });
    if (exe === "curl" || exe === "wget") fetched = true;
    commandVerdicts(seg.words, depth, out);
  }
}

/**
 * The guard's verdict on a tool call: `deny` for what no agent should run
 * (`rm -rf /`, `mkfs`, `dd` onto a disk), `ask` for what destroys work or
 * reaches secrets (`rm -rf`, a force push, `.env`), `null` to let it pass.
 */
export function guardVerdict(
  tool: string,
  input: Record<string, unknown>,
): GuardVerdict | null {
  const found: GuardVerdict[] = [];
  if (tool === "Bash") {
    const command = input.command;
    if (typeof command === "string") lineVerdicts(command, 0, found);
  } else if (
    tool === "Read" ||
    tool === "Edit" ||
    tool === "Write" ||
    tool === "MultiEdit" ||
    tool === "NotebookEdit"
  ) {
    const path = input.file_path ?? input.notebook_path;
    if (typeof path === "string" && isSecretPath(path))
      found.push({ level: "ask", rule: "secret-file" });
  }

  return found.find((v) => v.level === "deny") ?? found[0] ?? null;
}
