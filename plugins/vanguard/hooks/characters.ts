// The Vanguard squad: chibi robot-knights, one per agent role, as SVG. They
// share one body (helmet-head, dark visor, glowing eyes, stubby limbs) and
// differ by colour, headgear and prop; each acts out what its agent is doing.
// Pure: the same options give the same markup byte for byte, so a redraw keeps
// the frame and its motion runs on. No engine calls, so tests reach it directly.

import { framed, hexOf } from "./icons";

export type Role =
  | "commander"
  | "scout"
  | "architect"
  | "builder"
  | "reviewer"
  | "verifier"
  | "guide"
  | "soldier";
export type Activity =
  | "think"
  | "read"
  | "search"
  | "edit"
  | "shell"
  | "web"
  | "delegate"
  | "plan";
export type Mood = "working" | "waiting" | "done" | "failed" | "stopped";

/** Theme colour key per role (keys of HEX in icons.ts, or a #hex), used by the pane for text/borders. */
export const ROLE_COLOR: Record<Role, string> = {
  commander: "claude",
  scout: "#14B8A6",
  architect: "suggestion",
  builder: "warning",
  reviewer: "merged",
  verifier: "success",
  guide: "#EC4899",
  soldier: "#64748B",
};

/** Which role an agent type plays. */
export function roleOf(agentType: string): Role {
  const t = agentType.toLowerCase();
  const name = t.slice(t.lastIndexOf(":") + 1);
  if (name === "scout" || name === "explore") return "scout";
  if (name === "architect" || name === "plan") return "architect";
  if (name === "builder") return "builder";
  if (name.includes("review") || name.includes("security")) return "reviewer";
  if (
    name === "verifier" ||
    name.includes("verify") ||
    name.includes("test") ||
    name.includes("qa")
  )
    return "verifier";
  if (name.includes("guide") || name.includes("docs")) return "guide";

  return "soldier";
}

const SEARCH = ["Grep", "Glob", "LSP", "ToolSearch", "LS"];
const EDIT = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const SHELL = ["Bash", "BashOutput", "KillShell", "Monitor", "PowerShell"];
const DELEGATE = ["Agent", "Task", "SendMessage", "Workflow"];
const PLAN = [
  "TodoWrite",
  "TaskCreate",
  "TaskUpdate",
  "EnterPlanMode",
  "ExitPlanMode",
];

/** Which activity a tool name shows; undefined (no tool yet / between calls) is "think". */
export function activityOf(tool?: string): Activity {
  if (!tool) return "think";
  if (tool === "Read" || tool === "NotebookRead") return "read";
  if (SEARCH.includes(tool)) return "search";
  if (EDIT.includes(tool)) return "edit";
  if (SHELL.includes(tool)) return "shell";
  if (PLAN.includes(tool) || tool.toLowerCase().includes("sequentialthinking"))
    return "plan";
  if (tool === "WebFetch" || tool === "WebSearch" || tool.startsWith("mcp__"))
    return "web";
  if (DELEGATE.includes(tool)) return "delegate";

  return "think";
}

export type CharacterOptions = {
  role: Role;
  activity: Activity;
  mood: Mood;
  seed: string;
  animated: boolean;
};

type Pt = [number, number];
type Pal = Record<
  | "b"
  | "hi"
  | "lo"
  | "d"
  | "o"
  | "l"
  | "eye"
  | "visor"
  | "acc"
  | "accO"
  | "gold"
  | "goldO"
  | "steel"
  | "steelO"
  | "blade"
  | "wood"
  | "woodO"
  | "paper"
  | "ink"
  | "glass",
  string
>;

/** A role's own accent: cape, scarf, beret, hard hat, crest. */
const ACCENT: Record<Role, string> = {
  commander: "#A8344A",
  scout: "#F59E0B",
  architect: "#E5534B",
  builder: "#F97316",
  reviewer: "#F2B53A",
  verifier: "#F2B53A",
  guide: "#F2B53A",
  soldier: "#E5484D",
};

const rgb = (h: string) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i]! - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

function palette(role: Role, mood: Mood): Pal {
  // A stopped agent fades towards grey: fills to a mid grey, outlines to a
  // dark one, so the figure dims but keeps its edges.
  const sleep = mood === "stopped";
  const t = (x: string) => (sleep ? mix(x, "#8A8F98", 0.7) : x);
  const tO = (x: string) => (sleep ? mix(x, "#4A4F58", 0.7) : x);
  const c = t(hexOf(ROLE_COLOR[role]));
  const acc = t(ACCENT[role]);

  return {
    b: c,
    hi: mix(c, "#ffffff", 0.16),
    lo: mix(c, "#000000", 0.1),
    d: mix(c, "#000000", 0.22),
    o: mix(c, "#000000", 0.42),
    l: mix(c, "#ffffff", 0.58),
    eye: mix(c, "#ffffff", 0.86),
    visor: "#1B2030",
    acc,
    accO: mix(acc, "#000000", 0.4),
    gold: t("#F5C04A"),
    goldO: tO("#9A6A12"),
    steel: t("#B4BDC9"),
    steelO: tO("#4A5361"),
    blade: t("#E8EDF3"),
    wood: t("#B0773F"),
    woodO: tO("#6B4322"),
    paper: t("#FFFDF6"),
    ink: t("#AEB6C2"),
    glass: "#CDEBFF",
  };
}

