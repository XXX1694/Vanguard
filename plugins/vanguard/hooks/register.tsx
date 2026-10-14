import { atom, read, update } from "claude-code";
import type {
  EngineInterface,
  Register,
  RenderChildren,
  RenderNode,
} from "claude-code";

import type {
  Commander,
  Hero,
  HeroStatus,
  LogLine,
  Meters,
  Arsenal,
  Breakdown,
  Celebration,
  Lifetime,
  Sample,
  SessionRecord,
  Snapshot,
  Tab,
  Unlock,
  Usage,
} from "../types";
import {
  barSvg,
  burstSvg,
  GLYPHS,
  iconSvg,
  LOGO_SVG,
  stackedSvg,
  toolIcon,
  type IconName,
} from "./icons";
import {
  ACHIEVEMENTS,
  type VanguardStats,
  bar,
  clip,
  contextLevel,
  effortDots,
  effortLabel,
  etaToFull,
  fmtClock,
  fmtAge,
  fmtDuration,
  fmtReset,
  fmtTokens,
  emptyRecord,
  handoffMarkdown,
  levelOf,
  mergeRecords,
  PART_COLORS,
  shortPath,
  splitCells,
  statsOfRecord,
  trimSessions,
  xpOf,
  mcpServer,
  newlyUnlocked,
  orchestratorRules,
  nextAchievement,
  serverLabel,
  successStreak,
  meterColor,
  modelBadge,
  plainText,
  PRESERVE_INSTRUCTIONS,
  pushSample,
  rateLabel,
  shortModel,
  toolDetail,
  toolLabel,
  topTools,
} from "./lib";
import {
  dict,
  isLang,
  LANGS,
  langFromLocale,
  LOCALE,
  type Dict,
  type Lang,
} from "./i18n";
import {
  activityOf,
  characterSvg,
  ROLE_COLOR,
  roleOf,
  type Activity,
  type Mood,
  type Role,
} from "./characters";

type Engine = EngineInterface;

const PANE = "vanguard";
const TITLE = "Vanguard";
const heroes = atom({ plugin: "vanguard", key: "heroes" } as const, []);
const meters = atom({ plugin: "vanguard", key: "meters" } as const, null);
const commander = atom({ plugin: "vanguard", key: "commander" } as const, null);
const log = atom({ plugin: "vanguard", key: "log" } as const, []);
const snapshot = atom({ plugin: "vanguard", key: "snapshot" } as const, null);

const history = atom({ plugin: "vanguard", key: "history" } as const, []);

const arsenal = atom({ plugin: "vanguard", key: "arsenal" } as const, null);
const usage = atom({ plugin: "vanguard", key: "usage" } as const, null);
const unlocked = atom({ plugin: "vanguard", key: "unlocked" } as const, []);

const lifetime = atom({ plugin: "vanguard", key: "lifetime" } as const, null);
const collapsed = atom({ plugin: "vanguard", key: "collapsed" } as const, {});
const breakdown = atom({ plugin: "vanguard", key: "breakdown" } as const, null);
const tab = atom({ plugin: "vanguard", key: "tab" } as const, "overview");
const celebration = atom(
  { plugin: "vanguard", key: "celebration" } as const,
  null,
);
const langPick = atom({ plugin: "vanguard", key: "lang" } as const, null);
const levelSeen = atom({ plugin: "vanguard", key: "levelSeen" } as const, 0);
/** The agent whose page the pane shows instead of a tab: its id, or MAIN. */
const focus = atom({ plugin: "vanguard", key: "focus" } as const, null);
const MAIN = "main";

/** How long a banner stays, and an unlock is marked new. */
const CELEBRATE_MS = 8000;
const FRESH_UNLOCK_MS = 10_000;
/** How long a finished agent stays on the stage to take its bow. */
const BOW_MS = 15_000;
/** At most this many portraits move at once: each animated one is a frame of its own. */
const PORTRAIT_BUDGET = 13;
/**
 * A cell's width in CSS pixels, on the narrow side of the desktop's code
 * font, so a drawing sized in cells never overflows its slot.
 */
const CELL_PX = 7;
/** A portrait on a card, and the cells set aside for it. */
const PORTRAIT_PX = 52;
const PORTRAIT_CELLS = 8;
/** The portrait on an agent's page. */
const DETAIL_PX = 88;
const DETAIL_CELLS = 13;
/** What an agent's page keeps: its last steps, its brief and its report, clipped. */
const TRAIL_MAX = 30;
const BRIEF_MAX = 1200;
const REPORT_MAX = 3000;

/** The mod's settings, from the manifest's userConfig (the config menu). */
type Settings = {
  language: string;
  orchestrator: boolean;
  autoOpen: boolean;
  animations: boolean;
  sound: boolean;
  ctxWarn: number;
  ctxCritical: number;
  showArsenal: boolean;
  showAchievements: boolean;
  showLog: boolean;
};
const DEFAULTS: Settings = {
  language: "auto",
  orchestrator: true,
  autoOpen: true,
  animations: true,
  sound: true,
  ctxWarn: 70,
  ctxCritical: 85,
  showArsenal: true,
  showAchievements: true,
  showLog: true,
};
let settings: Settings = DEFAULTS;
let sessionId = "";
let lastSaved = "";

const STORE_SESSIONS = "sessions";
const STORE_UNLOCKED = "unlocked";
const STORE_COLLAPSED = "collapsed";
const STORE_TAB = "tab";

/**
 * The lifetime profile lives in one file under the home folder, not in
 * `$.store`: the store is keyed by where the mod is loaded from, so another
 * session or project would start from nothing. Every session of every
 * project reads and writes this one file.
 */
type Profile = {
  version: 1;
  sessions: Record<string, SessionRecord>;
  unlocked: Unlock[];
  collapsed: Record<string, boolean>;
  tab?: Tab;
  lang?: string;
};
const EMPTY_PROFILE: Profile = {
  version: 1,
  sessions: {},
  unlocked: [],
  collapsed: {},
};
let profilePath = "";

