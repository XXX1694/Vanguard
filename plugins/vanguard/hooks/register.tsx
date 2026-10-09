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
  Retired,
  Tab,
  Unlock,
  Usage,
} from "../types";
import {
  barSvg,
  burstSvg,
  equalizerSvg,
  GLYPHS,
  iconSvg,
  loaderSvg,
  LOGO_IDLE_SVG,
  LOGO_LIVE_SVG,
  LOGO_SVG,
  popCheckSvg,
  pulseSvg,
  shineBarSvg,
  stackedSvg,
  sparkSvg,
  toolIcon,
  type IconName,
} from "./icons";
import {
  ACHIEVEMENTS,
  addRetired,
  EMPTY_RETIRED,
  mergeSpawned,
  reconcileHeroes,
  streakWith,
  trimHeroes,
  type ListedAgent,
  type VanguardStats,
  bar,
  burnPerHour,
  clip,
  contextLevel,
  effortDots,
  effortLabel,
  etaToFull,
  fmtClock,
  fmtDuration,
  fmtReset,
  fmtTokens,
  emptyRecord,
  guardStep,
  guardThresholds,
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
  meterColor,
  modelBadge,
  pad,
  percentLeft,
  PRESERVE_INSTRUCTIONS,
  pulseBar,
  pushSample,
  rateLabel,
  shortModel,
  sparkline,
  spinnerFrame,
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

/** How long a banner stays, and a finished agent's check keeps popping. */
const CELEBRATE_MS = 8000;
const FRESH_DONE_MS = 6000;
/** At most this many animated drawings at once on a remote surface: each is a frame of its own. */
const FRAME_BUDGET = 8;

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
/** Whether the guard may raise its "context is critical" toast again. */
let guardArmed = true;
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

const STATUS_VIEW: Record<HeroStatus, { icon: IconName; color: string }> = {
  running: { icon: "activity", color: "warning" },
  done: { icon: "check", color: "success" },
  failed: { icon: "x", color: "error" },
  stopped: { icon: "stop", color: "inactive" },
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

/** Brings the squad in line with the engine's agent list, in one write. */
async function syncAgents($: Engine): Promise<void> {
  let listed: ListedAgent[] = [];
  try {
    listed = await $.agent.list();
  } catch {
    return;
  }
  const now = await $.clock.now();
  await update($, heroes, (list: Hero[]) => reconcileHeroes(list, listed, now));
}

/** Keeps the squad bounded: old finished agents become counters in `usage.retired`. */
async function trimSquad($: Engine): Promise<void> {
  let gone: Retired | undefined;
  await update($, heroes, (list: Hero[]) => {
    const r = trimHeroes(list, EMPTY_RETIRED);
    if (r.list.length === list.length) return list;
    gone = r.retired;
    return r.list;
  });
  const delta = gone;
  if (delta)
    await bumpUsage($, (u) => ({
      ...u,
      retired: addRetired(u.retired ?? EMPTY_RETIRED, delta),
    }));
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
  const retired = u.retired ?? EMPTY_RETIRED;
  const count = (...names: string[]) =>
    names.reduce((n, k) => n + (u.tools[k] ?? 0), 0);

  return {
    ...emptyRecord(sessionId, at),
    agentsTotal: list.length + retired.total,
    agentsDone:
      finished.filter((x) => x.status === "done").length + retired.done,
    peakParallel: u.peak,
    streak: streakWith(
      finished.map((x) => x.status),
      retired,
    ),
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
  const stamp = new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, "-");

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
  $.clock.every(1000, () => {
    ticks += 1;
    void quietly(async () => {
      if (ticks % 3 === 0) await syncAgents($);
      if (ticks % 30 === 0) await trimSquad($);
      if (ticks % 30 === 0) await refreshBreakdown($);
      if (ticks % 60 === 0) await refreshArsenal($);
      if (ticks % 15 === 0) await saveSession($);
      const list: Hero[] = await read($, heroes);
      const party: Celebration | null = await read($, celebration);
      const now = await $.clock.now();
      const isLively =
        list.some(
          (x) =>
            x.status === "running" || (x.endedAt ?? 0) > now - FRESH_DONE_MS,
        ) ||
        (party !== null && now - party.at < CELEBRATE_MS);
      if (isLively || ticks % 30 === 0) $.ui.invalidate("ui.render");
    });
  });
  if (settings.autoOpen)
    void $.ui.open({ id: PANE, title: TITLE }).catch(() => {});
}

export const register: Register = (on, options) => {
  settings = { ...DEFAULTS, ...(options as Partial<Settings>) };
  const limits = guardThresholds(settings.ctxWarn, settings.ctxCritical);
  settings.ctxWarn = limits.warn;
  settings.ctxCritical = limits.critical;
  guardArmed = true;

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
    await $.ui.open({ id: PANE, title: TITLE }).catch(() => {});

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
          type: e.subagentType,
          model: started.model,
          status: "running",
          startedAt: now,
          actions: 0,
        };
        await update($, heroes, (list: Hero[]) => {
          const old = list.find((x) => x.id === hero.id);
          return [
            ...list.filter((x) => x.id !== hero.id),
            mergeSpawned(old, hero),
          ];
        });
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
  }).catch(($, e, next) => next(e));

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
          c ? { ...c, model: e.model, effort, steps: c.steps + 1 } : c,
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
              }
            : c,
        );
      }
    });

    return next(e);
  }).catch(($, e, next) => next(e));

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
      const percent = e.context?.percent;
      if (percent !== undefined) {
        const step = guardStep(
          guardArmed,
          contextLevel(percent, settings.ctxWarn, settings.ctxCritical),
        );
        guardArmed = step.armed;
        if (step.alert) $.ui.toast((await textsFor($)).guardToast(percent));
      }
    });

    return next(e);
  });

  // Context guard: every compaction of the main loop keeps the plan, and leaves a snapshot on disk.
  on("session.compact", async ($, e, next) => {
    if (e.agentId || e.trigger === "precompute") return next(e);
    const instructions = [e.instructions, PRESERVE_INSTRUCTIONS]
      .filter(Boolean)
      .join("\n\n");
    const before: Meters | null = await read($, meters).catch(() => null);
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
        contextPercent: before?.contextPercent,
        trigger: e.trigger,
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
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e);
    const { Box, Text, Button } = els;
    // The terminal table carries Svg too, and draws nothing for it: glyphs there.
    const Svg = e.surface !== "terminal" && "Svg" in els ? els.Svg : undefined;
    const width = Math.max(24, e.props.bodyColumns ?? 80);
    // Breakpoints: compact keeps one column and rows instead of cards; medium
    // pairs sections; wide lays the overview out in three columns.
    const layout: "compact" | "medium" | "wide" =
      width < 76 ? "compact" : width < 132 ? "medium" : "wide";
    const isCompact = layout === "compact";
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

    const running = list.filter((x) => x.status === "running");
    const finished = list.filter((x) => x.status !== "running");
    // The squad: who runs, and who just finished, shown with the outcome for a moment.
    const squad = list.filter(
      (x) =>
        x.status === "running" || now - (x.endedAt ?? 0) < FRESH_DONE_MS,
    );
    const retired = used.retired ?? EMPTY_RETIRED;
    const won =
      list.filter((x) => x.status === "done").length + retired.done;
    const lost =
      list.filter((x) => x.status === "failed").length + retired.failed;
    const agentsTotal = list.length + retired.total;
    const finishedTotal = finished.length + retired.total;
    const agentCalls =
      list.reduce((s, x) => s + x.actions, 0) + retired.actions;
    const actions = agentCalls + (boss?.actions ?? 0);
    const agentTokens =
      list.reduce((s, x) => s + (x.tokens ?? 0), 0) + retired.tokens;
    const life: Lifetime | null = await read($, lifetime);
    const folded: Record<string, boolean> = (await read($, collapsed)) ?? {};
    const sessionRec = recordOf(list, used, m?.usd, now);
    const lifeRec = mergeRecords(life?.others ?? emptyRecord(), sessionRec);
    const sessionXp = xpOf(sessionRec);
    const lv = levelOf(xpOf(lifeRec) + have.length * 150);
    const anim = settings.animations;
    const L: Lang = langOf(await read($, langPick));
    const T = dict(L);
    const dur = (ms: number) => fmtDuration(ms, T.units);
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
              label: isCompact ? T.tabAchievementsShort : T.tabAchievements,
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
    const burn = burnPerHour(m?.usd, sessionMs);
    const perMinute =
      sessionMs >= 60_000 ? actions / (sessionMs / 60_000) : undefined;

    // One spacing scale for the whole pane, in cells: inset inside a frame,
    // gap between neighbours, stack between rows of blocks.
    const space = {
      padX: isCompact ? 1 : 2,
      padY: isCompact ? 0 : 1,
      gap: isCompact ? 1 : 2,
      stack: 1,
      inner: isCompact ? 0 : 1,
      outerX: 1,
    };
    const gutter = space.gap;
    const inner = width - space.outerX * 2;
    const colCount = layout === "wide" ? 3 : layout === "medium" ? 2 : 1;
    const colWidth = Math.floor((inner - gutter * (colCount - 1)) / colCount);
    const pairWidth = isCompact ? inner : Math.floor((inner - gutter) / 2);
    const frame = 2 + space.padX * 2;
    const barWidth = Math.max(8, Math.min(22, colWidth - frame - 24));
    const cardsRoom = inner - frame;
    const cardsPerRow = Math.max(
      1,
      Math.floor((cardsRoom + gutter) / (38 + gutter)),
    );
    const cardWidth = Math.max(
      34,
      Math.min(
        48,
        Math.floor((cardsRoom - gutter * (cardsPerRow - 1)) / cardsPerRow),
      ),
    );

    /** An icon: a Lucide SVG where the surface draws one, a glyph on the terminal. */
    const icon = (
      name: string,
      color: string,
      size = 14,
      key?: string,
      alt?: string,
    ): RenderNode => {
      const known = name in GLYPHS;
      if (Svg && known)
        return (
          <Svg
            key={key}
            source={iconSvg(name as IconName, color)}
            alt={alt ?? name}
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

    /** A progress bar: a solid rounded SVG where drawn, block characters on the terminal. */
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
          width={cells * 9}
          height={8}
        />
      ) : (
        <Text key={key} color={color}>
          {bar(percent, cells)}
        </Text>
      );

    let framesLeft = FRAME_BUDGET;
    const takeFrame = () => framesLeft-- > 0;

    /** A moving mark: an SMIL SVG on remote surfaces, a spinner glyph on the terminal. */
    const live = (
      kind: "loader" | "pulse" | "eq",
      color: string,
      size = 14,
      key?: string,
    ): RenderNode =>
      !anim || (Svg && !takeFrame()) ? (
        icon(
          kind === "loader"
            ? "activity"
            : kind === "pulse"
              ? "zap"
              : "activity",
          color,
          size,
          key,
        )
      ) : Svg ? (
        <Svg
          key={key}
          source={
            kind === "loader"
              ? loaderSvg(color)
              : kind === "pulse"
                ? pulseSvg(color)
                : equalizerSvg(color)
          }
          alt={kind === "loader" ? T.working : T.active}
          width={size}
          height={size}
          isInteractive
        />
      ) : (
        <Text key={key} color={color}>
          {kind === "pulse"
            ? Math.floor(now / 1000) % 2
              ? "●"
              : "○"
            : spinnerFrame(now)}
        </Text>
      );

    /** An icon followed by text, on one line. */
    const line = (key: string, lead: RenderNode, body: RenderChildren) => (
      <Box key={key} flexDirection="row" alignItems="center" columnGap={1}>
        {lead}
        {body}
      </Box>
    );

    const section = (
      key: string,
      name: IconName,
      title: string,
      color: string,
      body: RenderChildren,
      w: "col" | "100%" = "100%",
      aside?: RenderChildren,
    ) => {
      const isFolded = folded[key] === true;

      return (
        <Box
          key={key}
          flexDirection="column"
          borderStyle="round"
          borderColor="inactive"
          hover={{ borderColor: color }}
          paddingX={space.padX}
          paddingY={isFolded ? 0 : space.padY}
          rowGap={space.inner}
          width={w === "col" ? 0 : "100%"}
          minWidth={0}
          flexGrow={1}
          flexShrink={1}
          alignSelf={isFolded ? "flex-start" : "auto"}
        >
          <Box justifyContent="space-between" alignItems="center" columnGap={2}>
            {line(
              `${key}-title`,
              icon(name, color),
              <Text bold color={color}>
                {title}
              </Text>,
            )}
            <Box flexDirection="row" alignItems="center" columnGap={2}>
              {aside ?? null}
              <Button
                key={`fold-${key}`}
                label={isFolded ? "▸" : "▾"}
                plain
                dimColor
                onPress={async () => {
                  const next = { ...folded, [key]: !isFolded };
                  await update($, collapsed, () => next);
                  await writeProfile($, (p) => ({ ...p, collapsed: next }));
                }}
              />
            </Box>
          </Box>
          {isFolded ? null : <Box flexDirection="column">{body}</Box>}
        </Box>
      );
    };

    const meter = (
      key: string,
      name: IconName,
      label: string,
      percentLeft: number,
      note: string,
      series?: number[],
    ) => (
      <Box key={key} flexDirection="column">
        {isCompact ? (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              {line(
                "l",
                icon(name, meterColor(percentLeft)),
                <Text>{label}</Text>,
              )}
              <Text bold>{Math.round(percentLeft)}%</Text>
            </Box>
            {progress(
              percentLeft,
              meterColor(percentLeft),
              Math.max(8, inner - frame - 1),
            )}
          </Box>
        ) : (
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {icon(name, meterColor(percentLeft))}
            <Text>{pad(label, 9)}</Text>
            {progress(percentLeft, meterColor(percentLeft), barWidth)}
            <Text bold>{pad(`${Math.round(percentLeft)}%`, 4)}</Text>
          </Box>
        )}
        {note ? (
          <Box paddingLeft={isCompact ? 2 : 3}>
            <Text dimColor wrap="truncate-end">
              {note}
            </Text>
          </Box>
        ) : null}
        {series && series.length > 2 ? (
          <Box
            flexDirection="row"
            alignItems="center"
            columnGap={1}
            paddingTop={1}
          >
            {icon("activity", "inactive", 14)}
            <Text dimColor>{pad(T.history, 9)}</Text>
            {Svg ? (
              <Svg
                source={sparkSvg(series.slice(-60), meterColor(percentLeft))}
                alt={T.historyAlt}
                width={barWidth * 9}
                height={16}
              />
            ) : (
              <Text color="subtle">{sparkline(series, barWidth)}</Text>
            )}
          </Box>
        ) : null}
      </Box>
    );

    const action = (
      key: string,
      tool?: string,
      detail?: string,
      w = colWidth,
    ) =>
      tool
        ? line(
            key,
            icon(toolIcon(tool), "claude"),
            <Text wrap="truncate-end">
              <Text bold>{toolLabel(tool, mcpNames)}</Text>
              {detail ? (
                <Text dimColor>
                  {" "}
                  · {clip(detail, Math.max(12, w - frame - 16))}
                </Text>
              ) : null}
            </Text>,
          )
        : line(
            key,
            live("pulse", "inactive", 12),
            <Text dimColor>{T.thinking}</Text>,
          );

    // ── KPI tiles ────────────────────────────────────────────────────────
    const tile = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      value: string,
      sub?: string,
    ) => (
      <Box
        key={key}
        flexDirection="column"
        borderStyle="round"
        borderColor="inactive"
        hover={{ borderColor: color }}
        paddingX={space.padX}
        paddingY={isCompact ? 0 : 1}
        flexGrow={1}
        width="100%"
      >
        {line("l", icon(name, color, 13), <Text dimColor>{label}</Text>)}
        <Text bold color={color}>
          {value}
        </Text>
        <Text dimColor wrap="truncate-end">
          {sub ?? " "}
        </Text>
      </Box>
    );
    const tileList: RenderNode[] = [
      tile(
        "t-time",
        "clock",
        "claude",
        T.tileSession,
        dur(sessionMs),
        T.since(fmtClock(sessionStart)),
      ),
      tile(
        "t-agents",
        "users",
        "warning",
        T.tileAgents,
        `${running.length} / ${agentsTotal}`,
        T.doneFailed(won, lost),
      ),
      tile(
        "t-calls",
        "wrench",
        "suggestion",
        T.tileCalls,
        String(actions),
        perMinute !== undefined ? T.perMinute(perMinute.toFixed(1)) : "—",
      ),
      tile(
        "t-tokens",
        "layers",
        "merged",
        T.tileTokens,
        agentTokens ? fmtTokens(agentTokens) : "—",
        agentTokens && finishedTotal
          ? T.average(fmtTokens(Math.round(agentTokens / finishedTotal)))
          : " ",
      ),
      tile(
        "t-usd",
        "coins",
        "success",
        T.tileSpend,
        m?.usd !== undefined ? `$${m.usd.toFixed(2)}` : "—",
        burn !== undefined ? T.perHour(burn.toFixed(2)) : " ",
      ),
    ];
    // One line of five equal tiles; pairs only in the compact layout.
    const perRow = isCompact ? 2 : 5;
    const tileRows: RenderNode[][] = [];
    for (let i = 0; i < tileList.length; i += perRow)
      tileRows.push(tileList.slice(i, i + perRow));
    const figure = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      value: string,
      sub: string,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        justifyContent="space-between"
        columnGap={1}
      >
        {line("l", icon(name, color, 12), <Text dimColor>{label}</Text>)}
        <Text wrap="truncate-start">
          <Text bold color={color}>
            {value}
          </Text>
          {sub.trim() && sub !== "—" ? <Text dimColor> {sub}</Text> : null}
        </Text>
      </Box>
    );
    const compactTiles = (
      <Box
        key="tiles"
        flexDirection="column"
        borderStyle="round"
        borderColor="inactive"
        paddingX={space.padX}
      >
        {figure("f-time", "clock", "claude", T.tileSession, dur(sessionMs), "")}
        {figure(
          "f-agents",
          "users",
          "warning",
          T.figAgents,
          `${running.length}/${agentsTotal}`,
          lost ? `${lost} ✗` : "",
        )}
        {figure(
          "f-calls",
          "wrench",
          "suggestion",
          T.tileCalls,
          String(actions),
          perMinute !== undefined ? T.perMinuteShort(perMinute.toFixed(1)) : "",
        )}
        {agentTokens
          ? figure(
              "f-tokens",
              "layers",
              "merged",
              T.figTokens,
              fmtTokens(agentTokens),
              "",
            )
          : null}
        {figure(
          "f-usd",
          "coins",
          "success",
          T.tileSpend,
          m?.usd !== undefined ? `$${m.usd.toFixed(2)}` : "—",
          burn !== undefined ? T.perHourShort(burn.toFixed(1)) : "",
        )}
      </Box>
    );
    const tiles = isCompact ? (
      compactTiles
    ) : (
      <Box key="tiles" flexDirection="column" rowGap={space.stack}>
        {tileRows.map((r, i) => (
          <Box
            key={`tr-${i}`}
            flexDirection="row"
            columnGap={isCompact ? space.gap : 1}
          >
            {Array.from({ length: perRow }, (_, j) => (
              <Box
                key={`tc-${j}`}
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

    // ── Header ───────────────────────────────────────────────────────────
    const header = (
      <Box
        key="header"
        justifyContent="space-between"
        alignItems="center"
        columnGap={space.gap}
      >
        <Box flexDirection="row" alignItems="center" columnGap={space.gap}>
          {Svg ? (
            <Svg
              source={
                !anim
                  ? LOGO_SVG
                  : running.length > 0
                    ? LOGO_LIVE_SVG
                    : LOGO_IDLE_SVG
              }
              alt="Vanguard"
              width={isCompact ? 28 : 36}
              height={isCompact ? 28 : 36}
              isInteractive={anim && takeFrame() ? true : undefined}
            />
          ) : (
            <Text bold color="claude">
              ⚔
            </Text>
          )}
          <Box flexDirection="column">
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Text bold color="claude">
                {Svg ? "Vanguard" : "VANGUARD"}
              </Text>
              {running.length > 0 ? live("eq", "claude", 14, "eq") : null}
            </Box>
            <Text dimColor wrap="truncate-end">
              {`${T.sessionNo((life?.sessions ?? 0) + 1)} · `}
              {boss && boss.model !== "?"
                ? shortModel(boss.model)
                : T.modelPending}
              {isCompact
                ? ""
                : ` · ${
                    running.length > 0
                      ? T.agentsWorking(running.length)
                      : T.noAgentsRunning
                  }`}
            </Text>
          </Box>
        </Box>
        {isCompact ? (
          <Box flexShrink={0}>
            <Text bold color="warning">
              {T.levelShort(lv.level)}
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column" alignItems="flex-end">
            {line(
              "lv",
              icon("trophy", "warning"),
              <Text bold color="warning">
                {T.level(lv.level)}
              </Text>,
            )}
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              {Svg && anim && takeFrame() ? (
                <Svg
                  source={shineBarSvg(lv.progress, "claude")}
                  alt={`${Math.round(lv.progress)}%`}
                  width={14 * 9}
                  height={8}
                  isInteractive
                />
              ) : (
                progress(lv.progress, "claude", 14)
              )}
              <Text dimColor>
                {lv.xp} XP{sessionXp ? ` · ${T.sessionGain(sessionXp)}` : ""}
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    );

    // ── Main agent ───────────────────────────────────────────────────────
    const bossBadge = modelBadge(boss?.model ?? "");
    const bossBody = boss ? (
      <Box flexDirection="column" rowGap={space.inner}>
        <Box justifyContent="space-between" columnGap={space.gap}>
          {line(
            "model",
            icon(bossBadge.icon, bossBadge.color, 16),
            <Text bold color={bossBadge.color}>
              {boss.model === "?" ? T.waitingFirstStep : shortModel(boss.model)}
            </Text>,
          )}
          <Text>
            <Text color="warning">{effortDots(boss.effort)}</Text>
            <Text dimColor> {effortLabel(boss.effort, T.effort)}</Text>
          </Text>
        </Box>
        <Box
          flexDirection="row"
          alignItems="center"
          columnGap={1}
          flexWrap="wrap"
        >
          {icon("activity", "inactive", 12, "s")}
          <Text dimColor>{T.steps(boss.steps)}</Text>
          <Text dimColor>·</Text>
          {icon("wrench", "inactive", 12, "w")}
          <Text dimColor>{T.calls(boss.actions)}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>{T.now}</Text>
          {action("now", boss.lastAction, boss.lastDetail)}
        </Box>
        {boss.toolCounts && Object.keys(boss.toolCounts).length > 0 ? (
          <Box flexDirection="column">
            <Text dimColor>{T.mostUsed}</Text>
            <Text wrap="truncate-end">
              {topTools(boss.toolCounts, isCompact ? 3 : 4, mcpNames)}
            </Text>
          </Box>
        ) : null}
      </Box>
    ) : (
      <Text dimColor>{T.waitingFirstPrompt}</Text>
    );

    // ── Limits ───────────────────────────────────────────────────────────
    const sparkWidth = Math.max(8, Math.min(30, colWidth - 20));
    const ctxSeries = samples.flatMap((s) =>
      s.ctx === undefined ? [] : [100 - s.ctx],
    );
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
    /** A reset already behind us: no reply since, so nothing of the new window is used. */
    const isPastReset = (resetsAt?: string) => {
      const at = resetsAt ? Date.parse(resetsAt) : NaN;
      return !Number.isNaN(at) && at <= now;
    };
    const rateNote = (kind: string, resetsAt?: string) => {
      const at = resetsAt ? Date.parse(resetsAt) : NaN;
      if (isPastReset(resetsAt)) return T.resetPassed(fmtClock(at));
      const reset = Number.isNaN(at)
        ? ""
        : T.resets(fmtReset(at, now, LOCALE[L]), dur(at - now));
      if (kind !== "five_hour") return reset;
      const eta = etaToFull(fivePoints, now);
      if (eta === undefined || (!Number.isNaN(at) && eta >= at)) return reset;

      return `${reset}${reset ? " · " : ""}${T.runsOut(fmtClock(eta))}`;
    };
    const resBody = (
      <Box flexDirection="column" rowGap={space.inner}>
        {ctxUsed !== undefined
          ? meter(
              "ctx",
              "layers",
              T.ctx,
              percentLeft(ctxUsed),
              ctxNote,
              ctxSeries,
            )
          : line(
              "ctx",
              icon("layers", "inactive"),
              <Text dimColor>{T.ctxNoData}</Text>,
            )}
        {(m?.rates ?? []).map((r) =>
          meter(
            r.kind,
            r.kind === "seven_day" ? "calendar" : "gauge",
            rateLabel(r.kind, T.rate),
            isPastReset(r.resetsAt) ? 100 : percentLeft(r.percentUsed),
            rateNote(r.kind, r.resetsAt),
          ),
        )}
      </Box>
    );

    // ── Context guard ────────────────────────────────────────────────────
    const guardColor =
      ctx === "critical" ? "error" : ctx === "warn" ? "warning" : "success";
    const guardText =
      ctx === "critical"
        ? T.guardCritical
        : ctx === "warn"
          ? T.guardWarn
          : T.guardOk;
    const snapText = snap
      ? `${fmtClock(snap.at)} · ${snap.path.replace(/^.*\/\.claude\//, "~/.claude/")}`
      : T.snapNone;
    const guardWide = layout === "medium";
    const guardBody = (
      <Box
        flexDirection={guardWide ? "row" : "column"}
        justifyContent="space-between"
        alignItems={guardWide ? "center" : "stretch"}
        columnGap={space.gap}
        rowGap={space.inner}
      >
        <Box flexDirection="column" rowGap={space.inner} flexShrink={1}>
          {line(
            "state",
            ctx === "ok"
              ? icon("check", guardColor)
              : live("pulse", guardColor, 14),
            <Text color={guardColor}>{guardText}</Text>,
          )}
          {line(
            "snap",
            icon("save", "inactive", 13),
            <Text dimColor wrap="truncate-start">
              {T.snapshot(snapText)}
            </Text>,
          )}
        </Box>
        <Box columnGap={space.gap} rowGap={space.stack} flexWrap="wrap">
          <Button
            key="compact"
            label={T.btnCompact}
            hotkey="h"
            variant={ctx === "ok" ? "secondary" : "primary"}
            onPress={async () => $.ui.toast(await compactNow($))}
          />
          {snap ? (
            <Button
              key="copy"
              label={isCompact ? T.btnCopyShort : T.btnCopy}
              variant="secondary"
              onPress={async () => {
                const r = await $.ui.copy({
                  text: T.resume(snap.path),
                  surface: e.surface,
                });
                $.ui.toast(r.isCopied ? T.copied : T.copyFailed);
              }}
            />
          ) : null}
        </Box>
      </Box>
    );

    // ── Running agents ───────────────────────────────────────────────────
    /** A squad member's lead mark: a spinner while it runs, then its outcome. */
    const heroMark = (hero: Hero, color: string, size: number) =>
      hero.status === "running"
        ? live("loader", color, size)
        : icon(
            STATUS_VIEW[hero.status].icon,
            STATUS_VIEW[hero.status].color,
            size,
            undefined,
            T.status[hero.status],
          );

    const agentCard = (hero: Hero) => {
      const badge = modelBadge(hero.model);
      const elapsed = (hero.endedAt ?? now) - hero.startedAt;
      const isRunning = hero.status === "running";

      return (
        <Box
          key={hero.id}
          flexDirection="column"
          borderStyle="round"
          borderColor="inactive"
          hover={{ borderColor: badge.color }}
          paddingX={space.padX}
          paddingY={1}
          rowGap={1}
          width={cardWidth}
        >
          <Box justifyContent="space-between">
            {line(
              "model",
              heroMark(hero, badge.color, 14),
              <Text bold color={badge.color}>
                {hero.model === "?" ? T.modelPending : shortModel(hero.model)}
              </Text>,
            )}
            <Text color="warning">{effortDots(hero.effort)}</Text>
          </Box>
          <Box flexDirection="column">
            <Text bold wrap="truncate-end">
              {clip(hero.title, cardWidth - frame - 1)}
            </Text>
            <Text dimColor wrap="truncate-end">
              {hero.type}
            </Text>
          </Box>
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {icon("clock", "inactive", 12, "c")}
            <Text dimColor>{dur(elapsed)}</Text>
            <Text dimColor>·</Text>
            {icon("wrench", "inactive", 12, "w")}
            <Text dimColor>{hero.actions}</Text>
            {hero.tokens ? <Text dimColor>·</Text> : null}
            {hero.tokens ? icon("layers", "inactive", 12, "t") : null}
            {hero.tokens ? (
              <Text dimColor>{fmtTokens(hero.tokens)}</Text>
            ) : null}
          </Box>
          {isRunning ? (
            action("now", hero.lastAction, hero.lastDetail, cardWidth)
          ) : (
            <Text color={STATUS_VIEW[hero.status].color}>
              {T.status[hero.status]}
            </Text>
          )}
          {anim && isRunning ? (
            <Text color={badge.color}>{pulseBar(now, cardWidth - frame)}</Text>
          ) : null}
          <Box
            display="none"
            hover={{ display: "flex" }}
            flexDirection="column"
          >
            <Text dimColor wrap="truncate-end">
              {T.startedAt(
                fmtClock(hero.startedAt),
                effortLabel(hero.effort, T.effort),
              )}
            </Text>
            <Text dimColor wrap="truncate-end">
              id {hero.id}
            </Text>
          </Box>
        </Box>
      );
    };

    const agentRow = (hero: Hero) => {
      const badge = modelBadge(hero.model);
      const isRunning = hero.status === "running";

      return (
        <Box key={hero.id} flexDirection="column">
          <Box justifyContent="space-between" columnGap={1}>
            {line(
              "t",
              heroMark(hero, badge.color, 13),
              <Text bold wrap="truncate-end">
                {clip(hero.title, inner - frame - 18)}
              </Text>,
            )}
            <Text dimColor>
              {dur((hero.endedAt ?? now) - hero.startedAt)} · {hero.actions}
            </Text>
          </Box>
          <Box paddingLeft={2}>
            {isRunning ? (
              action("now", hero.lastAction, hero.lastDetail, inner)
            ) : (
              <Text color={STATUS_VIEW[hero.status].color}>
                {T.status[hero.status]}
              </Text>
            )}
          </Box>
        </Box>
      );
    };

    const modelMix = Object.entries(
      running.reduce<Record<string, number>>((acc, x) => {
        const k = shortModel(x.model).split(" ")[0] ?? "?";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ");

    const partyBody =
      squad.length === 0 ? (
        line(
          "empty",
          icon("bot", "inactive"),
          <Text dimColor>{T.noSubagents}</Text>,
        )
      ) : isCompact ? (
        <Box flexDirection="column" rowGap={space.stack}>
          {squad.map(agentRow)}
        </Box>
      ) : (
        <Box
          flexDirection="row"
          flexWrap="wrap"
          columnGap={gutter}
          rowGap={space.stack}
        >
          {squad.map(agentCard)}
        </Box>
      );

    // ── Finished and log ─────────────────────────────────────────────────
    const doneRow = (hero: Hero) => {
      const badge = modelBadge(hero.model);
      const view = STATUS_VIEW[hero.status];
      const elapsed = (hero.endedAt ?? now) - hero.startedAt;
      const extra = isCompact
        ? dur(elapsed)
        : `${dur(elapsed)} · ${T.callsShort(hero.actions)}${hero.tokens ? ` · ${fmtTokens(hero.tokens)}` : ""}`;

      return (
        <Box key={hero.id} justifyContent="space-between" columnGap={1}>
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {hero.status === "done" &&
            anim &&
            now - (hero.endedAt ?? 0) < FRESH_DONE_MS ? (
              Svg && takeFrame() ? (
                <Svg
                  key="s"
                  source={popCheckSvg(view.color)}
                  alt={T.doneAlt}
                  width={14}
                  height={14}
                  isInteractive
                />
              ) : (
                <Text key="s" color={view.color} bold>
                  {Math.floor(now / 500) % 2 ? "✔" : "✓"}
                </Text>
              )
            ) : (
              icon(view.icon, view.color, 14, "s", T.status[hero.status])
            )}
            {icon(badge.icon, badge.color, 12, "m")}
            <Text wrap="truncate-end">
              {clip(
                hero.title,
                Math.max(10, pairWidth - frame - extra.length - 10),
              )}
            </Text>
          </Box>
          <Text dimColor>{extra}</Text>
        </Box>
      );
    };

    const doneBody =
      finished.length === 0 ? (
        <Text dimColor>{T.nothingYet}</Text>
      ) : (
        <Box flexDirection="column">
          {finished
            .slice(isCompact ? -4 : -7)
            .reverse()
            .map(doneRow)}
        </Box>
      );
    const logBody =
      lines.length === 0 ? (
        <Text dimColor>{T.noEvents}</Text>
      ) : (
        <Box flexDirection="column">
          {lines
            .slice(isCompact ? -4 : -7)
            .reverse()
            .map((l, i) => (
              <Box
                key={`log-${i}`}
                flexDirection="row"
                alignItems="center"
                columnGap={1}
              >
                <Text dimColor>{fmtClock(l.at)}</Text>
                {icon(l.icon, l.color ?? "inactive", 12)}
                <Text wrap="truncate-end">
                  {clip(logText(l), pairWidth - frame - 12)}
                </Text>
              </Box>
            ))}
        </Box>
      );

    // ── Arsenal: MCP servers, plugins, skills ─────────────────────────────
    /** Columns of equal cells that fit a half-width section, cells at least `min` wide. */
    const gridCols = (min: number) =>
      Math.max(1, Math.min(5, Math.floor((inner - frame + 1) / (min + 1))));
    /** Lays cells out in rows of `cols` equal columns; blanks pad the last row. */
    const grid = (key: string, cells: RenderNode[], cols: number) => {
      const rows: RenderNode[][] = [];
      for (let i = 0; i < cells.length; i += cols)
        rows.push(cells.slice(i, i + cols));

      return (
        <Box key={key} flexDirection="column" rowGap={isCompact ? 0 : 1}>
          {rows.map((r, i) => (
            <Box key={`${key}-r${i}`} flexDirection="row" columnGap={1}>
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
    /** One grid cell: icon and label on the left, a count or note pinned right. */
    const cell = (
      key: string,
      name: IconName,
      color: string,
      label: string,
      isLit: boolean,
      right: string | undefined,
      lead?: RenderNode,
    ) => (
      <Box
        key={key}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        columnGap={1}
        paddingX={1}
        width="100%"
        borderStyle={isCompact ? undefined : "round"}
        borderColor={isLit ? color : "inactive"}
        borderDimColor={!isLit}
        hover={{ borderColor: color }}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          columnGap={1}
          flexShrink={1}
          minWidth={0}
        >
          {lead ?? icon(name, isLit ? color : "inactive", 12)}
          <Text
            bold={isLit}
            color={isLit ? color : undefined}
            dimColor={!isLit}
            wrap="truncate-end"
          >
            {label}
          </Text>
        </Box>
        {right ? (
          <Text color={isLit ? color : undefined} dimColor={!isLit}>
            {right}
          </Text>
        ) : null}
      </Box>
    );
    const armCols = gridCols(18);
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
    ) => (
      <Box key={key} flexDirection="column" rowGap={space.inner}>
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          columnGap={1}
        >
          <Box flexDirection="row" alignItems="center" columnGap={1}>
            {icon(name, color, 13)}
            <Text bold>{title}</Text>
            <Text dimColor>
              {total}
              {hotCount ? ` · ${T.inUse(hotCount)}` : ""}
            </Text>
          </Box>
          {more > 0 ? <Text dimColor>{T.more(more)}</Text> : null}
        </Box>
        {total === 0 ? (
          <Text dimColor>{T.none}</Text>
        ) : (
          grid(`${key}-grid`, chips, armCols)
        )}
      </Box>
    );
    const chipLimit = armCols * (layout === "wide" ? 3 : 2);
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
    const arsenalBody = !arms ? (
      <Text dimColor>{T.collecting}</Text>
    ) : (
      <Box flexDirection="column" rowGap={space.inner}>
        {group(
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
        )}
        {group(
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
        )}
        {group(
          "g-skills",
          "zap",
          "merged",
          isCompact ? T.groupSkillsShort : T.groupSkills,
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
        )}
      </Box>
    );

    // ── Achievements ─────────────────────────────────────────────────────
    const stats = statsOfRecord(lifeRec);
    const haveIds = have.map((x) => x.id);
    const next = nextAchievement(stats, haveIds);
    const achCols = gridCols(20);
    const achBody = (
      <Box flexDirection="column" rowGap={space.inner}>
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          {progress(
            (have.length / ACHIEVEMENTS.length) * 100,
            "warning",
            Math.max(10, Math.min(30, pairWidth - frame - 10)),
          )}
          <Text bold>
            {have.length} / {ACHIEVEMENTS.length}
          </Text>
        </Box>
        {next
          ? (() => {
              const [cur, goal] = next.progress(stats);
              return line(
                "next",
                live("pulse", "warning", 12),
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
              icon("trophy", "warning"),
              <Text color="warning">{T.allUnlocked}</Text>,
            )}
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
        {grid(
          "ach-grid",
          ACHIEVEMENTS.map((a) => {
            const got = haveIds.includes(a.id);
            const [cur, goal] = a.progress(stats);
            const at = have.find((x) => x.id === a.id)?.at ?? 0;
            const isFresh = got && now - at < 10_000;
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
              isFresh ? live("pulse", "warning", 12) : undefined,
            );
          }),
          achCols,
        )}
      </Box>
    );

    const row = (key: string, children: RenderNode[]) => (
      <Box
        key={key}
        flexDirection={isCompact ? "column" : "row"}
        columnGap={gutter}
        rowGap={space.stack}
      >
        {children}
      </Box>
    );
    const colW = isCompact ? "100%" : "col";
    const pairW = colW;

    const bossSection = section(
      "boss",
      "crown",
      T.secMain,
      "claude",
      bossBody,
      layout === "medium" ? pairW : colW,
    );
    const resSection = section(
      "res",
      "gauge",
      T.secLimits,
      "suggestion",
      resBody,
      layout === "medium" ? pairW : colW,
      <Text dimColor>{T.remaining}</Text>,
    );
    const guardSection = section(
      "guard",
      "shield",
      T.secGuard,
      guardColor,
      guardBody,
      layout === "wide" ? colW : "100%",
    );
    const partySection = section(
      "party",
      "users",
      T.secSquad,
      "warning",
      partyBody,
      "100%",
      running.length > 0 ? (
        <Text dimColor>{modelMix}</Text>
      ) : (
        <Text dimColor>0</Text>
      ),
    );
    const doneSection = section(
      "done",
      "trophy",
      T.secDone,
      "success",
      doneBody,
      pairW,
      <Text dimColor>
        {won} ✓{lost ? ` · ${lost} ✗` : ""}
      </Text>,
    );
    const logSection = section(
      "log",
      "list",
      T.secLog,
      "inactive",
      logBody,
      pairW,
    );
    const hotTotal =
      Object.keys(used.mcp).length + Object.keys(used.skills).length;
    const arsenalSection = section(
      "arsenal",
      "swords",
      T.secArsenal,
      "suggestion",
      arsenalBody,
      "100%",
      <Text dimColor>
        {hotTotal ? T.inUse(hotTotal) : isCompact ? "" : T.litHint}
      </Text>,
    );
    const achSection = section(
      "ach",
      "medal",
      T.secAchievements,
      "warning",
      achBody,
      "100%",
      <Text dimColor>{isCompact ? "" : T.xpEach}</Text>,
    );

    // ── Context: what the window is made of ─────────────────────────────
    const ctxWidth = Math.max(
      8,
      Math.min(isCompact ? 60 : 90, inner - frame - 1),
    );
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
        source={stackedSvg(
          colored.map((c) => ({
            percent: pctOf(c.row.tokens),
            color: c.color,
          })),
        )}
        alt={T.compositionAlt}
        width={ctxWidth * 9}
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
          <Text>
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
      >
        <Box
          flexDirection="row"
          alignItems="center"
          columnGap={1}
          flexShrink={1}
          minWidth={0}
        >
          <Text color={color}>●</Text>
          <Text dimColor={dim} wrap="truncate-end">
            {name}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text dimColor={dim}>
            <Text bold={!dim}>{fmtTokens(tokens)}</Text>
            {isCompact ? null : (
              <Text dimColor> · {pctOf(tokens).toFixed(1)}%</Text>
            )}
          </Text>
        </Box>
      </Box>
    );
    const usedTotal = usedRows.reduce((a, r) => a + r.tokens, 0);
    const compositionBody = !parts ? (
      <Text dimColor>{T.collectingBreakdown}</Text>
    ) : (
      <Box flexDirection="column" rowGap={space.inner}>
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
        name: shortPath(x.path, Math.max(16, pairWidth - frame - 8)),
        tokens: x.tokens,
      }));
    const compositionSection = section(
      "composition",
      "layers",
      isCompact ? T.secCompositionShort : T.secComposition,
      "merged",
      compositionBody,
      "100%",
      parts && !isCompact ? (
        <Text dimColor>{T.updated(fmtClock(parts.at))}</Text>
      ) : undefined,
    );
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
          columnGap={space.gap}
          borderStyle="round"
          borderColor={partyColor}
          paddingX={space.padX}
        >
          {Svg && anim && takeFrame() ? (
            <Svg
              source={burstSvg(partyColor)}
              alt={T.celebrationAlt}
              width={isCompact ? 32 : 44}
              height={isCompact ? 29 : 40}
              isInteractive
            />
          ) : (
            <Text bold color={partyColor}>
              {Math.floor(now / 500) % 2 ? "✦" : "✧"}
            </Text>
          )}
          <Box flexDirection="column" flexShrink={1} minWidth={0}>
            <Text dimColor>
              {party.kind === "level" ? T.bannerLevel : T.bannerAch}
            </Text>
            <Text bold color={partyColor} wrap="truncate-end">
              {partyTitle}
            </Text>
            {isCompact ? null : (
              <Text dimColor wrap="truncate-end">
                {partyNote}
              </Text>
            )}
          </Box>
        </Box>
      ) : null;

    // ── Tabs ─────────────────────────────────────────────────────────────
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

    const tabBar = (
      <Box
        key="tabs"
        flexDirection="row"
        flexWrap="wrap"
        columnGap={isCompact ? 2 : 1}
        rowGap={0}
      >
        {shownTabs.map((t, i) => (
          <Button
            key={`tab-${t.id}`}
            label={
              isCompact
                ? t.id === current
                  ? `● ${t.label}`
                  : t.label
                : t.id === "achievements"
                  ? `${t.label} ${have.length}/${ACHIEVEMENTS.length}`
                  : t.id === "overview" && running.length > 0
                    ? `${t.label} · ${running.length}`
                    : t.label
            }
            hotkey={isCompact ? undefined : String(i + 1)}
            plain={isCompact ? true : undefined}
            variant={t.id === current ? "primary" : "secondary"}
            dimColor={t.id !== current}
            onPress={async () => {
              await update($, tab, () => t.id);
              await writeProfile($, (p) => ({ ...p, tab: t.id }));
            }}
          />
        ))}
        {langSwitch}
      </Box>
    );

    const page: RenderChildren =
      current === "context"
        ? [
            compositionSection,
            row("ctx-lists", [mcpWeightSection, memorySection]),
            guardSection,
          ]
        : current === "arsenal"
          ? [arsenalSection]
          : current === "achievements"
            ? [achSection]
            : current === "log"
              ? [row("bottom", [doneSection, logSection])]
              : [
                  tiles,
                  layout === "wide"
                    ? row("top", [bossSection, resSection, guardSection])
                    : [row("top", [bossSection, resSection]), guardSection],
                  partySection,
                ];

    return (
      <Box
        flexDirection="column"
        paddingX={space.outerX}
        paddingY={space.padY}
        rowGap={space.stack}
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
    const { Box, Text, Button } = els;
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
          <Text color={ctxColor}>{T.bandContext(percentLeft(m.contextPercent))}</Text>
        ) : null}
        {m?.contextPercent !== undefined && ctx !== "ok" ? (
          // One key from the focused band: h compacts and writes the snapshot.
          <Button
            key="handoff"
            label="/handoff"
            hotkey="h"
            plain
            onPress={async () => $.ui.toast(await compactNow($))}
          />
        ) : null}
        {five ? icon("gauge", "subtle", "f") : null}
        {five ? (
          <Text dimColor>{T.bandFive(Math.round(percentLeft(five.percentUsed)))}</Text>
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