/** FNV-1a: a stable number from the seed, so each agent keeps its own rhythm. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const n = (v: number) => String(r2(v));
const pt = (p: Pt) => `${n(p[0])} ${n(p[1])}`;

/** A stubby arm from shoulder to hand: an outlined capsule. */
function arm(s: Pt, h: Pt, p: Pal): string {
  const d = `M${pt(s)}L${pt(h)}`;
  return `<path d="${d}" stroke="${p.o}" stroke-width="6.2"/><path d="${d}" stroke="${p.b}" stroke-width="3.4"/>`;
}

function hand(h: Pt, p: Pal): string {
  return `<circle cx="${n(h[0])}" cy="${n(h[1])}" r="2.9" fill="${p.l}" stroke="${p.o}" stroke-width="1.4"/>`;
}

const at = (h: Pt, deg: number, body: string, scale = 1) =>
  `<g transform="translate(${pt(h)}) rotate(${deg})${scale === 1 ? "" : ` scale(${scale})`}">${body}</g>`;

// Props, drawn with the grip at 0,0 and pointing up.

const sword = (p: Pal) =>
  `<path d="M-2-3.4V-17.4L0-20.6 2-17.4V-3.4z" fill="${p.blade}" stroke="${p.steelO}" stroke-width="1.3"/><rect x="-4.8" y="-4.8" width="9.6" height="2.8" rx="1.4" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.1"/><circle cy="4.4" r="1.7" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.1"/>`;

const shield = (p: Pal) =>
  `<path d="M-6.6-8.4H6.6V-1.4Q6.6 5.6 0 8.8-6.6 5.6-6.6-1.4z" fill="${p.paper}" stroke="${p.o}" stroke-width="1.6"/><path d="M-4.6-6.4H4.6V-1.4Q4.6 4.2 0 6.6-4.6 4.2-4.6-1.4z" fill="${p.b}"/><path d="M-2.8-.6-.8 1.6 3-2.6" fill="none" stroke="#fff" stroke-width="2.2"/>`;

const hammer = (p: Pal, len = 12.5) =>
  `<rect x="-1.25" y="-${len}" width="2.5" height="${len + 3.5}" rx="1.25" fill="${p.wood}" stroke="${p.woodO}" stroke-width="1"/><rect x="-5.4" y="-${len + 4.6}" width="10.8" height="5.8" rx="1.5" fill="${p.steel}" stroke="${p.steelO}" stroke-width="1.3"/><path d="M-3.6-${len + 3.2}h4" stroke="#fff" stroke-opacity=".6" stroke-width="1.1"/>`;

const magnifier = (p: Pal) =>
  `<rect x="-1.4" y="-7.4" width="2.8" height="9.4" rx="1.4" fill="${p.woodO}"/><circle cy="-12" r="5" fill="${p.glass}" fill-opacity=".5" stroke="${p.steelO}" stroke-width="2"/><path d="M-2.9-13.5a3.2 3.2 0 0 1 2.3-2.2" fill="none" stroke="#fff" stroke-width="1.2"/>`;

const blueprint = (p: Pal) =>
  `<rect x="-3.2" y="-17" width="6.4" height="19.5" rx="1.6" fill="${p.paper}" stroke="${p.o}" stroke-width="1.3"/><path d="M-1.4-12.6v9.6M1.4-12.6v4.4h-2.8" fill="none" stroke="${p.b}" stroke-width="1.2"/><ellipse cy="-17" rx="3.2" ry="1.7" fill="${p.l}" stroke="${p.o}" stroke-width="1.2"/><circle cy="-17" r=".8" fill="${p.o}"/>`;

const spyglass = (p: Pal) =>
  `<rect x="-1.5" y="-4.2" width="3" height="7" rx=".9" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.1"/><rect x="-2" y="-11" width="4" height="7.4" rx=".9" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.1"/><rect x="-2.8" y="-19.6" width="5.6" height="9" rx="1.2" fill="${p.wood}" stroke="${p.woodO}" stroke-width="1.2"/><path d="M-2.8-17.6h5.6" stroke="${p.gold}" stroke-width="1.5"/>`;

