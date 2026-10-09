export type HeroStatus = "running" | "done" | "failed" | "stopped";

export type Hero = {
  id: string;
  title: string;
  type: string;
  model: string;
  effort?: string;
  status: HeroStatus;
  startedAt: number;
  endedAt?: number;
  actions: number;
  lastAction?: string;
  lastDetail?: string;
  tokens?: number;
};

export type RateWindow = {
  kind: string;
  percentUsed: number;
  resetsAt?: string;
};

export type Meters = {
  contextTokens?: number;
  contextWindow: number;
  contextPercent?: number;
  rates: RateWindow[];
  usd?: number;
  sessionStartedAt?: number;
};

export type Commander = {
  model: string;
  effort?: string;
  steps: number;
  actions: number;
  lastAction?: string;
  lastDetail?: string;
  toolCounts?: Record<string, number>;
  startedAt: number;
};

/**
 * A journal line. `msg` names a message of the language table and its
 * arguments, so the line reads in whatever language the pane shows; `text` is
 * the fallback for lines written before languages.
 */
export type LogLine = {
  at: number;
  icon: string;
  color?: string;
  text: string;
  msg?: { k: string; a: (string | number | boolean)[] };
};

/** One reading of the meters, kept for sparklines and the limit forecast. */
export type Sample = { at: number; ctx?: number; five?: number; usd?: number };

export type Snapshot = { at: number; path: string; trigger: string };

export type McpServer = {
  name: string;
  tools: number;
  label?: string;
  tokens?: number;
};
export type PluginEntry = { name: string; commands: number };
export type SkillEntry = {
  name: string;
  source: string;
  plugin?: string;
  description: string;
};

/** What the session can reach: refreshed at start and once a minute. */
export type Arsenal = {
  mcp: McpServer[];
  plugins: PluginEntry[];
  skills: SkillEntry[];
  at: number;
};

/** Counters the achievements and the arsenal highlights read. */
export type Usage = {
  tools: Record<string, number>;
  skills: Record<string, number>;
  mcp: Record<string, number>;
  peak: number;
  snapshots: number;
  lastSkill?: { name: string; at: number };
};

export type Unlock = { id: string; at: number };

/** One row of the context breakdown, as /context lists it. */
export type ContextRow = { name: string; tokens: number; kind: string };

/** What the context window is made of, read every half minute. */
export type Breakdown = {
  rows: ContextRow[];
  total: number;
  max: number;
  memory: { path: string; tokens: number }[];
  agents: { name: string; tokens: number }[];
  mcp: { key: string; label: string; tokens: number }[];
  at: number;
};

/** A moment worth a banner: an unlock or a new level, shown for a few seconds. */
export type Celebration = {
  kind: "achievement" | "level";
  /** The achievements unlocked together, by id. */
  ids?: string[];
  level?: number;
  at: number;
};

export type Tab = "overview" | "context" | "arsenal" | "achievements" | "log";

/** One session's contribution to the lifetime profile, kept in $.store. */
export type SessionRecord = {
  id: string;
  at: number;
  agentsTotal: number;
  agentsDone: number;
  peakParallel: number;
  streak: number;
  calls: number;
  mcpCalls: number;
  mcpServers: string[];
  skillUses: number;
  reads: number;
  edits: number;
  bashes: number;
  snapshots: number;
  usd: number;
};

/** Every other session's records summed, read once at session start. */
export type Lifetime = { sessions: number; others: SessionRecord };

declare module "claude-code" {
  interface PluginState {
    vanguard: {
      heroes: Hero[];
      meters: Meters | null;
      commander: Commander | null;
      log: LogLine[];
      snapshot: Snapshot | null;
      history: Sample[];
      arsenal: Arsenal | null;
      usage: Usage | null;
      unlocked: Unlock[];
      lifetime: Lifetime | null;
      collapsed: Record<string, boolean>;
      breakdown: Breakdown | null;
      tab: Tab;
      celebration: Celebration | null;
      levelSeen: number;
      /** The language picked in the pane; null follows the setting. */
      lang: string | null;
    };
  }
}