async function readProfile($: Engine): Promise<Profile> {
  if (!profilePath) return EMPTY_PROFILE;
  try {
    if (!(await $.fs.exists(profilePath))) return EMPTY_PROFILE;
    const raw = JSON.parse(await $.fs.read(profilePath)) as Partial<Profile>;
    return {
      version: 1,
      sessions: raw.sessions ?? {},
      unlocked: raw.unlocked ?? [],
      collapsed: raw.collapsed ?? {},
      tab: raw.tab,
      lang: raw.lang,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

/** Reads the file again right before writing, so parallel sessions keep each other's records. */
async function writeProfile(
  $: Engine,
  fn: (p: Profile) => Profile,
): Promise<void> {
  if (!profilePath) return;
  try {
    const next = fn(await readProfile($));
    await $.fs.write(profilePath, JSON.stringify(next, null, 1));
  } catch {
    // retried at the next change
  }
}

const unionUnlocks = (a: Unlock[], b: Unlock[]): Unlock[] => {
  const have = new Map(a.map((x) => [x.id, x]));
  for (const x of b) if (!have.has(x.id)) have.set(x.id, x);
  return [...have.values()];
};

const EMPTY_USAGE: Usage = {
  tools: {},
  skills: {},
  mcp: {},
  peak: 0,
  snapshots: 0,
};

const DONE_STATUSES: Record<string, HeroStatus> = {
  completed: "done",
  failed: "failed",
  killed: "stopped",
};
const STATUS_VIEW: Record<HeroStatus, { icon: IconName; color: string }> = {
  running: { icon: "activity", color: "warning" },
  done: { icon: "check", color: "success" },
  failed: { icon: "x", color: "error" },
  stopped: { icon: "stop", color: "inactive" },
};

/** The terminal draws no portraits: a glyph in the role's colour stands in. */
const ROLE_GLYPH: Record<Role, string> = {
  commander: "♛",
  scout: "◎",
  architect: "△",
  builder: "⚒",
  reviewer: "◉",
  verifier: "✔",
  guide: "✎",
  soldier: "⚔",
};

/** The language the system names (LC_ALL, LC_MESSAGES, LANG), read at session start. */
let systemLang: Lang = "en";

/** The pane's language: the pick in the pane, else the setting, else the system's. */
function langOf(picked: string | null | undefined): Lang {
  if (isLang(picked)) return picked;
  if (isLang(settings.language)) return settings.language;
  return systemLang;
}

/** The language for text written outside a drawing (toasts, command answers). */
async function textsFor($: Engine): Promise<Dict> {
  return dict(langOf(await read($, langPick).catch(() => null)));
}

async function detectSystemLang($: Engine): Promise<void> {
  const lcAll = await $.env.get("LC_ALL").catch(() => undefined);
  const lcMessages = await $.env.get("LC_MESSAGES").catch(() => undefined);
  const lang = await $.env.get("LANG").catch(() => undefined);
  let locale = lcAll || lcMessages || lang || undefined;
  if (!locale) {
    try {
      locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      // English, then
    }
  }
  systemLang = langFromLocale(locale);
}

/**
 * Runs bookkeeping that must never stand in the way: a failure here is
 * swallowed, so a tool call, an agent or a compaction goes on regardless.
 */
async function quietly(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch {
    // the pane misses one update; the session carries on
  }
}

/** A journal line, kept as a message key and its arguments so it reads in any language. */
async function addLog(
  $: Engine,
  icon: IconName,
  color: string,
  k: string,
  ...a: (string | number | boolean)[]
): Promise<void> {
  const at = await $.clock.now();
  await update($, log, (list: LogLine[]) =>
    [...list, { at, icon, color, text: "", msg: { k, a } }].slice(-40),
  );
}

async function patchHero(
  $: Engine,
  id: string,
  fn: (hero: Hero) => Hero,
): Promise<void> {
  await update($, heroes, (list: Hero[]) =>
    list.map((x) => (x.id === id ? fn(x) : x)),
  );
}

function toMeters(u: any, old?: Meters | null): Meters {
  return {
    contextTokens: u?.context?.tokens,
    contextWindow: u?.context?.window ?? 0,
    contextPercent: u?.context?.percent,
    rates: (u?.rateLimits ?? []).map((r: any) => ({
      kind: r.kind,
      percentUsed: r.percentUsed,
      resetsAt: r.resetsAt,
    })),
    usd: u?.cost?.usd,
    sessionStartedAt: u?.startedAt ?? old?.sessionStartedAt,
  };
}

async function syncAgents($: Engine): Promise<void> {
  let listed: any[] = [];
  try {
    listed = await $.agent.list();
  } catch {
    return;
  }
  const now = await $.clock.now();
  const known: Hero[] = await read($, heroes);
  const byId = new Map(known.map((x) => [x.id, x]));
  const fresh: Hero[] = [];
  for (const a of listed) {
    const hero = byId.get(a.id);
    const finished = DONE_STATUSES[a.status];
    if (!hero && !finished) {
      fresh.push({
        id: a.id,
        title: a.description || a.name || a.type,
        type: a.type,
        model: "?",
        status: "running",
        startedAt: now,
        actions: 0,
      });
    } else if (hero && hero.status === "running" && finished) {
      await patchHero($, a.id, (x) => ({
        ...x,
        status: finished,
        endedAt: now,
      }));
    }
  }
  if (fresh.length > 0)
    await update($, heroes, (list: Hero[]) => [...list, ...fresh]);
}

/** Reads what the session can reach: MCP servers from the tool list, plugins and skills from the commands. */
async function refreshArsenal($: Engine): Promise<void> {
  try {
    const [tools, commands] = await Promise.all([
      $.tool.list(),
      $.command.list(),
    ]);
    const servers = new Map<string, number>();
    for (const t of tools) {
      const server = t.mcp ? mcpServer(t.name) : undefined;
      if (server) servers.set(server, (servers.get(server) ?? 0) + 1);
    }
    const plugins = new Map<string, number>();
    for (const c of commands)
      if (c.source === "plugin" && c.plugin)
        plugins.set(c.plugin, (plugins.get(c.plugin) ?? 0) + 1);
    const skills = commands
      .filter((c) => c.source === "user" || c.source === "plugin")
      .map((c) => ({
        name: c.name,
        source: c.source,
        plugin: c.plugin,
        description: c.description,
      }));
    const known: Breakdown | null = await read($, breakdown);
    const labels = new Map((known?.mcp ?? []).map((x) => [x.key, x.label]));
    const tokens = new Map((known?.mcp ?? []).map((x) => [x.key, x.tokens]));
    const at = await $.clock.now();
    await update(
      $,
      arsenal,
      (): Arsenal => ({
        mcp: [...servers].map(([name, n]) => ({
          name,
          tools: n,
          label: labels.get(name),
          tokens: tokens.get(name),
        })),
        plugins: [...plugins].map(([name, n]) => ({ name, commands: n })),
        skills,
        at,
      }),
    );
  } catch {
    // the arsenal is a nicety: the pane draws what it has
  }
}

/** Reads what the context is made of, as /context counts it (estimated locally, no request). */
async function refreshBreakdown($: Engine): Promise<void> {
  try {
    const u = await $.session.usage({ breakdown: "summary" });
    const b = u.context.breakdown;
    if (!b) return;
    const servers = new Map<string, { label: string; tokens: number }>();
    for (const t of b.mcpTools) {
      const key = mcpServer(t.name);
      if (!key) continue;
      const old = servers.get(key);
      servers.set(key, {
        label: t.serverName,
        tokens: (old?.tokens ?? 0) + t.tokens,
      });
    }
    const at = await $.clock.now();
    await update(
      $,
      breakdown,
      (): Breakdown => ({
        rows: b.categories.map((c) => ({
          name: c.name,
          tokens: c.tokens,
          kind: c.kind,
        })),
        total: b.totalTokens,
        max: b.maxTokens,
        memory: b.memoryFiles.map((f) => ({ path: f.path, tokens: f.tokens })),
        agents: b.agents.map((x) => ({ name: x.agentType, tokens: x.tokens })),
        mcp: [...servers].map(([key, v]) => ({ key, ...v })),
        at,
      }),
    );
  } catch {
    // the breakdown is optional: the tab says it has none yet
  }
}

async function bumpUsage($: Engine, fn: (u: Usage) => Usage): Promise<void> {
  await update($, usage, (u: Usage | null) =>
    fn({ ...EMPTY_USAGE, ...(u ?? {}) }),
  );
}

/** This session's contribution to the profile, from the live counters. */
function recordOf(
  list: Hero[],
  u: Usage,
  usd: number | undefined,
  at: number,
): SessionRecord {
  const finished = list.filter((x) => x.status !== "running");
  const count = (...names: string[]) =>
    names.reduce((n, k) => n + (u.tools[k] ?? 0), 0);

  return {
    ...emptyRecord(sessionId, at),
    agentsTotal: list.length,
    agentsDone: finished.filter((x) => x.status === "done").length,
    peakParallel: u.peak,
    streak: successStreak(finished.map((x) => x.status)),
    calls: Object.values(u.tools).reduce((a, b) => a + b, 0),
    mcpCalls: Object.values(u.mcp).reduce((a, b) => a + b, 0),
    mcpServers: Object.keys(u.mcp),
    skillUses: Object.values(u.skills).reduce((a, b) => a + b, 0),
    reads: count("Read"),
    edits: count("Edit", "Write", "NotebookEdit"),
    bashes: count("Bash"),
    snapshots: u.snapshots,
    usd: usd ?? 0,
  };
}

async function currentRecord($: Engine): Promise<SessionRecord> {
  const list: Hero[] = await read($, heroes);
  const u: Usage = { ...EMPTY_USAGE, ...((await read($, usage)) ?? {}) };
  const m: Meters | null = await read($, meters);

  return recordOf(list, u, m?.usd, await $.clock.now());
}

/** Writes this session's record into the lifetime store when it changed. */
async function saveSession($: Engine): Promise<void> {
  if (!sessionId) return;
  try {
    const rec = await currentRecord($);
    // A session that did nothing (opened and closed) is no session of the profile.
    if (rec.calls === 0 && rec.agentsTotal === 0 && rec.usd === 0) return;
    const { at: _at, ...body } = rec;
    const key = JSON.stringify(body);
    if (key === lastSaved) return;
    await writeProfile($, (p) => ({
      ...p,
      sessions: trimSessions({ ...p.sessions, [sessionId]: rec }, 300),
    }));
    lastSaved = key;
  } catch {
    // the profile is a nicety: a failed write is retried at the next tick
  }
}

/**
 * Loads the profile: the other sessions' sum, the lifetime unlocks, the folded
 * sections and the tab. A profile this mod kept in `$.store` before is folded
 * into the shared file once.
 */
async function loadProfile($: Engine): Promise<void> {
  try {
    const home = (await $.env.get("HOME")) ?? "";
    if (home) {
      profilePath = `${home}/.claude/vanguard/profile.json`;
      // Vanguard began as "agent-arena": carry that profile over once.
      const earlier = `${home}/.claude/agent-arena/profile.json`;
      if (!(await $.fs.exists(profilePath)) && (await $.fs.exists(earlier)))
        await $.fs.write(profilePath, await $.fs.read(earlier));
    }
    const legacySessions = ((await $.store
      .get(STORE_SESSIONS)
      .catch(() => undefined)) ?? {}) as Record<string, SessionRecord>;
    const legacyUnlocked = ((await $.store
      .get(STORE_UNLOCKED)
      .catch(() => undefined)) ?? []) as Unlock[];
    const legacyFolded = ((await $.store
      .get(STORE_COLLAPSED)
      .catch(() => undefined)) ?? {}) as Record<string, boolean>;
    const legacyTab = (await $.store.get(STORE_TAB).catch(() => undefined)) as
      | Tab
      | undefined;
    const hasLegacy =
      Object.keys(legacySessions).length > 0 ||
      legacyUnlocked.length > 0 ||
      Object.keys(legacyFolded).length > 0;
    if (hasLegacy) {
      await writeProfile($, (p) => ({
        ...p,
        sessions: trimSessions({ ...legacySessions, ...p.sessions }, 300),
        unlocked: unionUnlocks(p.unlocked, legacyUnlocked),
        collapsed: { ...legacyFolded, ...p.collapsed },
        tab: p.tab ?? legacyTab,
      }));
      for (const key of [
        STORE_SESSIONS,
        STORE_UNLOCKED,
        STORE_COLLAPSED,
        STORE_TAB,
      ])
        await $.store.delete(key).catch(() => {});
    }
    const p = await readProfile($);
    const others = Object.values(p.sessions).filter((r) => r.id !== sessionId);
    await update(
      $,
      lifetime,
      (): Lifetime => ({
        sessions: others.length,
        others: others.reduce((acc, r) => mergeRecords(acc, r), emptyRecord()),
      }),
    );
    await update($, unlocked, (old: Unlock[] | undefined) =>
      unionUnlocks(old ?? [], p.unlocked),
    );
    if (p.tab) await update($, tab, () => p.tab as Tab);
    if (isLang(p.lang)) await update($, langPick, () => p.lang as string);
    await update($, collapsed, (old: Record<string, boolean> | undefined) => ({
      ...p.collapsed,
      ...(old ?? {}),
    }));
  } catch {
    // a missing profile leaves a fresh one
  }
}

/** Lifetime counters: every other session plus this one. */
async function lifetimeRecord($: Engine): Promise<SessionRecord> {
  const life: Lifetime | null = await read($, lifetime);

  return mergeRecords(life?.others ?? emptyRecord(), await currentRecord($));
}

/** Unlocks what the counters now reach, with a toast and a log line each. */
async function checkAchievements($: Engine): Promise<void> {
  const have: Unlock[] = (await read($, unlocked)) ?? [];
  const life = await lifetimeRecord($);
  const fresh = newlyUnlocked(
    statsOfRecord(life),
    have.map((x) => x.id),
  );
  const at = await $.clock.now();
  const lvl = levelOf(xpOf(life) + (have.length + fresh.length) * 150).level;
  const seen: number = (await read($, levelSeen)) ?? 0;
  if (seen === 0) {
    await update($, levelSeen, () => lvl);
  } else if (lvl > seen) {
    await update($, levelSeen, () => lvl);
    await update(
      $,
      celebration,
      (): Celebration => ({ kind: "level", level: lvl, at }),
    );
    $.ui.toast((await textsFor($)).newLevel(lvl));
    await addLog($, "trophy", "warning", "newLevel", lvl);
    if (settings.sound)
      void $.audio
        .play({ asset: "sounds/achievement.wav" }, { gain: 0.6 })
        .catch(() => {});
  }
  if (fresh.length === 0) return;
  const next = [...have, ...fresh.map((a) => ({ id: a.id, at }))];
  await update($, unlocked, () => next);
  await writeProfile($, (p) => ({
    ...p,
    unlocked: unionUnlocks(p.unlocked, next),
  }));
  const first = fresh[0];
  if (first)
    await update(
      $,
      celebration,
      (): Celebration => ({
        kind: "achievement",
        ids: fresh.map((a) => a.id),
        at,
      }),
    );
  const T = await textsFor($);
  for (const a of fresh) {
    const text = T.ach[a.id] ?? a;
    $.ui.toast(T.achToast(text.title, text.hint));
    await addLog($, "medal", "warning", "logAch", a.id);
  }
  if (settings.sound)
    void $.audio
      .play({ asset: "sounds/achievement.wav" }, { gain: 0.6 })
      .catch(() => {});
}

async function handoffPath($: Engine, at: number): Promise<string> {
  const home = (await $.env.get("HOME")) ?? ".";
  const stamp = new Date(at).toISOString().slice(0, 16).replace(/[:T]/g, "-");

  return `${home}/.claude/handoffs/${stamp}.md`;
}

/** Compacts now and says what came of it, for a toast or the command's answer. */
async function compactNow($: Engine): Promise<string> {
  const T = await textsFor($);
  try {
    const r = await $.session.compact({ instructions: "Prepare a handoff." });
    if (r.skip) return T.compactSkipped(r.skip);
    return T.compactDone;
  } catch {
    return T.compactBusy;
  }
}

/** Session start: commands, profile, first readings, the timer and the pane. */
async function startUp($: Engine): Promise<void> {
  sessionId = await $.session.id().catch(() => "");
  await quietly(() => detectSystemLang($));
  await quietly(() => loadProfile($));
  const T = await textsFor($);
  await quietly(() =>
    $.command.register({
      name: "vanguard",
      description: T.cmdVanguard,
    }),
  );
  await quietly(() =>
    $.command.register({
      name: "handoff",
      description: T.cmdHandoff,
    }),
  );
  await quietly(async () => {
    const now = await $.clock.now();
    await update(
      $,
      commander,
      (c: Commander | null) =>
        c ?? {
          model: "?",
          steps: 0,
          actions: 0,
          toolCounts: {},
          startedAt: now,
        },
    );
  });
  await quietly(async () => {
    await update($, meters, (old: Meters | null) => old ?? toMeters(null));
    const usage = await $.session.usage();
    await update($, meters, (old: Meters | null) => toMeters(usage, old));
  });
  await quietly(() => syncAgents($));
  await quietly(() => refreshBreakdown($));
  await quietly(() => refreshArsenal($));
  await quietly(() => checkAchievements($));
  let ticks = 0;
  let drawn = "";
  $.clock.every(1000, () => {
    ticks += 1;
    void quietly(async () => {
      if (ticks % 3 === 0) await syncAgents($);
      if (ticks % 30 === 0) await refreshBreakdown($);
      if (ticks % 60 === 0) await refreshArsenal($);
      if (ticks % 15 === 0) await saveSession($);
      // State changes redraw their readers by themselves. The clock alone
      // redraws only when something the clock drives would show differently:
      // a running time turning a minute, a bow ending, a banner going away.
      // Portraits animate in their own frames and need no redraw at all.
      const list: Hero[] = await read($, heroes);
      const party: Celebration | null = await read($, celebration);
      const m: Meters | null = await read($, meters);
      const boss: Commander | null = await read($, commander);
      const got: Unlock[] = (await read($, unlocked)) ?? [];
      const now = await $.clock.now();
      const minute = (since: number) => Math.floor((now - since) / 60_000);
      const shown = [
        minute(m?.sessionStartedAt ?? boss?.startedAt ?? now),
        ...(m?.rates ?? []).map((r) =>
          r.resetsAt ? minute(Date.parse(r.resetsAt)) : 0,
        ),
        ...got.map((x) => now - x.at < FRESH_UNLOCK_MS),
        ...list.map((x) =>
          x.status === "running"
            ? minute(x.startedAt)
            : now - (x.endedAt ?? 0) < BOW_MS,
        ),
        party !== null && now - party.at < CELEBRATE_MS,
      ].join();
      if (shown !== drawn || ticks % 30 === 0) {
        drawn = shown;
        $.ui.invalidate("ui.render");
      }
    });
  });
  if (settings.autoOpen)
    void $.ui.open({ id: PANE, title: TITLE }).catch(() => {});
}

export const register: Register = (on, options) => {
  settings = { ...DEFAULTS, ...(options as Partial<Settings>) };

  on("session.start", async ($, e, next) => {
    await quietly(() => startUp($));

    return next(e);
  });

  // The orchestration rules: one section after the engine's own, while the setting is on.
  on("prompt.compose", async ($, e, next) => {
    const result = await next(e);
    if (!settings.orchestrator) return result;

    return {
      sections: [
        ...result.sections.filter((x) => x.id !== "vanguard:orchestrator"),
        {
          id: "vanguard:orchestrator",
          text: orchestratorRules(settings.ctxCritical),
          scope: "session" as const,
        },
      ],
    };
  });

  on("command.run", { command: "vanguard" }, async ($) => {
    await $.ui.open({ id: PANE, title: TITLE });

    return { text: (await textsFor($)).opened };
  });

  on("command.run", { command: "handoff" }, async ($) => {
    return { text: await compactNow($) };
  });

  on("agent.spawn", async ($, e, next) => {
    const started = await next(e);
    await quietly(async () => {
      if (started.agentId) {
        const now = await $.clock.now();
        const hero: Hero = {
          id: started.agentId,
          title: e.description || e.subagentType,
          type: e.subagentType || "general-purpose",
          model: started.model,
          status: "running",
          startedAt: now,
          actions: 0,
          brief:
            typeof e.prompt === "string"
              ? clip(plainText(e.prompt), BRIEF_MAX)
              : "",
        };
        await update($, heroes, (list: Hero[]) => [
          ...list.filter((x) => x.id !== hero.id),
          hero,
        ]);
        const badge = modelBadge(started.model);
        await addLog($, badge.icon, badge.color, "logLaunched", hero.title);
        const live = ((await read($, heroes)) as Hero[]).filter(
          (x) => x.status === "running",
        ).length;
        await bumpUsage($, (u) => ({ ...u, peak: Math.max(u.peak, live) }));
        await checkAchievements($);
      }
    });

    return started;
  });

  on("turn.step", async function* ($, e, next) {
    await quietly(async () => {
      const effort = e.effort === undefined ? undefined : String(e.effort);
      if (e.agentId) {
        await patchHero($, e.agentId, (x) => ({
          ...x,
          model: e.model,
          effort,
          status: "running",
          endedAt: undefined,
        }));
      } else {
        await update($, commander, (c: Commander | null) =>
          c
            ? { ...c, model: e.model, effort, steps: c.steps + 1, busy: true }
            : c,
        );
      }
    });

    return yield* next(e);
  });

  on("tool.call", async ($, e, next) => {
    await quietly(async () => {
      const args = e as unknown as Record<string, unknown>;
      const detail = toolDetail(args);
      const server = mcpServer(e.tool);
      const skill =
        e.tool === "Skill" && typeof args.skill === "string"
          ? args.skill
          : undefined;
      const at = await $.clock.now();
      const before: Usage | null = await read($, usage);
      const firstOnServer = server !== undefined && !before?.mcp?.[server];
      await bumpUsage($, (u) => ({
        ...u,
        tools: { ...u.tools, [e.tool]: (u.tools[e.tool] ?? 0) + 1 },
        mcp: server ? { ...u.mcp, [server]: (u.mcp[server] ?? 0) + 1 } : u.mcp,
        skills: skill
          ? { ...u.skills, [skill]: (u.skills[skill] ?? 0) + 1 }
          : u.skills,
        lastSkill: skill ? { name: skill, at } : u.lastSkill,
      }));
      if (server && firstOnServer) {
        const arms: Arsenal | null = await read($, arsenal);
        const label =
          arms?.mcp.find((x) => x.name === server)?.label ??
          serverLabel(server);
        await addLog($, "plug", "suggestion", "logMcp", label);
      }
      if (skill) await addLog($, "zap", "merged", "logSkill", skill);
      await checkAchievements($);
      if (e.agentId) {
        await patchHero($, e.agentId, (x) => ({
          ...x,
          actions: x.actions + 1,
          lastAction: e.tool,
          lastDetail: detail,
          toolCounts: {
            ...(x.toolCounts ?? {}),
            [e.tool]: ((x.toolCounts ?? {})[e.tool] ?? 0) + 1,
          },
          trail: [...(x.trail ?? []), { at, tool: e.tool, detail }].slice(
            -TRAIL_MAX,
          ),
        }));
      } else {
        await update($, commander, (c: Commander | null) =>
          c
            ? {
                ...c,
                actions: c.actions + 1,
                lastAction: e.tool,
                lastDetail: detail,
                toolCounts: {
                  ...(c.toolCounts ?? {}),
                  [e.tool]: ((c.toolCounts ?? {})[e.tool] ?? 0) + 1,
                },
                trail: [...(c.trail ?? []), { at, tool: e.tool, detail }].slice(
                  -TRAIL_MAX,
                ),
              }
            : c,
        );
      }
    });

    return next(e);
  });

  on("turn.complete", async ($, e, next) => {
    await quietly(async () => {
      if (e.agentId) {
        const now = await $.clock.now();
        const status: HeroStatus =
          e.reason === "answer"
            ? "done"
            : e.reason === "aborted"
              ? "stopped"
              : "failed";
        const u = e.usage;
        const tokens = u
          ? u.input_tokens +
            u.output_tokens +
            u.cache_read_input_tokens +
            u.cache_creation_input_tokens
          : 0;
        const hero = ((await read($, heroes)) as Hero[]).find(
          (x) => x.id === e.agentId,
        );
        await patchHero($, e.agentId, (x) => ({
          ...x,
          status,
          endedAt: now,
          tokens: (x.tokens ?? 0) + tokens,
          report: e.answer ? clip(plainText(e.answer), REPORT_MAX) : x.report,
        }));
        if (hero) {
          const view = STATUS_VIEW[status];
          await addLog(
            $,
            view.icon,
            view.color,
            "logStatus",
            status,
            hero.title,
            now - hero.startedAt,
          );
        }
        await checkAchievements($);
      } else {
        await update($, commander, (c: Commander | null) =>
          c
            ? {
                ...c,
                busy: false,
                lastAction: undefined,
                lastDetail: undefined,
              }
            : c,
        );
      }
    });

    return next(e);
  });

  // A skill the person typed as /name: the Skill tool's own runs are counted at tool.call.
  on("skill.prompt", async ($, e, next) => {
    await quietly(async () => {
      const at = await $.clock.now();
      const u: Usage | null = await read($, usage);
      const viaTool =
        u?.lastSkill?.name === e.skill && at - u.lastSkill.at < 10_000;
      if (!viaTool) {
        await bumpUsage($, (x) => ({
          ...x,
          skills: { ...x.skills, [e.skill]: (x.skills[e.skill] ?? 0) + 1 },
        }));
        await addLog($, "zap", "merged", "logSkill", e.skill);
        await checkAchievements($);
      }
    });

    return next(e);
  });

  on("session.measure", async ($, e, next) => {
    await quietly(async () => {
      await update($, meters, (old: Meters | null) => toMeters(e, old));
      const at = await $.clock.now();
      const sample: Sample = {
        at,
        ctx: e.context?.percent,
        five: e.rateLimits.find((r) => r.kind === "five_hour")?.percentUsed,
        usd: e.cost?.usd,
      };
      await update($, history, (list: Sample[] | undefined) =>
        pushSample(
          list ?? [],
          sample,
          (a, b) => a.ctx === b.ctx && a.five === b.five,
        ),
      );
    });

    return next(e);
  });

  // Context guard: every compaction of the main loop keeps the plan, and leaves a snapshot on disk.
  on("session.compact", async ($, e, next) => {
    if (e.agentId || e.trigger === "precompute") return next(e);
    const instructions = [e.instructions, PRESERVE_INSTRUCTIONS]
      .filter(Boolean)
      .join("\n\n");
    const result = await next({ ...e, instructions });
    if (result.skip !== undefined) return result;
    try {
      const at = await $.clock.now();
      const path = await handoffPath($, at);
      const summary = (result.messages ?? [])
        .map((m: { text: string }) => m.text)
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 60_000);
      const text = handoffMarkdown({
        at,
        sessionId: await $.session.id(),
        cwd: await $.session.cwd(),
        model: await $.session.model(),
        tokensBefore: result.tokensBefore,
        heroes: await read($, heroes),
        summary,
        path,
      });
      await $.fs.write(path, text);
      await $.fs.write(path.replace(/[^/]+$/, "LATEST.md"), text);
      await update(
        $,
        snapshot,
        (): Snapshot => ({
          at,
          path,
          trigger: e.trigger,
        }),
      );
      await addLog(
        $,
        "save",
        "suggestion",
        "logSnapshot",
        e.trigger === "auto",
      );
      await bumpUsage($, (u) => ({ ...u, snapshots: u.snapshots + 1 }));
      await checkAchievements($);
    } catch {
      $.ui.toast((await textsFor($)).snapshotFailed);
    }

    return result;
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e);
    const { Box, Text, Button } = els;
    // The terminal table carries Svg too, and draws nothing for it: glyphs there.
    const Svg = e.surface !== "terminal" && "Svg" in els ? els.Svg : undefined;
    const Markdown = "Markdown" in els ? els.Markdown : undefined;
    const width = Math.max(24, e.props.bodyColumns ?? 80);
    // Two breakpoints: narrow stacks everything in one column, wide sets
    // sections side by side. The squad grid finds its own column count.
    const isNarrow = width < 64;
    const isWide = width >= 110;
    const now = await $.clock.now();
    const list: Hero[] = await read($, heroes);
    const m: Meters | null = await read($, meters);
    const boss: Commander | null = await read($, commander);
    const lines: LogLine[] = await read($, log);
    const snap: Snapshot | null = await read($, snapshot);
    const samples: Sample[] = (await read($, history)) ?? [];
    const arms: Arsenal | null = await read($, arsenal);
    const used: Usage = { ...EMPTY_USAGE, ...((await read($, usage)) ?? {}) };
    const have: Unlock[] = (await read($, unlocked)) ?? [];
    const focusId: string | null = await read($, focus);

    const running = list
      .filter((x) => x.status === "running")
      .sort((a, b) => a.startedAt - b.startedAt);
    const finished = list.filter((x) => x.status !== "running");
    // A finished agent stays on the stage for a moment to take its bow.
    const bowing = finished.filter((x) => now - (x.endedAt ?? 0) < BOW_MS);
    const offStage = finished.filter((x) => now - (x.endedAt ?? 0) >= BOW_MS);
    const won = list.filter((x) => x.status === "done").length;
    const lost = list.filter((x) => x.status === "failed").length;
    const agentCalls = list.reduce((s, x) => s + x.actions, 0);
    const actions = agentCalls + (boss?.actions ?? 0);
    const agentTokens = list.reduce((s, x) => s + (x.tokens ?? 0), 0);
    const life: Lifetime | null = await read($, lifetime);
    const sessionRec = recordOf(list, used, m?.usd, now);
    const lifeRec = mergeRecords(life?.others ?? emptyRecord(), sessionRec);
    const sessionXp = xpOf(sessionRec);
    const lv = levelOf(xpOf(lifeRec) + have.length * 150);
    const anim = settings.animations;
    const L: Lang = langOf(await read($, langPick));
    const T = dict(L);
    /** A finished length, to the second. */
    const dur = (ms: number) => fmtDuration(ms, T.units);
    /** A running length, to the minute, so the pane redraws once a minute for it. */
    const age = (ms: number) => fmtAge(ms, T.units);
    /** A journal line in this drawing's language. */
    const logText = (l: LogLine): string => {
      if (!l.msg) return l.text;
      const [a0, a1, a2] = l.msg.a;
      switch (l.msg.k) {
        case "logStatus":
          return T.logStatus(
            T.status[a0 as HeroStatus] ?? String(a0),
            String(a1),
            dur(Number(a2)),
          );
        case "logAch":
          return T.logAch(T.ach[String(a0)]?.title ?? String(a0));
        case "newLevel":
          return T.newLevel(Number(a0));
        case "logLaunched":
          return T.logLaunched(String(a0));
        case "logMcp":
          return T.logMcp(String(a0));
        case "logSkill":
          return T.logSkill(String(a0));
        case "logSnapshot":
          return T.logSnapshot(a0 === true);
        default:
          return l.text;
      }
    };
    const parts: Breakdown | null = await read($, breakdown);
    const party: Celebration | null = await read($, celebration);
    const shownTabs: { id: Tab; label: string }[] = [
      { id: "overview", label: T.tabOverview },
      { id: "context", label: T.tabContext },
      ...(settings.showArsenal
        ? [{ id: "arsenal" as const, label: T.tabArsenal }]
        : []),
      ...(settings.showAchievements
        ? [
            {
              id: "achievements" as const,
              label: isNarrow ? T.tabAchievementsShort : T.tabAchievements,
            },
          ]
        : []),
      ...(settings.showLog ? [{ id: "log" as const, label: T.tabLog }] : []),
    ];
    const savedTab: Tab = (await read($, tab)) ?? "overview";
    const current: Tab = shownTabs.some((t) => t.id === savedTab)
      ? savedTab
      : "overview";
    const mcpNames: Record<string, string> = Object.fromEntries(
      (arms?.mcp ?? []).flatMap((x) => (x.label ? [[x.name, x.label]] : [])),
    );
    const serverName = (key: string) => mcpNames[key] ?? serverLabel(key);
    const ctxUsed = m?.contextPercent;
    const ctx = contextLevel(ctxUsed, settings.ctxWarn, settings.ctxCritical);
    const sessionStart = m?.sessionStartedAt ?? boss?.startedAt ?? now;
    const sessionMs = now - sessionStart;

    // One spacing scale. A cell is about twice as tall as it is wide, so a
    // side inset of two cells reads as even with one row above and below.
    const space = {
      outerX: isNarrow ? 1 : 2,
      outerY: isNarrow ? 0 : 1,
      gapX: 2,
      gapY: 1,
      cardX: 1,
    };
    const inner = width - space.outerX * 2;
    /** Cells left for text in a column of `cols` equal columns. */
    const colRoom = (cols: number) =>
      Math.floor((inner - space.gapX * (cols - 1)) / cols);
    const half = isNarrow ? inner : colRoom(2);

    /** An icon: a Lucide SVG where the surface draws one, a glyph on the terminal. */
    const icon = (
      name: string,
      color: string,
      size = 14,
      key?: string,
    ): RenderNode => {
      const known = name in GLYPHS;
      if (Svg && known)
        return (
          <Svg
            key={key}
            source={iconSvg(name as IconName, color)}
            alt={name}
            width={size}
            height={size}
          />
        );

      return (
        <Text key={key} color={color}>
          {known ? GLYPHS[name as IconName] : name}
        </Text>
      );
    };

    /** A progress bar `cells` wide: a rounded SVG where drawn, block characters on the terminal. */
    const progress = (
      percent: number,
      color: string,
      cells: number,
      key?: string,
    ): RenderNode =>
      Svg ? (
        <Svg
          key={key}
          source={barSvg(percent, color)}
          alt={`${Math.round(percent)}%`}
          width={cells * CELL_PX}
          height={8}
        />
      ) : (
        <Text key={key} color={color}>
          {bar(percent, cells)}
        </Text>
      );

    // Portraits need room: below it a glyph in the role's colour stands in.
    const showArt = Svg !== undefined && inner >= 36;
    let portraitsLeft = PORTRAIT_BUDGET;
    /**
     * A squad member's portrait: an animated character where the surface draws
     * one (the first few on the stage), its role's glyph on the terminal. The
     * markup depends on what the agent does, never on the clock, so a redraw
     * keeps its frame and the motion does not restart.
     */
    const portrait = (
      key: string,
      role: Role,
      activity: Activity,
      mood: Mood,
      seed: string,
      px: number,
    ): RenderNode => {
      if (!Svg || !showArt)
        return (
          <Text key={key} bold color={ROLE_COLOR[role]}>
            {ROLE_GLYPH[role]}
          </Text>
        );
      const isLive = anim && portraitsLeft-- > 0;

      return (
        <Svg
          key={key}
          source={characterSvg({
            role,
            activity,
            mood,
            seed,
            animated: isLive,
          })}
          alt={T.roles[role] ?? role}
          width={px}
          height={px}
          isInteractive={isLive ? true : undefined}
        />
      );
    };

    /** An icon followed by text, on one line that truncates rather than wraps. */
    const line = (
      key: string,
      lead: RenderNode | null,
      body: RenderChildren,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        alignItems="center"
        columnGap={1}
        minWidth={0}
        flexShrink={1}
      >
        {lead}
        {body}
      </Box>
    );

    /** A titled block: no frame, the heading carries it; `col` shares a row equally. */
    const section = (
      key: string,
      name: IconName,
      title: string,
      color: string,
      body: RenderChildren,
      w: "col" | "100%" = "100%",
      aside?: RenderChildren,
    ) => (
      <Box
        key={key}
        flexDirection="column"
        width={w === "col" ? 0 : "100%"}
        minWidth={0}
        flexGrow={1}
        flexShrink={1}
      >
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          columnGap={space.gapX}
        >
          {line(`${key}-title`, icon(name, color), <Text bold>{title}</Text>)}
          {aside ? <Box flexShrink={0}>{aside}</Box> : null}
        </Box>
        <Box flexDirection="column" minWidth={0}>
          {body}
        </Box>
      </Box>
    );

    /** Sections side by side; stacked when narrow. */
    const row = (key: string, children: RenderNode[]) => (
      <Box
        key={key}
        flexDirection={isNarrow ? "column" : "row"}
        columnGap={space.gapX}
        rowGap={space.gapY}
      >
        {children}
      </Box>
    );
    const colW = isNarrow ? "100%" : "col";

    /** Lays cells out in rows of `cols` equal columns; blanks pad the last row. */
    const grid = (
      key: string,
      cells: RenderNode[],
      cols: number,
      rowGap: number = space.gapY,
      columnGap: number = space.gapX,
    ) => {
      const rows: RenderNode[][] = [];
      for (let i = 0; i < cells.length; i += cols)
        rows.push(cells.slice(i, i + cols));

      return (
        <Box key={key} flexDirection="column" rowGap={rowGap}>
          {rows.map((r, i) => (
            <Box key={`${key}-r${i}`} flexDirection="row" columnGap={columnGap}>
              {Array.from({ length: cols }, (_, j) => (
                <Box
                  key={`${key}-c${j}`}
                  flexDirection="column"
                  width={0}
                  minWidth={0}
                  flexGrow={1}
                >
                  {r[j] ?? null}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      );
    };

    /** Opens an agent's page. */
    const openAgent = async (id: string) => {
      await update($, focus, () => id);
      await $.ui.scroll({ in: PANE, to: "start" }).catch(() => {});
    };
    /**
     * An agent's name that opens its page when pressed. The name is the
     * label itself: a Button takes one string child, or none, on engines
     * before 2.1.295.
     */
    const opener = (id: string, title: string, max: number): RenderNode => (
      <Button
        key={`open-${id}`}
        plain
        label={`${clip(title, Math.max(8, max - 2))} ›`}
        onPress={() => openAgent(id)}
      />
    );

    /** What a squad member is busy with: a verb for the kind of work, then its object. */
    const doing = (
      key: string,
      tool: string | undefined,
      detail: string | undefined,
      max: number,
    ): RenderNode => {
      const act = activityOf(tool);
      const verb =
        tool && act === "think"
          ? toolLabel(tool, mcpNames)
          : (T.doing[act] ?? act);

      return line(
        key,
        icon(tool ? toolIcon(tool) : "sparkles", "subtle", 12),
        <Text wrap="truncate-end">
          <Text>{verb}</Text>
          {detail ? (
            <Text dimColor> · {clip(detail, Math.max(8, max - 12))}</Text>
          ) : null}
        </Text>,
      );
    };

    /** How a finished agent ended, and how long it took. */
    const outcome = (key: string, hero: Hero): RenderNode => {
      const view = STATUS_VIEW[hero.status];

      return line(
        key,
        icon(view.icon, view.color, 12),
        <Text wrap="truncate-end">
          <Text color={view.color}>{T.status[hero.status]}</Text>
          <Text dimColor> · {dur((hero.endedAt ?? now) - hero.startedAt)}</Text>
        </Text>,
      );
    };

    const moodOf = (hero: Hero): Mood =>
      hero.status === "running" ? "working" : hero.status;
    const modelName = (model: string | undefined) =>
      !model || model === "?" ? T.modelPending : shortModel(model);

    // ── Header ───────────────────────────────────────────────────────────
    const subtitle = `${T.sessionNo((life?.sessions ?? 0) + 1)} · ${
      boss && boss.model !== "?" ? shortModel(boss.model) : T.modelPending
    }${
      isNarrow
        ? ""
        : ` · ${
            running.length > 0
              ? T.agentsWorking(running.length)
              : T.noAgentsRunning
          }`
    }`;
    const header = (
      <Box
        key="header"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        columnGap={space.gapX}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          columnGap={1}
          flexShrink={1}
          minWidth={0}
        >
          {Svg ? (
            <Svg
              key="logo"
              source={LOGO_SVG}
              alt="Vanguard"
              width={28}
              height={28}
            />
          ) : (
            <Text bold color="claude">
              ⚔
            </Text>
          )}
          <Box flexDirection="column" flexShrink={1} minWidth={0}>
            <Text bold color="claude">
              {Svg ? "Vanguard" : "VANGUARD"}
            </Text>
            <Text dimColor wrap="truncate-end">
              {subtitle}
            </Text>
          </Box>
        </Box>
        <Box flexDirection="column" alignItems="flex-end" flexShrink={0}>
          <Text bold color="warning">
            {isNarrow ? T.levelShort(lv.level) : T.level(lv.level)}
          </Text>
          <Text dimColor>
            {lv.xp} XP
            {sessionXp && !isNarrow ? ` · ${T.sessionGain(sessionXp)}` : ""}
          </Text>
        </Box>
      </Box>
    );

    // ── Stats: one line of figures ───────────────────────────────────────
    const stat = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      value: string,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        alignItems="center"
        columnGap={1}
        flexShrink={0}
      >
        {icon(name, color, 12)}
        <Text>
          <Text dimColor>{label} </Text>
          <Text bold>{value}</Text>
        </Text>
      </Box>
    );
    const stats = (
      <Box
        key="stats"
        flexDirection="row"
        flexWrap="wrap"
        columnGap={3}
        rowGap={0}
      >
        {stat("s-time", "clock", "claude", T.tileSession, age(sessionMs))}
        {stat(
          "s-agents",
          "users",
          "warning",
          T.figAgents,
          `${running.length}/${list.length}${lost ? ` · ${lost} ✗` : ""}`,
        )}
        {stat("s-calls", "wrench", "suggestion", T.tileCalls, String(actions))}
        {agentTokens
          ? stat(
              "s-tokens",
              "layers",
              "merged",
              T.figTokens,
              fmtTokens(agentTokens),
            )
          : null}
        {m?.usd !== undefined
          ? stat(
              "s-usd",
              "coins",
              "success",
              T.tileSpend,
              `$${m.usd.toFixed(2)}`,
            )
          : null}
      </Box>
    );

    // ── Squad: the main agent and every subagent, as characters ──────────
    const stageCols = Math.max(
      1,
      Math.min(
        4,
        Math.floor((inner + space.gapX) / ((Svg ? 36 : 28) + space.gapX)),
      ),
    );
    // Text room in a card: its column, less the frame, the inset and the portrait.
    const cardText =
      colRoom(stageCols) -
      2 -
      space.cardX * 2 -
      (showArt ? PORTRAIT_CELLS + 1 : 0);
    const card = (
      key: string,
      color: string,
      art: RenderNode,
      rows: RenderNode[],
    ) => (
      <Box
        key={key}
        flexDirection="row"
        alignItems="center"
        columnGap={1}
        borderStyle="round"
        borderColor="inactive"
        hover={{ borderColor: color }}
        paddingX={space.cardX}
        minWidth={0}
        width="100%"
      >
        {showArt ? (
          <Box
            flexShrink={0}
            width={PORTRAIT_CELLS}
            alignItems="center"
            justifyContent="center"
          >
            {art}
          </Box>
        ) : null}
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          {showArt
            ? rows
            : [line("head", art, rows[0] ?? null), ...rows.slice(1)]}
        </Box>
      </Box>
    );
    const roleLine = (
      key: string,
      role: Role,
      model: string | undefined,
      effort?: string,
    ) => (
      <Text key={key} wrap="truncate-end">
        <Text color={ROLE_COLOR[role]}>{T.roles[role] ?? role}</Text>
        <Text dimColor> · {modelName(model)}</Text>
        {effort ? <Text color="warning"> {effortDots(effort)}</Text> : null}
      </Text>
    );
    const isBusy = boss?.busy === true;
    const bossCard = card(
      "card-main",
      ROLE_COLOR.commander,
      portrait(
        "art-main",
        "commander",
        activityOf(boss?.lastAction),
        isBusy ? "working" : "waiting",
        MAIN,
        PORTRAIT_PX,
      ),
      [
        opener(MAIN, T.secMain, cardText),
        roleLine("sub", "commander", boss?.model, boss?.effort),
        isBusy
          ? doing("now", boss?.lastAction, boss?.lastDetail, cardText)
          : line(
              "now",
              icon("clock", "inactive", 12),
              <Text dimColor wrap="truncate-end">
                {boss ? T.waitingYou : T.waitingFirstPrompt}
              </Text>,
            ),
        <Text key="meta" dimColor wrap="truncate-end">
          {T.steps(boss?.steps ?? 0)} · {T.calls(boss?.actions ?? 0)}
        </Text>,
      ],
    );
    const heroCard = (hero: Hero) => {
      const role = roleOf(hero.type ?? "");

      return card(
        `card-${hero.id}`,
        hero.status === "running"
          ? ROLE_COLOR[role]
          : STATUS_VIEW[hero.status].color,
        portrait(
          `art-${hero.id}`,
          role,
          activityOf(hero.lastAction),
          moodOf(hero),
          hero.id,
          PORTRAIT_PX,
        ),
        [
          opener(hero.id, hero.title, cardText),
          roleLine("sub", role, hero.model, hero.effort),
          hero.status === "running"
            ? doing("now", hero.lastAction, hero.lastDetail, cardText)
            : outcome("now", hero),
          <Text key="meta" dimColor wrap="truncate-end">
            {age((hero.endedAt ?? now) - hero.startedAt)} ·{" "}
            {T.calls(hero.actions)}
            {hero.tokens ? ` · ${fmtTokens(hero.tokens)}` : ""}
          </Text>,
        ],
      );
    };
    // An empty seat beside the main agent says where subagents will appear.
    const emptySeat = (
      <Box
        key="seat"
        flexDirection="column"
        justifyContent="center"
        borderStyle="dashed"
        borderColor="inactive"
        borderDimColor
        paddingX={space.cardX}
        minWidth={0}
        width="100%"
      >
        {line(
          "empty",
          icon("bot", "inactive", 13),
          <Text dimColor wrap="truncate-end">
            {T.noSubagents}
          </Text>,
        )}
        <Text dimColor wrap="wrap">
          {T.squadHint}
        </Text>
      </Box>
    );
    const onStage = [...running, ...bowing];
    const modelMix = Object.entries(
      running.reduce<Record<string, number>>((acc, x) => {
        const k = shortModel(x.model).split(" ")[0] ?? "?";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ");
    const squadSection = section(
      "party",
      "users",
      T.secSquad,
      "warning",
      grid(
        "stage",
        [
          bossCard,
          ...onStage.map(heroCard),
          ...(onStage.length === 0 ? [emptySeat] : []),
        ],
        stageCols,
      ),
      "100%",
      running.length > 0 && !isNarrow ? (
        <Text dimColor>{modelMix}</Text>
      ) : undefined,
    );

    // ── Limits ───────────────────────────────────────────────────────────
    const ctxNote =
      m && m.contextTokens !== undefined && m.contextWindow > 0
        ? T.ctxFree(
            fmtTokens(Math.max(0, m.contextWindow - m.contextTokens)),
            fmtTokens(m.contextWindow),
          )
        : "";
    const fivePoints = samples.flatMap((s) =>
      s.five === undefined ? [] : [{ at: s.at, value: s.five }],
    );
    const rateNote = (kind: string, resetsAt?: string) => {
      const at = resetsAt ? Date.parse(resetsAt) : NaN;
      const reset = Number.isNaN(at)
        ? ""
        : T.resets(fmtReset(at, now, LOCALE[L]), age(at - now));
      if (kind !== "five_hour") return reset;
      const eta = etaToFull(fivePoints, now);
      if (eta === undefined || (!Number.isNaN(at) && eta >= at)) return reset;

      return `${reset}${reset ? " · " : ""}${T.runsOut(fmtClock(eta))}`;
    };
    // Limits and the finished list share a row on a wide pane, when both show.
    const isPaired = isWide && offStage.length > 0;
    const limitsRoom = isPaired ? half : inner;
    const labelCells = 12;
    const barCells = Math.max(4, Math.min(16, limitsRoom - labelCells - 12));
    // The note fits beside the bar on a wide row, under it otherwise.
    const noteBeside = limitsRoom - labelCells - barCells - 10 >= 28;
    const meter = (
      key: string,
      name: IconName,
      label: string,
      percentLeft: number,
      note: string,
    ) => {
      const color = meterColor(percentLeft);

      return (
        <Box key={key} flexDirection="column" minWidth={0}>
          <Box
            flexDirection="row"
            alignItems="center"
            columnGap={1}
            minWidth={0}
          >
            {icon(name, color, 13, "i")}
            {/* Fixed columns, not padding: the desktop draws text in a
                proportional face, so only boxes line the bars up. */}
            <Box key="l" width={labelCells} flexShrink={0}>
              <Text wrap="truncate-end">{label}</Text>
            </Box>
            <Box key="b" flexShrink={0}>
              {progress(percentLeft, color, barCells)}
            </Box>
            <Box key="p" width={5} flexShrink={0} justifyContent="flex-end">
              <Text bold>{`${Math.round(percentLeft)}%`}</Text>
            </Box>
            {noteBeside && note ? (
              <Box key="n" flexShrink={1} minWidth={0}>
                <Text dimColor wrap="truncate-end">
                  {note}
                </Text>
              </Box>
            ) : null}
          </Box>
          {!noteBeside && note ? (
            <Box paddingLeft={3}>
              <Text dimColor wrap="truncate-end">
                {note}
              </Text>
            </Box>
          ) : null}
        </Box>
      );
    };
    const guardColor =
      ctx === "critical" ? "error" : ctx === "warn" ? "warning" : "success";
    const guardText =
      ctx === "critical"
        ? T.guardCritical
        : ctx === "warn"
          ? T.guardWarn
          : T.guardOk;
    const compactButton = (
      <Button
        key="compact"
        label={T.btnCompact}
        variant={ctx === "ok" ? "secondary" : "primary"}
        onPress={async () => $.ui.toast(await compactNow($))}
      />
    );
    const guardLine = (
      <Box
        key="guard"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        columnGap={space.gapX}
        rowGap={0}
      >
        {line(
          "state",
          icon(ctx === "ok" ? "check" : "shield", guardColor, 13),
          <Text color={guardColor} wrap="truncate-end">
            {guardText}
          </Text>,
        )}
        {compactButton}
      </Box>
    );
    const limitsSection = section(
      "res",
      "gauge",
      T.secLimits,
      "suggestion",
      <Box flexDirection="column" rowGap={0}>
        {ctxUsed !== undefined
          ? meter("ctx", "layers", T.ctx, 100 - ctxUsed, ctxNote)
          : line(
              "ctx",
              icon("layers", "inactive", 13),
              <Text dimColor>{T.ctxNoData}</Text>,
            )}
        {(m?.rates ?? []).map((r) =>
          meter(
            r.kind,
            r.kind === "seven_day" ? "calendar" : "gauge",
            rateLabel(r.kind, T.rate),
            100 - r.percentUsed,
            rateNote(r.kind, r.resetsAt),
          ),
        )}
        {guardLine}
      </Box>,
      isPaired ? "col" : "100%",
      <Text dimColor>{T.remaining}</Text>,
    );

    // ── Finished and journal ─────────────────────────────────────────────
    const doneRow = (hero: Hero) => {
      const view = STATUS_VIEW[hero.status];
      const extra = isNarrow
        ? dur((hero.endedAt ?? now) - hero.startedAt)
        : `${dur((hero.endedAt ?? now) - hero.startedAt)} · ${T.callsShort(hero.actions)}`;

      return (
        <Box
          key={hero.id}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          columnGap={1}
          minWidth={0}
        >
          {line(
            "t",
            icon(view.icon, view.color, 12, "s"),
            opener(hero.id, hero.title, half - extra.length - 6),
          )}
          <Box flexShrink={0}>
            <Text dimColor>{extra}</Text>
          </Box>
        </Box>
      );
    };
    const doneList = (shown: Hero[], n: number) =>
      shown.length === 0 ? (
        <Text dimColor>{T.nothingYet}</Text>
      ) : (
        <Box flexDirection="column">
          {shown.slice(-n).reverse().map(doneRow)}
        </Box>
      );
    const doneAside = (
      <Text dimColor>
        {won} ✓{lost ? ` · ${lost} ✗` : ""}
      </Text>
    );
    const recentSection =
      offStage.length > 0
        ? section(
            "recent",
            "trophy",
            T.secDone,
            "success",
            doneList(offStage, isNarrow ? 3 : 5),
            isPaired ? "col" : "100%",
            doneAside,
          )
        : null;
    const doneSection = section(
      "done",
      "trophy",
      T.secDone,
      "success",
      doneList(finished, isNarrow ? 6 : 10),
      colW,
      doneAside,
    );
    const logSection = section(
      "log",
      "list",
      T.secLog,
      "inactive",
      lines.length === 0 ? (
        <Text dimColor>{T.noEvents}</Text>
      ) : (
        <Box flexDirection="column">
          {lines
            .slice(isNarrow ? -6 : -12)
            .reverse()
            .map((l, i) => (
              <Box
                key={`log-${i}`}
                flexDirection="row"
                alignItems="center"
                columnGap={1}
                minWidth={0}
              >
                <Text dimColor>{fmtClock(l.at)}</Text>
                {icon(l.icon, l.color ?? "inactive", 12)}
                <Text wrap="truncate-end">
                  {clip(logText(l), Math.max(12, half - 10))}
                </Text>
              </Box>
            ))}
        </Box>
      ),
      colW,
    );

    // ── An agent's page ──────────────────────────────────────────────────
    const focused =
      focusId === MAIN ? MAIN : list.find((x) => x.id === focusId);
    const agentPage = (who: Hero | typeof MAIN): RenderNode[] => {
      const isMain = who === MAIN;
      const hero = isMain ? undefined : who;
      const role: Role = hero ? roleOf(hero.type ?? "") : "commander";
      const color = ROLE_COLOR[role];
      const title = hero ? hero.title : T.secMain;
      const tool = hero ? hero.lastAction : boss?.lastAction;
      const isWorking = hero ? hero.status === "running" : isBusy;
      const mood: Mood = hero ? moodOf(hero) : isBusy ? "working" : "waiting";
      const trail = (hero ? hero.trail : boss?.trail) ?? [];
      const counts = (hero ? hero.toolCounts : boss?.toolCounts) ?? {};
      const artPx = isNarrow ? PORTRAIT_PX : DETAIL_PX;
      const artCells = isNarrow ? PORTRAIT_CELLS : DETAIL_CELLS;
      const textRoom = inner - (showArt ? artCells + 2 : 0) - 6;

      const status = hero
        ? hero.status === "running"
          ? line(
              "status",
              icon("activity", "warning", 12),
              <Text>
                <Text color="warning">{T.status.running}</Text>
                <Text dimColor> · {age(now - hero.startedAt)}</Text>
              </Text>,
            )
          : outcome("status", hero)
        : line(
            "status",
            icon(
              isBusy ? "activity" : "clock",
              isBusy ? "warning" : "inactive",
              12,
            ),
            <Text color={isBusy ? "warning" : undefined} dimColor={!isBusy}>
              {isBusy ? T.status.running : T.waitingYou}
            </Text>,
          );
      const figures = hero
        ? [
            hero.type,
            T.calls(hero.actions),
            ...(hero.tokens ? [fmtTokens(hero.tokens)] : []),
            T.since(fmtClock(hero.startedAt)),
          ]
        : [T.steps(boss?.steps ?? 0), T.calls(boss?.actions ?? 0)];
      const back = (
        <Box
          key="crumbs"
          flexDirection="row"
          alignItems="center"
          columnGap={space.gapX}
        >
          <Button
            key="back"
            label={`← ${T.back}`}
            onPress={() => update($, focus, () => null)}
          />
          <Text dimColor wrap="truncate-end">
            {T.secSquad} › {T.roles[role] ?? role}
          </Text>
        </Box>
      );
      const heroPanel = (
        <Box
          key="hero"
          flexDirection="row"
          alignItems="center"
          columnGap={space.gapX}
          borderStyle="round"
          borderColor={color}
          paddingX={space.outerX}
          minWidth={0}
        >
          {showArt ? (
            <Box
              flexShrink={0}
              width={artCells}
              alignItems="center"
              justifyContent="center"
            >
              {portrait(
                "art-page",
                role,
                activityOf(tool),
                mood,
                hero ? hero.id : MAIN,
                artPx,
              )}
            </Box>
          ) : null}
          <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
            {line(
              "title",
              showArt
                ? null
                : portrait("art-page", role, "think", mood, MAIN, 0),
              <Text bold wrap="truncate-end">
                {title}
              </Text>,
            )}
            <Text wrap="truncate-end">
              <Text color={color}>{T.roles[role] ?? role}</Text>
              <Text dimColor>
                {" "}
                · {modelName(hero ? hero.model : boss?.model)} ·{" "}
              </Text>
              <Text color="warning">
                {effortDots(hero ? hero.effort : boss?.effort)}
              </Text>
              <Text dimColor>
                {" "}
                {effortLabel(hero ? hero.effort : boss?.effort, T.effort)}
              </Text>
            </Text>
            {status}
            <Text dimColor wrap="truncate-end">
              {figures.join(" · ")}
            </Text>
            {isWorking
              ? doing(
                  "now",
                  tool,
                  hero ? hero.lastDetail : boss?.lastDetail,
                  textRoom,
                )
              : null}
          </Box>
        </Box>
      );
      const prose = (key: string, text: string) =>
        Markdown ? (
          <Markdown key={key} text={text} />
        ) : (
          <Text key={key} wrap="wrap">
            {text}
          </Text>
        );
      const steps = trail.slice(isNarrow ? -8 : -15).reverse();
      const trailSection = section(
        "trail",
        "activity",
        T.secTrail,
        color,
        steps.length === 0 ? (
          <Text dimColor>{T.noTrail}</Text>
        ) : (
          <Box flexDirection="column">
            {steps.map((s, i) => (
              <Box
                key={`step-${trail.length - i}`}
                flexDirection="row"
                alignItems="center"
                columnGap={1}
                minWidth={0}
              >
                <Text dimColor>{fmtClock(s.at)}</Text>
                {icon(toolIcon(s.tool), "subtle", 12)}
                <Text wrap="truncate-end">
                  <Text bold>{toolLabel(s.tool, mcpNames)}</Text>
                  {s.detail ? (
                    <Text dimColor>
                      {" "}
                      ·{" "}
                      {clip(
                        s.detail,
                        Math.max(12, (isWide ? half : inner) - 24),
                      )}
                    </Text>
                  ) : null}
                </Text>
              </Box>
            ))}
          </Box>
        ),
        isWide ? "col" : "100%",
        trail.length > 0 ? (
          <Text dimColor>{hero ? hero.actions : (boss?.actions ?? 0)}</Text>
        ) : undefined,
      );
      const toolsSection =
        Object.keys(counts).length > 0
          ? section(
              "tools",
              "wrench",
              T.secTools,
              color,
              <Text wrap="truncate-end">
                {topTools(counts, isNarrow ? 3 : 6, mcpNames)}
              </Text>,
            )
          : null;
      const taskSection = hero?.brief
        ? section("task", "file", T.secTask, color, prose("brief", hero.brief))
        : null;
      const reportSection = hero?.report
        ? section(
            "report",
            "check",
            T.secReport,
            "success",
            prose("report", hero.report),
          )
        : null;
      const words = [taskSection, toolsSection, reportSection].filter(
        (x): x is NonNullable<typeof x> => x !== null,
      );

      return [
        back,
        heroPanel,
        ...(isWide
          ? [
              row("page", [
                <Box
                  key="page-words"
                  flexDirection="column"
                  width={0}
                  minWidth={0}
                  flexGrow={1}
                  rowGap={space.gapY}
                >
                  {words}
                </Box>,
                trailSection,
              ]),
            ]
          : [...words, trailSection]),
      ];
    };

    // ── Arsenal: MCP servers, plugins, skills ─────────────────────────────
    /** Columns of equal cells that fit the pane, cells at least `min` wide. */
    const gridCols = (min: number) =>
      Math.max(1, Math.min(5, Math.floor((inner + 1) / (min + 1))));
    /** One grid cell: icon and label on the left, a count or note pinned right. */
    const cell = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      isLit: boolean,
      right: string | undefined,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        columnGap={1}
        width="100%"
        minWidth={0}
      >
        {line(
          "l",
          icon(name, isLit ? color : "inactive", 12),
          <Text
            bold={isLit}
            color={isLit ? color : undefined}
            dimColor={!isLit}
            wrap="truncate-end"
          >
            {label}
          </Text>,
        )}
        {right ? (
          <Box flexShrink={0}>
            <Text color={isLit ? color : undefined} dimColor={!isLit}>
              {right}
            </Text>
          </Box>
        ) : null}
      </Box>
    );
    const armCols = gridCols(22);
    const chip = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      count: number,
      note?: string,
    ) =>
      cell(key, name, color, label, count > 0, count > 0 ? `×${count}` : note);
    const group = (
      key: string,
      name: IconName,
      color: string,
      title: string,
      total: number,
      hotCount: number,
      chips: RenderNode[],
      more: number,
    ) =>
      section(
        key,
        name,
        title,
        color,
        total === 0 ? (
          <Text dimColor>{T.none}</Text>
        ) : (
          grid(`${key}-grid`, chips, armCols, 0)
        ),
        "100%",
        <Text dimColor>
          {total}
          {hotCount ? ` · ${T.inUse(hotCount)}` : ""}
          {more > 0 ? ` · ${T.more(more)}` : ""}
        </Text>,
      );
    const chipLimit = armCols * (isWide ? 4 : 3);
    const byUse = <T,>(items: T[], n: (x: T) => number) =>
      [...items].sort((a, b) => n(b) - n(a));
    const mcpList = byUse(arms?.mcp ?? [], (x) => used.mcp[x.name] ?? 0);
    const pluginCalls = (plugin: string) =>
      (arms?.skills ?? [])
        .filter((k) => k.plugin === plugin)
        .reduce((n, k) => n + (used.skills[k.name] ?? 0), 0);
    const pluginList = byUse(arms?.plugins ?? [], (x) => pluginCalls(x.name));
    const skillList = byUse(
      arms?.skills ?? [],
      (x) => used.skills[x.name] ?? 0,
    );
    const hotTotal =
      Object.keys(used.mcp).length + Object.keys(used.skills).length;
    const arsenalPage: RenderNode[] = !arms
      ? [
          <Text key="collecting" dimColor>
            {T.collecting}
          </Text>,
        ]
      : [
          line(
            "arsenal-head",
            icon("swords", "suggestion"),
            <Text wrap="truncate-end">
              <Text bold>{T.secArsenal}</Text>
              <Text dimColor>
                {" "}
                · {hotTotal ? T.inUse(hotTotal) : T.litHint}
              </Text>
            </Text>,
          ),
          group(
            "g-mcp",
            "plug",
            "suggestion",
            T.groupMcp,
            mcpList.length,
            mcpList.filter((x) => used.mcp[x.name]).length,
            mcpList
              .slice(0, chipLimit)
              .map((x) =>
                chip(
                  `m-${x.name}`,
                  "plug",
                  "suggestion",
                  serverName(x.name),
                  used.mcp[x.name] ?? 0,
                  x.tokens ? fmtTokens(x.tokens) : `${x.tools}`,
                ),
              ),
            mcpList.length - chipLimit,
          ),
          group(
            "g-plugins",
            "puzzle",
            "claude",
            T.groupPlugins,
            pluginList.length,
            pluginList.filter((x) => pluginCalls(x.name)).length,
            pluginList
              .slice(0, chipLimit)
              .map((x) =>
                chip(
                  `p-${x.name}`,
                  "puzzle",
                  "claude",
                  x.name,
                  pluginCalls(x.name),
                  `${x.commands}`,
                ),
              ),
            pluginList.length - chipLimit,
          ),
          group(
            "g-skills",
            "zap",
            "merged",
            isNarrow ? T.groupSkillsShort : T.groupSkills,
            skillList.length,
            skillList.filter((x) => used.skills[x.name]).length,
            skillList
              .slice(0, chipLimit)
              .map((x) =>
                chip(
                  `s-${x.name}`,
                  "zap",
                  "merged",
                  x.name,
                  used.skills[x.name] ?? 0,
                ),
              ),
            skillList.length - chipLimit,
          ),
        ];

    // ── Achievements and the profile ─────────────────────────────────────
    const achStats = statsOfRecord(lifeRec);
    const haveIds = have.map((x) => x.id);
    const next = nextAchievement(achStats, haveIds);
    const achCols = gridCols(22);
    const shortBar = Math.max(10, Math.min(24, inner - 30));
    const levelSection = section(
      "level",
      "trophy",
      T.level(lv.level),
      "warning",
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          {progress(lv.progress, "claude", shortBar)}
          <Text dimColor>{T.toNext(500 - (lv.xp % 500), lv.level + 1)}</Text>
        </Box>
        {line(
          "life",
          icon("calendar", "inactive", 12),
          <Text dimColor wrap="truncate-end">
            {T.lifetime(
              (life?.sessions ?? 0) + 1,
              lifeRec.agentsTotal,
              lifeRec.calls,
              lifeRec.usd.toFixed(2),
            )}
          </Text>,
        )}
      </Box>,
      "100%",
      <Text dimColor>
        {lv.xp} XP{sessionXp ? ` · ${T.sessionGain(sessionXp)}` : ""}
      </Text>,
    );
    const achSection = section(
      "ach",
      "medal",
      T.secAchievements,
      "warning",
      <Box flexDirection="column" rowGap={space.gapY}>
        <Box flexDirection="column">
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {progress(
              (have.length / ACHIEVEMENTS.length) * 100,
              "warning",
              shortBar,
            )}
            <Text bold>
              {have.length} / {ACHIEVEMENTS.length}
            </Text>
          </Box>
          {next
            ? (() => {
                const [cur, goal] = next.progress(achStats);
                return line(
                  "next",
                  icon("flame", "warning", 12),
                  <Text wrap="truncate-end">
                    <Text dimColor>{T.next}</Text>
                    <Text bold>{(T.ach[next.id] ?? next).title}</Text>
                    <Text dimColor>
                      {` — ${(T.ach[next.id] ?? next).hint} (${Math.min(cur, goal)}/${goal})`}
                    </Text>
                  </Text>,
                );
              })()
            : line(
                "all",
                icon("trophy", "warning", 12),
                <Text color="warning">{T.allUnlocked}</Text>,
              )}
        </Box>
        {grid(
          "ach-grid",
          ACHIEVEMENTS.map((a) => {
            const got = haveIds.includes(a.id);
            const [cur, goal] = a.progress(achStats);
            const at = have.find((x) => x.id === a.id)?.at ?? 0;
            const isFresh = got && now - at < FRESH_UNLOCK_MS;
            return cell(
              `a-${a.id}`,
              got ? "medal" : "lock",
              "warning",
              (T.ach[a.id] ?? a).title,
              got,
              got
                ? isFresh
                  ? T.fresh
                  : "✓"
                : `${Math.min(cur, goal)}/${goal}`,
            );
          }),
          achCols,
          0,
        )}
      </Box>,
      "100%",
      isNarrow ? undefined : <Text dimColor>{T.xpEach}</Text>,
    );

    // ── Language switcher: a native list where the surface draws one, a cycling button on the terminal.
    const setLang = async (id: Lang) => {
      await update($, langPick, () => id);
      await writeProfile($, (p) => ({ ...p, lang: id }));
    };
    const Select =
      e.surface !== "terminal" && "Select" in els ? els.Select : undefined;
    const current_ = LANGS.find((x) => x.id === L) ?? LANGS[0]!;
    const langSwitch = Select ? (
      <Select
        key="lang"
        label={T.language}
        value={L}
        options={LANGS.map((x) => ({ value: x.id, label: x.name }))}
        onSelect={(value: string) => {
          if (isLang(value)) void setLang(value);
        }}
      />
    ) : (
      <Button
        key="lang"
        label={`◍ ${current_.short}`}
        plain
        dimColor
        onPress={async () => {
          const i = LANGS.findIndex((x) => x.id === L);
          const nextLang = LANGS[(i + 1) % LANGS.length]!.id;
          await setLang(nextLang);
        }}
      />
    );
    const langRow = line("lang-row", icon("globe", "inactive", 13), [
      <Text key="l" dimColor>
        {T.language}
      </Text>,
      langSwitch,
    ]);

    // ── Context: what the window is made of ─────────────────────────────
    const ctxWidth = Math.max(8, Math.min(isNarrow ? 60 : 90, inner - 1));
    const usedRows = (parts?.rows ?? [])
      .filter((r) => r.kind === "used" && r.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens);
    const reserve = (parts?.rows ?? []).find((r) => r.kind === "buffer");
    const freeRow = (parts?.rows ?? []).find((r) => r.kind === "free");
    const deferred = (parts?.rows ?? []).filter(
      (r) => r.kind === "deferred" && r.tokens > 0,
    );
    const windowMax = parts?.max || m?.contextWindow || 0;
    const pctOf = (t: number) => (windowMax > 0 ? (t / windowMax) * 100 : 0);
    const colored = [
      ...usedRows.map((r, i) => ({
        row: r,
        color: PART_COLORS[i % PART_COLORS.length] ?? "claude",
      })),
      ...(reserve && reserve.tokens > 0
        ? [{ row: reserve, color: "inactive" }]
        : []),
    ];
    const stacked = Svg ? (
      <Svg
        key="stacked"
        source={stackedSvg(
          colored.map((c) => ({
            percent: pctOf(c.row.tokens),
            color: c.color,
          })),
        )}
        alt={T.compositionAlt}
        width={ctxWidth * CELL_PX}
        height={10}
      />
    ) : (
      (() => {
        const cells = splitCells(
          colored.map((c) => pctOf(c.row.tokens)),
          ctxWidth,
        );
        const used = cells.reduce((a, b) => a + b, 0);
        return (
          <Text key="stacked">
            {colored.map((c, i) => (
              <Text key={`seg-${i}`} color={c.color}>
                {"█".repeat(cells[i] ?? 0)}
              </Text>
            ))}
            <Text dimColor>{"░".repeat(Math.max(0, ctxWidth - used))}</Text>
          </Text>
        );
      })()
    );
    const legendRow = (
      key: string,
      color: string,
      name: string,
      tokens: number,
      dim = false,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        justifyContent="space-between"
        columnGap={1}
        minWidth={0}
      >
        {line(
          "n",
          <Text color={color}>●</Text>,
          <Text dimColor={dim} wrap="truncate-end">
            {name}
          </Text>,
        )}
        <Box flexShrink={0}>
          <Text dimColor={dim}>
            <Text bold={!dim}>{fmtTokens(tokens)}</Text>
            {isNarrow ? null : (
              <Text dimColor> · {pctOf(tokens).toFixed(1)}%</Text>
            )}
          </Text>
        </Box>
      </Box>
    );
    const usedTotal = usedRows.reduce((a, r) => a + r.tokens, 0);
    const compositionSection = section(
      "composition",
      "layers",
      isNarrow ? T.secCompositionShort : T.secComposition,
      "merged",
      !parts ? (
        <Text dimColor>{T.collectingBreakdown}</Text>
      ) : (
        <Box flexDirection="column" rowGap={space.gapY}>
          <Text>
            <Text bold>
              {T.usedOf(
                fmtTokens(usedTotal),
                fmtTokens(windowMax),
                pctOf(usedTotal).toFixed(0),
              )}
            </Text>
            {freeRow ? (
              <Text dimColor>{T.freeOf(fmtTokens(freeRow.tokens))}</Text>
            ) : null}
          </Text>
          {stacked}
          <Box flexDirection="column">
            {colored.map((c, i) =>
              legendRow(`lg-${i}`, c.color, c.row.name, c.row.tokens),
            )}
            {deferred.map((r, i) =>
              legendRow(
                `df-${i}`,
                "inactive",
                T.onDemand(r.name),
                r.tokens,
                true,
              ),
            )}
          </Box>
        </Box>
      ),
      "100%",
      parts && !isNarrow ? (
        <Text dimColor>{T.updated(fmtClock(parts.at))}</Text>
      ) : undefined,
    );
    const topList = (
      key: string,
      items: { name: string; tokens: number }[],
      empty: string,
    ) =>
      items.length === 0 ? (
        <Text dimColor>{empty}</Text>
      ) : (
        <Box key={key} flexDirection="column">
          {items.slice(0, 6).map((x, i) => (
            <Box
              key={`${key}-${i}`}
              flexDirection="row"
              justifyContent="space-between"
              columnGap={1}
              minWidth={0}
            >
              <Text wrap="truncate-start">{x.name}</Text>
              <Box flexShrink={0}>
                <Text dimColor>{fmtTokens(x.tokens)}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      );
    const mcpWeight = [...(parts?.mcp ?? [])]
      .sort((a, b) => b.tokens - a.tokens)
      .map((x) => ({ name: x.label, tokens: x.tokens }));
    const memoryWeight = [...(parts?.memory ?? [])]
      .sort((a, b) => b.tokens - a.tokens)
      .map((x) => ({
        name: shortPath(x.path, Math.max(16, half - 8)),
        tokens: x.tokens,
      }));
    const mcpWeightSection = section(
      "mcp-weight",
      "plug",
      T.secMcpWeight,
      "suggestion",
      topList("mw", mcpWeight, T.noMcp),
      colW,
      mcpWeight.length ? (
        <Text dimColor>
          {fmtTokens(mcpWeight.reduce((a, x) => a + x.tokens, 0))}
        </Text>
      ) : undefined,
    );
    const memorySection = section(
      "memory",
      "file",
      T.secMemory,
      "claude",
      topList("mf", memoryWeight, T.noMemory),
      colW,
      memoryWeight.length ? (
        <Text dimColor>
          {fmtTokens(memoryWeight.reduce((a, x) => a + x.tokens, 0))}
        </Text>
      ) : undefined,
    );
    const snapText = snap
      ? `${fmtClock(snap.at)} · ${snap.path.replace(/^.*\/\.claude\//, "~/.claude/")}`
      : T.snapNone;
    const guardSection = section(
      "guard",
      "shield",
      T.secGuard,
      guardColor,
      <Box flexDirection="column">
        {guardLine}
        {line(
          "snap",
          icon("save", "inactive", 13),
          <Text dimColor wrap="truncate-start">
            {T.snapshot(snapText)}
          </Text>,
        )}
        {snap ? (
          <Box flexDirection="row">
            <Button
              key="copy"
              label={isNarrow ? T.btnCopyShort : T.btnCopy}
              variant="secondary"
              onPress={async () => {
                const r = await $.ui.copy({
                  text: T.resume(snap.path),
                  surface: e.surface,
                });
                $.ui.toast(r.isCopied ? T.copied : T.copyFailed);
              }}
            />
          </Box>
        ) : null}
      </Box>,
    );

    // ── Celebration banner ───────────────────────────────────────────────
    const isParty = party !== null && now - party.at < CELEBRATE_MS;
    const partyIds = party?.ids ?? [];
    const firstAch = T.ach[partyIds[0] ?? ""];
    const partyTitle =
      party?.kind === "level"
        ? T.level(party.level ?? lv.level)
        : firstAch
          ? partyIds.length > 1
            ? T.andMore(firstAch.title, partyIds.length - 1)
            : firstAch.title
          : "";
    const partyNote =
      party?.kind === "level" ? T.newLevelNote : (firstAch?.hint ?? "");
    const partyColor = party?.kind === "level" ? "claude" : "warning";
    const banner =
      isParty && party ? (
        <Box
          key="banner"
          flexDirection="row"
          alignItems="center"
          columnGap={space.gapX}
          borderStyle="round"
          borderColor={partyColor}
          paddingX={space.cardX}
        >
          {Svg ? (
            <Svg
              key="burst"
              source={burstSvg(partyColor)}
              alt={T.celebrationAlt}
              width={32}
              height={29}
              isInteractive={anim ? true : undefined}
            />
          ) : (
            <Text bold color={partyColor}>
              ✦
            </Text>
          )}
          <Box flexDirection="column" flexShrink={1} minWidth={0}>
            <Text dimColor>
              {party.kind === "level" ? T.bannerLevel : T.bannerAch}
            </Text>
            <Text bold color={partyColor} wrap="truncate-end">
              {partyTitle}
            </Text>
            {isNarrow ? null : (
              <Text dimColor wrap="truncate-end">
                {partyNote}
              </Text>
            )}
          </Box>
        </Box>
      ) : null;

    // ── Tabs ─────────────────────────────────────────────────────────────
    const tabBar = (
      <Box
        key="tabs"
        flexDirection="row"
        flexWrap="wrap"
        columnGap={1}
        rowGap={0}
      >
        {shownTabs.map((t, i) => (
          <Button
            key={`tab-${t.id}`}
            label={
              isNarrow
                ? t.id === current && !focused
                  ? `● ${t.label}`
                  : t.label
                : t.id === "achievements"
                  ? `${t.label} ${have.length}/${ACHIEVEMENTS.length}`
                  : t.id === "overview" && running.length > 0
                    ? `${t.label} · ${running.length}`
                    : t.label
            }
            hotkey={isNarrow ? undefined : String(i + 1)}
            plain={isNarrow ? true : undefined}
            variant={t.id === current && !focused ? "primary" : "secondary"}
            dimColor={t.id !== current || Boolean(focused)}
            onPress={async () => {
              await update($, focus, () => null);
              await update($, tab, () => t.id);
              await writeProfile($, (p) => ({ ...p, tab: t.id }));
            }}
          />
        ))}
      </Box>
    );

    const page: RenderChildren = focused
      ? agentPage(focused)
      : current === "context"
        ? [
            compositionSection,
            row("ctx-lists", [mcpWeightSection, memorySection]),
            guardSection,
          ]
        : current === "arsenal"
          ? arsenalPage
          : current === "achievements"
            ? [levelSection, achSection, langRow]
            : current === "log"
              ? [row("bottom", [doneSection, logSection])]
              : [
                  stats,
                  squadSection,
                  isPaired && recentSection
                    ? row("lower", [limitsSection, recentSection])
                    : [limitsSection, recentSection],
                ];

    return (
      <Box
        flexDirection="column"
        paddingX={space.outerX}
        paddingY={space.outerY}
        rowGap={space.gapY}
      >
        {header}
        {banner}
        {tabBar}
        {page}
      </Box>
    );
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const list: Hero[] = await read($, heroes);
    const running = list.filter((x) => x.status === "running");
    const m: Meters | null = await read($, meters);
    const ctx = contextLevel(
      m?.contextPercent,
      settings.ctxWarn,
      settings.ctxCritical,
    );
    if ((running.length === 0 && ctx === "ok") || e.props.hasSurvey)
      return next(e);
    const T = dict(langOf(await read($, langPick)));
    const els = $.ui.resolve(e);
    const { Box, Text } = els;
    // The terminal table carries Svg too, and draws nothing for it: glyphs there.
    const Svg = e.surface !== "terminal" && "Svg" in els ? els.Svg : undefined;
    const icon = (name: IconName, color: string, key: string) =>
      Svg ? (
        <Svg
          key={key}
          source={iconSvg(name, color)}
          alt={name}
          width={13}
          height={13}
        />
      ) : (
        <Text key={key} color={color}>
          {GLYPHS[name]}
        </Text>
      );
    const five = m?.rates.find((r) => r.kind === "five_hour");
    const ctxColor =
      ctx === "critical" ? "error" : ctx === "warn" ? "warning" : "subtle";

    return (
      <Box flexDirection="row" alignItems="center" columnGap={1} paddingX={1}>
        {running.length > 0 ? icon("users", "claude", "a") : null}
        {running.length > 0 ? (
          <Text color="claude">{T.agentsWorking(running.length)}</Text>
        ) : null}
        {running.map((x) => {
          const b = modelBadge(x.model);
          return icon(b.icon, b.color, `m-${x.id}`);
        })}
        {m?.contextPercent !== undefined ? icon("layers", ctxColor, "c") : null}
        {m?.contextPercent !== undefined ? (
          <Text color={ctxColor}>
            {T.bandContext(100 - m.contextPercent)}
            {ctx === "ok" ? "" : " · /handoff"}
          </Text>
        ) : null}
        {five ? icon("gauge", "subtle", "f") : null}
        {five ? (
          <Text dimColor>{T.bandFive(Math.round(100 - five.percentUsed))}</Text>
        ) : null}
        {m?.usd !== undefined ? icon("coins", "subtle", "u") : null}
        {m?.usd !== undefined ? (
          <Text dimColor>${m.usd.toFixed(2)}</Text>
        ) : null}
        <Text dimColor>· /vanguard</Text>
      </Box>
    );
  });
};