const book = (p: Pal) =>
  `<path d="M0-2.6Q-3.8-5-8-3.8V4.2Q-3.8 3 0 5.2 3.8 3 8 4.2V-3.8Q3.8-5 0-2.6z" fill="${p.d}" stroke="${p.o}" stroke-width="1.3"/><path d="M0-3.4Q-3.6-5.4-7-4.4V2.6Q-3.6 1.8 0 3.8 3.6 1.8 7 2.6V-4.4Q3.6-5.4 0-3.4z" fill="${p.paper}"/><path d="M0-3.4V3.8" stroke="${p.o}" stroke-width="1"/><path d="M-5.4-1.8q1.7-.5 3.4 0M2-1.8q1.7-.5 3.4 0M-5.4.8q1.7-.5 3.4 0M2 .8q1.7-.5 3.4 0" fill="none" stroke="${p.ink}" stroke-width="1.1"/>`;

const pencil = (p: Pal) =>
  `<path d="M-1.9-9.5h3.8V2.4L0 6.2-1.9 2.4z" fill="#F5C04A" stroke="${p.woodO}" stroke-width="1.1"/><path d="M-1.9 2.4h3.8L0 6.2z" fill="#F3D9B1" stroke="${p.woodO}" stroke-width="1.1"/><rect x="-1.9" y="-12.6" width="3.8" height="3.1" rx="1" fill="#F28CA8" stroke="${p.woodO}" stroke-width="1.1"/>`;

/** Which hand-held role prop a role carries, and whether its hand closes over it. */
function roleProp(role: Role, p: Pal): [string, boolean, number] | undefined {
  if (role === "soldier") return [sword(p), true, -18];
  if (role === "verifier") return [shield(p), false, -6];
  if (role === "builder") return [hammer(p), true, -16];
  if (role === "reviewer") return [magnifier(p), true, -14];
  if (role === "architect") return [blueprint(p), true, -22];
  if (role === "scout") return [spyglass(p), true, -52];
  if (role === "guide") return [book(p), false, -8];

  return undefined;
}

function headgear(role: Role, p: Pal): string {
  if (role === "commander")
    return `<path d="M24.4 13 23 5.6l4.6 3.2L32 2.8l4.4 6 4.6-3.2-1.4 7.4z" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.3"/><circle cx="32" cy="10" r="1.3" fill="${p.acc}"/>`;
  if (role === "architect")
    return `<ellipse cx="28.5" cy="10.8" rx="12.5" ry="4.4" transform="rotate(-9 28.5 10.8)" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.4"/><circle cx="28" cy="5.8" r="1.5" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.2"/>`;
  if (role === "builder")
    return `<path d="M17.8 15.2a14.2 10 0 0 1 28.4 0z" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.4"/><path d="M32 5.6v9.2" stroke="${p.accO}" stroke-width="1.2"/><rect x="13.2" y="14" width="37.6" height="3.6" rx="1.8" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.4"/>`;
  if (role === "reviewer")
    return `<g fill="#fff" fill-opacity=".1" stroke="${p.gold}" stroke-width="1.5"><circle cx="26.6" cy="25" r="5.3"/><circle cx="37.4" cy="25" r="5.3"/></g><path d="M31.6 24.6h.8M21.3 24.2h-2.6M42.7 24.2h2.6" stroke="${p.gold}" stroke-width="1.5"/>`;
  if (role === "guide")
    return `<path d="M22.6 3l1.35 2.75 3.05.45-2.2 2.15.5 3.05L22.6 9.95 19.9 11.4l.5-3.05-2.2-2.15 3.05-.45z" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1.1"/>`;
  if (role === "soldier")
    return `<path d="M30.2 10.8C28.6 5.4 32.4 1.6 39.4 2.6 36.2 3.8 34.6 6.4 34.4 10.8z" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.3"/>`;

  return "";
}

/** The ear-antenna a scout always wears and the others raise to go online. */
const antenna = (p: Pal, ball: string) =>
  `<path d="M12.6 21.4 10.4 13.6" stroke="${p.o}" stroke-width="1.6"/><circle cx="10.2" cy="12.6" r="2.3" fill="${ball}" stroke="${p.o}" stroke-width="1.3"/>`;

type Eyes = "open" | "happy" | "sad" | "closed";

function eyes(kind: Eyes, p: Pal): string {
  if (kind === "happy")
    return `<path d="M24.3 26.8q2.3-4.6 4.6 0M35.1 26.8q2.3-4.6 4.6 0" fill="none" stroke="${p.eye}" stroke-width="2.3"/>`;
  if (kind === "closed")
    return `<path d="M24.3 25.6q2.3 2 4.6 0M35.1 25.6q2.3 2 4.6 0" fill="none" stroke="${mix(p.eye, p.visor, 0.25)}" stroke-width="1.8"/>`;
  const pills = `<g fill="${p.eye}"><rect x="24.3" y="21.4" width="4.6" height="7.2" rx="2.3"/><rect x="35.1" y="21.4" width="4.6" height="7.2" rx="2.3"/></g>`;
  if (kind === "sad")
    return `${pills}<path d="M23.6 20.2h6v2.6l-6 3zM40.4 20.2h-6v2.6l6 3z" fill="${p.visor}"/>`;

  return pills;
}

