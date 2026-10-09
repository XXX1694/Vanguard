// Pure helpers for Vanguard: no engine calls, so tests can reach them directly.

import type { Hero, Retired, SessionRecord } from "../types";

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

/** What is left of a window, 0–100: a spend limit can report more than 100 used. */
export function percentLeft(percentUsed: number): number {
  if (!Number.isFinite(percentUsed)) return 100;

  return Math.max(0, Math.min(100, 100 - percentUsed));
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

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinnerFrame(now: number): string {
  return SPINNER[Math.floor(now / 1000) % SPINNER.length] ?? "⠋";
}

export function clip(text: string, max: number): string {
  if (max <= 1) return "";

  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
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

/**
 * The guard's thresholds from the settings, made sane: whole percents, warn in
 * 1–99, critical above warn and at most 100. A setting that is no number falls
 * back to the default.
 */
export function guardThresholds(
  warn: unknown,
  critical: unknown,
): { warn: number; critical: number } {
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d;
  const w = Math.min(99, Math.max(1, num(warn, CONTEXT_WARN)));
  const c = Math.min(100, Math.max(2, num(critical, CONTEXT_CRITICAL)));

  return { warn: w, critical: c > w ? c : Math.min(100, w + 1) };
}

/**
 * One step of the guard's alert: it fires once when the context turns
 * critical, and arms again only once the context is back below the warning.
 */
export function guardStep(
  armed: boolean,
  level: ContextLevel,
): { armed: boolean; alert: boolean } {
  if (level === "critical") return { armed: false, alert: armed };
  if (level === "ok") return { armed: true, alert: false };

  return { armed, alert: false };
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
  /** How full the window was, 0–100, when the compaction began. */
  contextPercent?: number;
  /** What started it: `manual` (/handoff, the pane) or `auto`. */
  trigger?: string;
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
              `- ${x.title} (${x.type}, ${shortModel(x.model)}, id ${x.id})` +
              (x.lastAction
                ? ` · last: ${x.lastAction}${x.lastDetail ? ` ${clip(x.lastDetail, 80)}` : ""}`
                : ""),
          )
          .join("\n");
  const recent = h.heroes
    .filter((x) => x.status !== "running")
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 5)
    .map(
      (x) =>
        `- ${x.title} (${x.type}): ${x.status}` +
        (x.endedAt !== undefined
          ? `, ${fmtDuration(x.endedAt - x.startedAt)}`
          : ""),
    );
  const context = [
    h.tokensBefore ? fmtTokens(h.tokensBefore) : "",
    h.contextPercent !== undefined ? `${Math.round(h.contextPercent)}%` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `# Handoff ${new Date(h.at).toISOString()}`,
    "",
    `Session \`${h.sessionId}\` · cwd \`${h.cwd}\` · model \`${h.model}\`` +
      (h.trigger ? ` · ${h.trigger} compaction` : "") +
      (context ? ` · context before compaction ${context}` : ""),
    "",
    "## Agents running at the time",
    agents,
    "",
    ...(recent.length > 0
      ? ["## Recently finished agents", ...recent, ""]
      : []),
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

const SPARKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** A sparkline of the last `width` values, scaled between `min` and `max`. */
export function sparkline(
  values: number[],
  width: number,
  min = 0,
  max = 100,
): string {
  const tail = values.slice(-width);
  const span = Math.max(1e-9, max - min);

  return tail
    .map((v) => {
      const i = Math.round(
        ((Math.min(max, Math.max(min, v)) - min) / span) * 7,
      );
      return SPARKS[i] ?? "▁";
    })
    .join("");
}

/** Dollars per hour over the session so far; undefined in its first minute. */
export function burnPerHour(
  usd: number | undefined,
  elapsedMs: number,
): number | undefined {
  if (usd === undefined || elapsedMs < 60_000) return undefined;

  return usd / (elapsedMs / 3_600_000);
}

/**
 * When a percentage reaches 100 at the pace of the last hour of readings;
 * undefined while it is flat, falling, or too little was read.
 */
export function etaToFull(
  points: { at: number; value: number }[],
  now: number,
): number | undefined {
  const inHour = points.filter((p) => now - p.at <= 3_600_000);
  // A drop is a window reset: only the readings after the last one count.
  let start = 0;
  for (let i = 1; i < inHour.length; i++)
    if ((inHour[i]?.value ?? 0) < (inHour[i - 1]?.value ?? 0)) start = i;
  const recent = inHour.slice(start);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.at - first.at < 5 * 60_000) return undefined;
  const slope = (last.value - first.value) / (last.at - first.at);
  if (slope <= 0 || last.value >= 100) return undefined;

  return now + (100 - last.value) / slope;
}

/** An indeterminate bar whose lit segment walks once per second: `▱▱▰▰▰▱▱▱`. */
export function pulseBar(now: number, width: number): string {
  const lit = Math.max(2, Math.floor(width / 3));
  const pos = Math.floor(now / 1000) % (width + lit);

  return Array.from({ length: width }, (_, i) =>
    i >= pos - lit && i < pos ? "▰" : "▱",
  ).join("");
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

export const EMPTY_RETIRED: Retired = {
  total: 0,
  done: 0,
  failed: 0,
  streak: 0,
  actions: 0,
  tokens: 0,
};

/** How many finished agents the live list keeps; older ones become counters. */
export const KEEP_FINISHED = 60;

/**
 * Keeps every running agent and the newest `keep` finished ones, in order, and
 * folds the rest into `retired` so totals and the success streak stay right.
 */
export function trimHeroes(
  list: Hero[],
  retired: Retired,
  keep = KEEP_FINISHED,
): { list: Hero[]; retired: Retired } {
  const finished = list.filter((x) => x.status !== "running");
  const over = finished.length - keep;
  if (over <= 0) return { list, retired };
  const gone = finished.slice(0, over);
  const dropped = new Set(gone.map((x) => x.id));

  return {
    list: list.filter((x) => !dropped.has(x.id)),
    retired: addRetired(retired, {
      total: gone.length,
      done: gone.filter((x) => x.status === "done").length,
      failed: gone.filter((x) => x.status === "failed").length,
      streak: successStreak(gone.map((x) => x.status)),
      actions: gone.reduce((n, x) => n + x.actions, 0),
      tokens: gone.reduce((n, x) => n + (x.tokens ?? 0), 0),
    }),
  };
}

/** Two batches of retired agents as one, `newer` retired after `older`. */
export function addRetired(older: Retired, newer: Retired): Retired {
  return {
    total: older.total + newer.total,
    done: older.done + newer.done,
    failed: older.failed + newer.failed,
    streak:
      newer.streak === newer.total
        ? older.streak + newer.streak
        : newer.streak,
    actions: older.actions + newer.actions,
    tokens: older.tokens + newer.tokens,
  };
}

/** Successes in a row over the retired agents and then the live list's finished ones. */
export function streakWith(finished: string[], retired: Retired): number {
  const live = successStreak(finished);

  return live === finished.length ? live + retired.streak : live;
}

/** What `$.agent.list()` reports, as far as the squad needs it. */
export type ListedAgent = {
  id: string;
  status: string;
  description?: string;
  name?: string;
  type: string;
};

const LIST_DONE: Record<string, Hero["status"]> = {
  completed: "done",
  failed: "failed",
  killed: "stopped",
};

/**
 * Brings the squad in line with `$.agent.list()`: adds agents the list names
 * that the squad misses, ends those it reports finished, and stops a running
 * agent the list named before and no longer does (its loop is gone, so no
 * `turn.complete` will come). Agents the list never named (a workflow's remote
 * agents) are left to their own events.
 */
export function reconcileHeroes(
  known: Hero[],
  listed: ListedAgent[],
  now: number,
): Hero[] {
  const byId = new Map(listed.map((a) => [a.id, a]));
  const have = new Set(known.map((x) => x.id));
  const next = known.map((hero): Hero => {
    const a = byId.get(hero.id);
    if (!a) {
      return hero.status === "running" && hero.listed
        ? { ...hero, status: "stopped", endedAt: now }
        : hero;
    }
    const finished = LIST_DONE[a.status];
    if (hero.status === "running" && finished)
      return { ...hero, status: finished, endedAt: now, listed: true };

    return hero.listed ? hero : { ...hero, listed: true };
  });
  for (const a of listed) {
    if (have.has(a.id) || LIST_DONE[a.status]) continue;
    next.push({
      id: a.id,
      title: a.description || a.name || a.type,
      type: a.type,
      model: "?",
      status: "running",
      startedAt: now,
      actions: 0,
      listed: true,
    });
  }

  return next;
}

/**
 * A hero `agent.spawn` reports, merged with what the squad already knew of it
 * (the list or the agent's first steps can come before the spawn resolves).
 */
export function mergeSpawned(old: Hero | undefined, hero: Hero): Hero {
  if (!old) return hero;

  return {
    ...old,
    title: hero.title,
    type: hero.type,
    model: old.model !== "?" ? old.model : hero.model,
    startedAt: Math.min(old.startedAt, hero.startedAt),
  };
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

/** The orchestration rules Vanguard adds to the system prompt (setting "orchestrator"). */
export function orchestratorRules(criticalPercent: number): string {
  return [
    "# Vanguard: orchestration",
    "",
    "You lead a squad. Keep the main thread for decisions, the user and the final answer; send bulk work to subagents.",
    "",
    "- Fan out. When a task has parts that do not depend on each other (searching several areas, independent files, research questions), launch the Vanguard agents (subagent types below) for them in one message so they run in parallel: `vanguard:scout` to find and map code, `vanguard:architect` to design a change, `vanguard:builder` to implement a scoped change, `vanguard:reviewer` to check a diff, `vanguard:verifier` to run tests or check a UI.",
    "- Stay lean. Do not read large files or long outputs into the main thread when a scout can return the conclusion.",
    "- Brief well. Each agent gets a self-contained prompt: the goal, the files or area, the constraints and the shape of the answer you need.",
    "- Current docs. For a library, framework or SDK API, look it up through the context7 MCP tools before relying on memory.",
    "- Hard plans. For a multi-step plan with real trade-offs, think it through with the sequential-thinking MCP tool.",
    "- Prove it. Before calling work done, have it verified: tests run, the change reviewed, and a web UI checked in a browser through the playwright MCP tools when one changed. Report what was and was not verified.",
    `- Mind the context. When the context window is past ${criticalPercent}% full, suggest /handoff to the user before starting new large work.`,
    "",
    "Skills: /vanguard:orchestrate plans and runs a squad for a large task; /vanguard:recon maps an unfamiliar codebase; /vanguard:docs fetches current docs; /vanguard:ship-check is the gate before calling work done.",
    "These rules yield to the user's own instructions and the project's CLAUDE.md.",
  ].join("\n");
}