const ok = "#22A06B";
const bad = "#E5484D";

/** Draw one squad member. `animated` runs the motion; false is a still in a rest pose. */
export function characterSvg(o: CharacterOptions): string {
  const { role, mood, animated: A } = o;
  const p = palette(role, mood);
  const act = mood === "working" ? o.activity : undefined;
  const front = act === "read" || act === "shell" || act === "plan";
  const c = (cls: string) => (A ? ` class="${cls}"` : "");
  const css: string[] = [];

  // Per-agent rhythm, from the seed: negative delays start each loop mid-way.
  const r = (k: number) => (hash(`${o.seed}#${k}`) % 1000) / 1000;
  const bob = 2 + Math.round(r(1) * 8) / 10;
  const bobD = -r2(r(2) * bob);
  const blink = 3.6 + Math.round(r(3) * 14) / 10;
  const blinkD = -r2(r(4) * blink);
  const actD = -r2(r(5) * 3);

  // Body motion by mood: bob while working, breathe while waiting or asleep.
  const still = mood === "done" || mood === "failed";
  const [bobDur, bobAmp]: [number, number] =
    mood === "working"
      ? [bob, o.activity === "edit" ? 0.6 : 1.5]
      : mood === "waiting"
        ? [3.8, 0.9]
        : [4.6, 0.6];
  if (!still) {
    css.push(
      `@keyframes B{50%{transform:translateY(-${bobAmp}px)}}@keyframes H{50%{transform:translateY(-${n(bobAmp * 1.25)}px)}}@keyframes S{50%{transform:scaleX(.88)}}`,
      `.b{animation:B ${bobDur}s ease-in-out ${bobD}s infinite}.h{animation:H ${bobDur}s ease-in-out ${n(bobD + 0.14)}s infinite}.s{transform-origin:32px 57.6px;animation:S ${bobDur}s ease-in-out ${bobD}s infinite}`,
    );
  }

  // Eyes: where they look, and how they move.
  const eyeKind: Eyes =
    mood === "done"
      ? "happy"
      : mood === "failed"
        ? "sad"
        : mood === "stopped"
          ? "closed"
          : "open";
  const look: Pt =
    act === "think"
      ? [1, -1.3]
      : act === "read" || act === "plan"
        ? [0, 1.3]
        : act === "search"
          ? [1.4, 0]
          : act === "edit"
            ? [1.8, 1.4]
            : act === "shell"
              ? [0, 1.6]
              : act === "web"
                ? [-1.6, -1.2]
                : act === "delegate"
                  ? [1.6, -1]
                  : mood === "failed"
                    ? [0, 1.2]
                    : [0, 0];
  if (eyeKind !== "closed")
    css.push(
      `@keyframes K{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.1)}}.k{transform-origin:32px 25px;animation:K ${n(blink)}s ${blinkD}s infinite}`,
    );

  // Arms and hands: where each hand goes for this pose.
  const SL: Pt = [25, 42.5];
  const SR: Pt = [39, 42.5];
  const low = mood === "failed" || mood === "stopped";
  let HL: Pt = low ? [20.6, 50] : [19.2, 48.6];
  let HR: Pt = low ? [43.4, 50] : [44.8, 48.6];

  let ground = ""; // on the floor, outside the bob
  let back = ""; // behind the body
  let over = ""; // in front of body and head
  let top = ""; // badges, bubbles, z's
  let headExtra = "";
  let lookAnim = "";
  let headAnim = "";

  // The role prop: held in the left hand unless the activity needs the hands
  // or the activity is the prop itself (a builder hammering, a scout scanning).
  const prop = roleProp(role, p);
  const usesProp =
    (role === "reviewer" && (act === "search" || act === "read")) ||
    (role === "scout" && act === "search") ||
    (role === "builder" && act === "edit") ||
    (role === "guide" && act === "read");
  let leftArm = "";
  if (front) {
    if (role === "verifier") back += at([19.5, 45], -14, shield(p), 0.9);
  } else if (prop && !usesProp) {
    const [svg, under, deg] = prop;
    leftArm = under
      ? arm(SL, HL, p) + at(HL, deg, svg) + hand(HL, p)
      : arm(SL, HL, p) +
        hand(HL, p) +
        at(role === "guide" ? [HL[0] - 1, HL[1] - 4] : HL, deg, svg);
  } else {
    leftArm = arm(SL, HL, p) + hand(HL, p);
  }
  let rightArm = arm(SR, HR, p) + hand(HR, p);

  if (act === "think") {
    HR = [42.6, 40.6];
    rightArm = arm(SR, HR, p) + hand(HR, p);
    headAnim = "t";
    css.push(
      `@keyframes T{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(4deg)}}.t{transform-origin:32px 40px;animation:T 3.6s ease-in-out ${actD}s infinite}`,
      `@keyframes P{0%,70%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-1.2px)}}.p1,.p2,.p3{animation:P 1.5s ease-in-out infinite}.p2{animation-delay:.25s}.p3{animation-delay:.5s}`,
      `@keyframes F{50%{transform:translateY(-1px)}}.fl{animation:F 3s ease-in-out ${actD}s infinite}`,
    );
    top += `<g${c("fl")}><circle cx="46.6" cy="16" r="1.5" fill="#fff" stroke="${p.o}" stroke-width="1.2"/><circle cx="49.4" cy="13" r="2" fill="#fff" stroke="${p.o}" stroke-width="1.3"/><rect x="43.2" y="1.6" width="19" height="9.6" rx="4.8" fill="#fff" stroke="${p.o}" stroke-width="1.4"/><g fill="${p.o}"><circle${c("p1")} cx="48" cy="6.4" r="1.5"/><circle${c("p2")} cx="52.7" cy="6.4" r="1.5"/><circle${c("p3")} cx="57.4" cy="6.4" r="1.5"/></g></g>`;
  }

  if (act === "read") {
    HL = [21.2, 51.2];
    HR = [42.8, 51.2];
    const lines = `<path d="M24 46.8q3-.9 6 0M24 49.2q3-.9 6 0M34 46.8q3-.9 6 0M34 49.2q3-.9 6 0" fill="none" stroke="${p.ink}" stroke-width="1.1"/>`;
    const flip = A
      ? `<path${c("f")} d="M32 44.6Q37 42.6 42.2 43.6V52Q37 51 32 52.9z" fill="${p.paper}" stroke="${p.o}" stroke-width=".9"/>`
      : "";
    over += `${arm(SL, HL, p)}${arm(SR, HR, p)}<path d="M32 44Q26.5 41.4 20.6 42.6V53.4Q26.5 52.2 32 54.4 37.5 52.2 43.4 53.4V42.6Q37.5 41.4 32 44z" fill="${p.d}" stroke="${p.o}" stroke-width="1.4"/><path d="M32 44.6Q27 42.6 21.8 43.6V52Q27 51 32 52.9 37 51 42.2 52V43.6Q37 42.6 32 44.6z" fill="${p.paper}"/><path d="M32 44.6V52.9" stroke="${p.o}" stroke-width="1"/>${lines}${flip}${hand(HL, p)}`;
    css.push(
      `@keyframes F{0%,62%{transform:scaleX(1);opacity:0}64%{opacity:1}82%{transform:scaleX(-1);opacity:1}84%,100%{transform:scaleX(-1);opacity:0}}.f{transform-origin:32px 0;animation:F 5s ease-in-out ${actD}s infinite}`,
    );
    if (role === "reviewer") {
      const mh: Pt = [46, 53];
      over += `<g${c("m")}>${at(mh, -52, magnifier(p), 0.85)}${hand(mh, p)}</g>`;
      css.push(
        `@keyframes M{0%,100%{transform:translateX(-3px)}50%{transform:translateX(2px)}}.m{animation:M 2.4s ease-in-out ${actD}s infinite}`,
        `@keyframes L{0%,100%{transform:translateX(-1.8px)}50%{transform:translateX(1.4px)}}.l{animation:L 2.4s ease-in-out ${actD}s infinite}`,
      );
    } else {
      over += hand(HR, p);
      css.push(
        `@keyframes L{0%{transform:translateX(-1.6px)}78%{transform:translateX(1.6px)}100%{transform:translateX(-1.6px)}}.l{animation:L 2.2s ease-in-out ${actD}s infinite}`,
      );
    }
    lookAnim = "l";
    leftArm = "";
    rightArm = "";
  }

  if (act === "search") {
    // A scout scans with the spyglass at its eye, the others sweep a magnifier.
    const scout = role === "scout";
    const mh: Pt = scout ? [46.4, 26.6] : [46.6, 45.6];
    if (scout) {
      back += arm(SR, [44, 32], p); // runs up behind the head
      rightArm = `<g${c("m")}>${at([39.6, 24.6], 80, spyglass(p))}${hand(mh, p)}</g>`;
    } else {
      rightArm = `<g${c("m")}>${arm(SR, mh, p)}${at(mh, 24, magnifier(p))}${hand(mh, p)}</g>`;
    }
    const sweep = scout ? 5 : 12;
    css.push(
      `@keyframes M{0%,100%{transform:rotate(-${sweep}deg)}50%{transform:rotate(${sweep - 2}deg)}}.m{transform-origin:${scout ? "38px 25px" : "39px 42.5px"};animation:M 2.8s ease-in-out ${actD}s infinite}`,
      `@keyframes L{0%,100%{transform:translate(-.6px,-.6px)}50%{transform:translate(1.4px,.6px)}}.l{animation:L 2.8s ease-in-out ${actD}s infinite}`,
    );
    lookAnim = "l";
  }

  if (act === "edit") {
    // Strike pose at rest; the loop lifts the tool and brings it down.
    const builderish = role === "builder";
    const eh: Pt = builderish ? [46.8, 45.6] : [46.8, 46.6];
    const tool = builderish
      ? at(eh, 98, hammer(p, 7.5))
      : at(eh, -32, pencil(p));
    // Sparks fly out on both sides of the hammer face, or round the pencil tip.
    const [hit, rays]: [Pt, string] = builderish
      ? [
          [56.4, 51],
          "M52.4 51l-2.6-1.2M53.2 48.6l-2-2M60.4 51l2.2-1.2M59.6 48.6l1.8-2",
        ]
      : [[50.1, 51.6], "M47.8 51.4l-2.4-1M52.4 51.4l2.4-1M51.6 49.2l1.6-2.2"];
    rightArm = `<g${c("a")}>${arm(SR, eh, p)}${tool}${hand(eh, p)}</g>`;
    ground += builderish
      ? `<rect x="50" y="51.6" width="12" height="5.4" rx="1.2" fill="${p.steel}" stroke="${p.steelO}" stroke-width="1.3"/>`
      : `<path d="M44.6 51.6h12.6l2.6 4.4H47.2z" fill="${p.paper}" stroke="${p.o}" stroke-width="1.2"/>`;
    top += `<path${c("x")} d="${rays}" fill="none" stroke="#F5A623" stroke-width="1.6"/>`;
    css.push(
      `@keyframes A{0%,100%{transform:rotate(-50deg)}36%{transform:rotate(-56deg);animation-timing-function:cubic-bezier(.6,0,1,.6)}56%{transform:rotate(0)}68%{transform:rotate(-6deg)}}.a{transform-origin:39px 42.5px;animation:A .8s ease-in-out infinite}`,
      `@keyframes X{0%,54%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1)}84%,100%{opacity:0;transform:scale(1.35)}}.x{transform-origin:${n(hit[0])}px ${n(hit[1])}px;animation:X .8s ease-out infinite}`,
    );
  }

  if (act === "shell") {
    HL = [26, 52.8];
    HR = [38, 52.8];
    over += `${arm(SL, [24, 50], p)}${arm(SR, [40, 50], p)}<rect x="20.4" y="39.4" width="23.2" height="13.4" rx="2.6" fill="${p.visor}" stroke="${p.o}" stroke-width="1.5"/><path d="M24.2 43.2l2.6 2.2-2.6 2.2" fill="none" stroke="#5EE89A" stroke-width="1.6"/><rect${c("tx")} x="28.6" y="44.6" width="10.6" height="1.7" rx=".85" fill="#5EE89A" fill-opacity=".5"/><rect${c("cu")} x="24" y="49" width="4.2" height="1.8" rx=".6" fill="#5EE89A"/><g${c("q1")}>${hand(HL, p)}</g><g${c("q2")}>${hand(HR, p)}</g>`;
    css.push(
      `@keyframes Q{0%,100%{transform:translateY(0)}40%{transform:translateY(-2.2px)}}.q1{animation:Q .46s ease-in-out infinite}.q2{animation:Q .46s ease-in-out -.23s infinite}`,
      `@keyframes C{0%,49%{opacity:1}50%,100%{opacity:0}}.cu{animation:C 1s infinite}`,
      `@keyframes Y{0%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}}.tx{transform-origin:28.6px 0;animation:Y 2.6s steps(7) ${actD}s infinite}`,
    );
    leftArm = "";
    rightArm = "";
  }

  if (act === "web") {
    // Radio waves rolling out of the antenna, one ring after another.
    const arc = (rad: number, i: number) => {
      const a = (deg: number) =>
        `${n(10.2 + rad * Math.cos((deg * Math.PI) / 180))} ${n(12.6 - rad * Math.sin((deg * Math.PI) / 180))}`;
      return `<path${c(`w${i}`)} d="M${a(172)}A${rad} ${rad} 0 0 1 ${a(98)}" fill="none" stroke="${p.b}" stroke-width="1.8"/>`;
    };
    headExtra += `${arc(4.4, 1)}${arc(7, 2)}${arc(9.6, 3)}`;
    css.push(
      `@keyframes W{0%,100%{opacity:.15}30%{opacity:1}}.w1,.w2,.w3{animation:W 1.5s ease-in-out infinite}.w2{animation-delay:.25s}.w3{animation-delay:.5s}`,
    );
    if (role !== "scout") headExtra += antenna(p, p.l);
  }

  if (act === "delegate") {
    HR = [47.2, 35.6];
    const flagA = "M0 0C3 -1.6 6 1.6 10 0V7C6 8.6 3 5.4 0 7z";
    rightArm = `<g${c("v")}>${arm(SR, HR, p)}<path d="M46.4 41 52.6 12.2" stroke="${p.woodO}" stroke-width="1.6"/><g transform="translate(52.4 12.6)"><path${c("fl")} d="${flagA}" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.3"/></g><circle cx="52.7" cy="11.6" r="1.4" fill="${p.gold}" stroke="${p.goldO}" stroke-width="1"/>${hand(HR, p)}</g>`;
    // The flag ripples with CSS, so the reduced-motion rule stills it too.
    css.push(
      `@keyframes V{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(5deg)}}.v{transform-origin:39px 42.5px;animation:V 2.2s ease-in-out ${actD}s infinite}@keyframes FL{0%,100%{transform:skewY(-9deg) scaleX(1)}50%{transform:skewY(9deg) scaleX(.88)}}.fl{transform-box:fill-box;transform-origin:0 50%;animation:FL 1.1s ease-in-out infinite}`,
    );
  }

  if (act === "plan") {
    HL = [23, 49.6];
    HR = [41, 49.6];
    const row = (y: number, i: number) =>
      `<path${c(`c${i}`)} d="M25.8 ${n(y)}l1.3 1.3 2.4-2.6" fill="none" stroke="${ok}" stroke-width="1.6"/><path d="M31.4 ${n(y)}h6" stroke="${p.ink}" stroke-width="1.4"/>`;
    over += `${arm(SL, HL, p)}${arm(SR, HR, p)}<rect x="22.6" y="38.8" width="18.8" height="17" rx="2.4" fill="${p.wood}" stroke="${p.woodO}" stroke-width="1.4"/><rect x="24.4" y="41.2" width="15.2" height="12.8" rx="1" fill="${p.paper}"/><rect x="28.4" y="37.4" width="7.2" height="3.6" rx="1.2" fill="${p.steel}" stroke="${p.steelO}" stroke-width="1.1"/>${row(44.6, 1)}${row(48.2, 2)}${row(51.8, 3)}${hand(HL, p)}${hand(HR, p)}`;
    const tick = (i: number, from: number) =>
      `@keyframes C${i}{0%,${from}%{opacity:0;transform:scale(.3)}${from + 7}%,90%{opacity:1;transform:scale(1)}97%,100%{opacity:0}}.c${i}{transform-box:fill-box;transform-origin:50% 50%;animation:C${i} 4.2s ease-out ${actD}s infinite}`;
    css.push(
      tick(1, 10),
      tick(2, 34),
      tick(3, 58),
      `@keyframes L{0%,30%{transform:translateY(-.6px)}38%,54%{transform:translateY(.4px)}62%,100%{transform:translateY(1.2px)}}.l{animation:L 4.2s ease-in-out ${actD}s infinite}`,
    );
    lookAnim = "l";
    leftArm = "";
    rightArm = "";
  }

  // Moods other than work.
  let hop = "";
  if (mood === "waiting") {
    css.push(
      `@keyframes G{0%,34%,100%{transform:translate(0,0)}40%,50%{transform:translate(-1.8px,0)}56%,66%{transform:translate(1.8px,-.4px)}72%{transform:translate(0,0)}}.l{animation:G 8s ease-in-out ${n(actD * 2.6)}s infinite}`,
    );
    lookAnim = "l";
  }
  if (mood === "done") {
    const d = r2(r(6) * 0.3);
    top += `<g${c("o")}><circle cx="53" cy="11" r="6.6" fill="${ok}" stroke="#fff" stroke-width="1.6"/><path d="M50 11.2l2 2 3.9-4.1" fill="none" stroke="#fff" stroke-width="2.2"/></g>`;
    hop = "j";
    css.push(
      `@keyframes J{0%,40%,80%,100%{transform:translateY(0)}20%{transform:translateY(-3.6px)}60%{transform:translateY(-1.8px)}}.j{animation:J 1.1s ease-in-out ${d}s 1 both}`,
      `@keyframes Js{0%,40%,80%,100%{transform:scaleX(1)}20%{transform:scaleX(.8)}60%{transform:scaleX(.9)}}.s{transform-origin:32px 57.6px;animation:Js 1.1s ease-in-out ${d}s 1 both}`,
      `@keyframes O{0%{transform:scale(0)}100%{transform:scale(1)}}.o{transform-origin:53px 11px;animation:O .5s cubic-bezier(.3,1.7,.6,1) ${n(d + 0.7)}s both}`,
    );
  }
  if (mood === "failed") {
    top += `<g${c("o")}><circle cx="53" cy="11" r="6.6" fill="${bad}" stroke="#fff" stroke-width="1.6"/><path d="M50.6 8.6l4.8 4.8M55.4 8.6l-4.8 4.8" fill="none" stroke="#fff" stroke-width="2.2"/></g>`;
    hop = "z";
    css.push(
      `@keyframes Z{20%{transform:translateX(-1.6px)}40%{transform:translateX(1.4px)}60%{transform:translateX(-.9px)}80%{transform:translateX(.5px)}}.z{animation:Z .6s ease-in-out .1s 1 both}`,
      `@keyframes D{0%{transform:none}100%{transform:rotate(-7deg) translateY(1.6px)}}.dr{transform-origin:32px 40px;animation:D .9s ease-in-out .5s both}`,
      `@keyframes O{0%{transform:scale(0)}100%{transform:scale(1)}}.o{transform-origin:53px 11px;animation:O .45s cubic-bezier(.3,1.7,.6,1) .2s both}`,
    );
  }
  if (mood === "stopped") {
    const z = (x: number, y: number, s: number, i: number) =>
      `<path${c(`z${i}`)} d="M${x} ${y}h${s}l-${s} ${n(s * 1.1)}h${s}" fill="none" stroke="#8A8F98" stroke-width="1.8"/>`;
    top += `${z(45, 9.5, 5, 1)}${z(53, 2.6, 3.6, 2)}`;
    css.push(
      `@keyframes Zz{0%{opacity:0;transform:translate(-2px,4px) scale(.6)}30%,60%{opacity:1}100%{opacity:0;transform:translate(2px,-4px) scale(1)}}.z1,.z2{transform-box:fill-box;transform-origin:50% 50%;animation:Zz 3.6s ease-in-out ${actD}s infinite}.z2{animation-delay:${n(actD - 1.8)}s}`,
    );
  }

  // The head: helmet, ears, visor, eyes, headgear.
  const eyesSvg = `<g${c(lookAnim)}><g transform="translate(${pt(look)})"><g${c("k")}>${eyes(eyeKind, p)}</g></g></g>`;
  const head =
    `<rect x="14" y="9" width="36" height="31" rx="13.5" fill="url(#g)" stroke="${p.o}" stroke-width="1.7"/>` +
    `<g fill="${p.d}" stroke="${p.o}" stroke-width="1.5"><rect x="10.6" y="19.6" width="5" height="11" rx="2.5"/><rect x="48.4" y="19.6" width="5" height="11" rx="2.5"/></g>` +
    `<path d="M19.4 17.2q2.6-5 8.4-6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>` +
    `<rect x="18.5" y="17" width="27" height="16" rx="8" fill="${p.visor}" stroke="${p.o}" stroke-width="1.4"/>` +
    `<path d="M22.6 19.6h5" stroke="#fff" stroke-opacity=".22" stroke-width="1.4"/>` +
    eyesSvg +
    headgear(role, p) +
    (role === "scout" ? antenna(p, p.acc) : "") +
    headExtra;
  const headPose =
    mood === "failed"
      ? `<g${c("dr")} transform="rotate(-7 32 40) translate(0 1.6)">${head}</g>`
      : headAnim
        ? `<g${c(headAnim)}>${head}</g>`
        : head;

  // The commander's cape hangs behind the feet and sways a little.
  const cape =
    role === "commander"
      ? `<g${c("b")}><g${c("cp")}><path d="M24 38.4C21.6 44 18 50 15.6 54.8Q19.6 53.4 23.8 55.4 27.8 53.8 32 55.4 36.2 53.8 40.2 55.4 44.4 53.4 48.4 54.8C46 50 42.4 44 40 38.4z" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.4"/></g></g>`
      : "";
  if (cape && !still)
    css.push(
      `@keyframes Cp{50%{transform:skewX(-4deg)}}.cp{transform-origin:32px 38px;animation:Cp 3.2s ease-in-out ${actD}s infinite}`,
    );
  const scarf =
    role === "scout"
      ? `<rect x="21.6" y="37.4" width="20.8" height="5" rx="2.5" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.3"/><path d="M37.6 41.4l3.4 6.6 2.6-1.6-2-5z" fill="${p.acc}" stroke="${p.accO}" stroke-width="1.2"/>`
      : "";

  const body =
    `<g${c("b")}>${back}<rect x="23" y="36.6" width="18" height="16.4" rx="7" fill="url(#g)" stroke="${p.o}" stroke-width="1.6"/><rect x="27.4" y="41.6" width="9.2" height="7" rx="3.5" fill="${p.l}"/><circle cx="32" cy="45.1" r="1.6" fill="${p.b}"/></g>` +
    `<g${c("h")}>${headPose}</g>` +
    `<g${c("b")}>${scarf}${leftArm}${rightArm}${over}</g>`;
  const feet = `<g fill="${p.d}" stroke="${p.o}" stroke-width="1.5"><rect x="23.6" y="50.6" width="7.8" height="6.6" rx="3"/><rect x="32.6" y="50.6" width="7.8" height="6.6" rx="3"/></g>`;
  const figure = hop
    ? `<g${c(hop)}>${cape}${feet}${body}</g>`
    : `${cape}${feet}${body}`;

  const style = A
    ? `<style>${css.join("")}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" stroke-linecap="round" stroke-linejoin="round">${style}<defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${p.hi}"/><stop offset="1" stop-color="${p.lo}"/></linearGradient></defs><ellipse${c("s")} cx="32" cy="57.6" rx="13" ry="2.3" fill="#000" fill-opacity=".16"/>${ground}${figure}${top}</svg>`;

  return A ? framed(svg) : svg;
}
