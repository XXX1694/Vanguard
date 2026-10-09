// Icons for Vanguard: Lucide outlines (ISC licence) as SVG for surfaces that draw Svg,
// a single glyph for the terminal. No engine calls, so tests can reach them directly.

export type IconName =
  | "swords"
  | "crown"
  | "bot"
  | "users"
  | "terminal"
  | "file"
  | "pencil"
  | "search"
  | "globe"
  | "plug"
  | "wrench"
  | "list"
  | "clock"
  | "activity"
  | "layers"
  | "gauge"
  | "calendar"
  | "coins"
  | "shield"
  | "check"
  | "x"
  | "stop"
  | "trophy"
  | "save"
  | "copy"
  | "sparkles"
  | "flame"
  | "feather"
  | "zap"
  | "puzzle"
  | "medal"
  | "lock";

const PATHS: Record<IconName, string> = {
  swords:
    '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  crown:
    '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  terminal:
    '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  list: '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>',
  clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  activity:
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  layers:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  coins:
    '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  stop: '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  trophy:
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  sparkles:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  feather:
    '<path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>',
  puzzle:
    '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',
  medal:
    '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
};

/** One glyph per icon, for the terminal, which draws no Svg. */
export const GLYPHS: Record<IconName, string> = {
  swords: "⚔",
  crown: "♛",
  bot: "◆",
  users: "◈",
  terminal: "❯",
  file: "▤",
  pencil: "✎",
  search: "⌕",
  globe: "◍",
  plug: "⌁",
  wrench: "⚙",
  list: "☰",
  clock: "◷",
  activity: "∿",
  layers: "≋",
  gauge: "◔",
  calendar: "▦",
  coins: "$",
  shield: "⛨",
  check: "✔",
  x: "✖",
  stop: "■",
  trophy: "★",
  save: "⤓",
  copy: "⧉",
  sparkles: "✦",
  flame: "♨",
  feather: "➶",
  zap: "ϟ",
  puzzle: "✚",
  medal: "✪",
  lock: "⊘",
};

/** Mid-tone hexes that read on both light and dark backgrounds, keyed by theme key. */
export const HEX: Record<string, string> = {
  claude: "#D97757",
  merged: "#8B5CF6",
  suggestion: "#3B82F6",
  success: "#22A06B",
  warning: "#E0A100",
  error: "#E5484D",
  text: "#8A8F98",
  subtle: "#8A8F98",
  inactive: "#8A8F98",
};

/**
 * An animated SVG is drawn in a frame of its own; a frame whose colour scheme
 * differs from the page's gets an opaque (white or black) backdrop. Following
 * the person's scheme keeps the frame see-through on both themes.
 */
export function framed(svg: string): string {
  return svg.replace(
    /^(<svg[^>]*>)/,
    "$1<style>:root{color-scheme:light dark}</style>",
  );
}

export function hexOf(color: string): string {
  return HEX[color] ?? (color.startsWith("#") ? color : "#8A8F98");
}

export function iconSvg(name: IconName, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${hexOf(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}

/** The Vanguard mark. */
/**
 * The Vanguard mark: two swords crossed over the ring of an arena floor, a
 * spark where the blades meet, on a Claude-orange to violet tile.
 * `idle` lets the spark breathe; `live` adds a light sweeping the tile and a
 * ring that ripples, for when agents are at work.
 */
export function logoSvg(mode: "static" | "idle" | "live" = "static"): string {
  const anim = mode !== "static";
  const sword = (flip: boolean) => {
    const t = flip ? ' transform="matrix(-1 0 0 1 32 0)"' : "";
    return `<g${t}><path d="M9.9 20.5 20.7 9.7l3-1.3-1.3 3L11.6 22.2z" fill="#fff"/><path d="M10.75 21.35 22.9 9.2" stroke="#E9DDFF" stroke-width=".6"/><path d="M7.9 19.2l4.9 4.9" stroke="#FFC978" stroke-width="2.6" stroke-linecap="round"/><path d="M10.1 22.1l-2.6 2.6" stroke="#F3B25F" stroke-width="2.3" stroke-linecap="round"/><circle cx="6.8" cy="25.4" r="1.6" fill="#FFC978"/></g>`;
  };
  const sparkAnim = anim
    ? `<animate attributeName="opacity" values="1;.55;1" dur="${mode === "live" ? "1.2s" : "3.2s"}" repeatCount="indefinite"/><animateTransform attributeName="transform" type="rotate" values="0 16 5.6;${mode === "live" ? 90 : 20} 16 5.6;0 16 5.6" dur="${mode === "live" ? "2.4s" : "6s"}" repeatCount="indefinite"/>`
    : "";
  const ringAnim =
    mode === "live"
      ? `<ellipse cx="16" cy="25.6" rx="10.5" ry="2.6" fill="none" stroke="#fff" stroke-width=".8"><animate attributeName="rx" values="10.5;13.5" dur="1.8s" repeatCount="indefinite"/><animate attributeName="ry" values="2.6;3.6" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="1.8s" repeatCount="indefinite"/></ellipse>`
      : "";
  const sweep =
    mode === "live"
      ? `<rect x="-16" y="-8" width="10" height="48" fill="url(#lgS)" transform="rotate(20)"><animate attributeName="x" values="-24;48" dur="2.6s" repeatCount="indefinite"/></rect>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="lgT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8F57"/><stop offset=".5" stop-color="#D9467A"/><stop offset="1" stop-color="#5636D6"/></linearGradient><radialGradient id="lgH" cx=".28" cy=".18" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="lgF" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1E0B45" stop-opacity=".7"/><stop offset="1" stop-color="#2A1450" stop-opacity="0"/></radialGradient><linearGradient id="lgS" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="lgC"><rect width="32" height="32" rx="9"/></clipPath></defs><g clip-path="url(#lgC)"><rect width="32" height="32" fill="url(#lgT)"/><rect width="32" height="32" fill="url(#lgH)"/><ellipse cx="16" cy="26.2" rx="12.5" ry="4.2" fill="url(#lgF)"/>${sweep}</g><rect x=".5" y=".5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" stroke-opacity=".18"/><ellipse cx="16" cy="25.6" rx="10.5" ry="2.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/>${ringAnim}${sword(false)}${sword(true)}<g><path d="M16 1.9l1.15 2.55 2.55 1.15-2.55 1.15L16 9.3l-1.15-2.55L12.3 5.6l2.55-1.15z" fill="#FFE08F"/>${sparkAnim}</g></svg>`;
}

export const LOGO_SVG = logoSvg("static");

/** Which icon a tool call is drawn with. */
export function toolIcon(tool: string): IconName {
  if (tool === "Bash" || tool === "BashOutput" || tool === "KillShell")
    return "terminal";
  if (tool === "Read") return "file";
  if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit")
    return "pencil";
  if (tool === "Grep" || tool === "Glob" || tool === "LSP") return "search";
  if (tool === "WebFetch" || tool === "WebSearch") return "globe";
  if (tool === "Agent" || tool === "Task") return "bot";
  if (tool === "TodoWrite") return "list";
  if (tool === "Skill") return "zap";
  if (tool.startsWith("mcp__")) return "plug";

  return "wrench";
}

/** A ring whose arc, fading along its length, turns: drawn interactive, so its SMIL runs. */
export function loaderSvg(color: string): string {
  const c = hexOf(color);

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2.8" stroke-linecap="round"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><circle cx="12" cy="12" r="9" stroke="${c}" opacity=".16"/><g><path d="M12 3a9 9 0 0 1 9 9" stroke="${c}"/><path d="M21 12a9 9 0 0 1-9 9" stroke="url(#a)"/><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></g></svg>`,
  );
}

/** A dot with a ring that swells and fades, for "live" and "attention". */
export function pulseSvg(color: string): string {
  const c = hexOf(color);

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="${c}"><animate attributeName="r" values="5;11;5" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".45;0;.45" dur="1.6s" repeatCount="indefinite"/></circle><circle cx="12" cy="12" r="5" fill="${c}"/></svg>`,
  );
}

/** Three bars bouncing out of step, an equaliser for work in progress. */
export function equalizerSvg(color: string): string {
  const c = hexOf(color);
  const bar = (x: number, delay: string) =>
    `<rect x="${x}" y="6" width="4" height="12" rx="2" fill="${c}"><animate attributeName="height" values="4;16;4" dur="0.9s" begin="${delay}" repeatCount="indefinite"/><animate attributeName="y" values="10;4;10" dur="0.9s" begin="${delay}" repeatCount="indefinite"/></rect>`;

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${bar(3, "0s")}${bar(10, "-0.3s")}${bar(17, "-0.6s")}</svg>`,
  );
}

/** The logo with a light sweeping across the tile, while agents work. */
export const LOGO_LIVE_SVG = framed(logoSvg("live"));

/** A solid rounded progress bar, `percent` of it filled. */
export function barSvg(percent: number, color: string): string {
  const p = Math.max(0, Math.min(100, percent));
  const fill =
    p > 0
      ? `<rect width="${Math.max(4, p * 2)}" height="8" rx="4" fill="${hexOf(color)}"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 8" preserveAspectRatio="none"><rect width="200" height="8" rx="4" fill="#8A8F98" fill-opacity=".22"/>${fill}</svg>`;
}

/** A line chart of `values` (0–100) with a soft area under it. */
export function sparkSvg(values: number[], color: string): string {
  const c = hexOf(color);
  const n = Math.max(2, values.length);
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 22 - (Math.max(0, Math.min(100, v)) / 100) * 20;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 24" preserveAspectRatio="none"><polygon points="0,24 ${pts.join(" ")} 100,24" fill="${c}" fill-opacity=".18"/><polyline points="${pts.join(" ")}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/** One bar split into coloured parts, `parts` in percent of the whole. */
export function stackedSvg(
  parts: { percent: number; color: string }[],
): string {
  let x = 0;
  const rects = parts
    .filter((p) => p.percent > 0)
    .map((p) => {
      const w = Math.max(0.6, p.percent * 2);
      const r = `<rect x="${x.toFixed(2)}" width="${w.toFixed(2)}" height="10" fill="${hexOf(p.color)}"/>`;
      x += w;
      return r;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 10" preserveAspectRatio="none"><clipPath id="c"><rect width="200" height="10" rx="5"/></clipPath><g clip-path="url(#c)"><rect width="200" height="10" fill="#8A8F98" fill-opacity=".22"/>${rects}</g></svg>`;
}

/** The logo at rest: a soft glow that breathes behind the tile. */
export const LOGO_IDLE_SVG = framed(logoSvg("idle"));

/** A solid bar with a gloss that sweeps along the filled part. */
export function shineBarSvg(percent: number, color: string): string {
  const p = Math.max(0, Math.min(100, percent));
  const w = Math.max(4, p * 2);

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 8" preserveAspectRatio="none"><defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="f"><rect width="${w}" height="8" rx="4"/></clipPath></defs><rect width="200" height="8" rx="4" fill="#8A8F98" fill-opacity=".22"/><rect width="${w}" height="8" rx="4" fill="${hexOf(color)}"/><g clip-path="url(#f)"><rect x="-40" width="40" height="8" fill="url(#s)"><animate attributeName="x" values="-40;${w + 40}" dur="2.8s" repeatCount="indefinite"/></rect></g></svg>`,
  );
}

/** Sparks that twinkle and drift around a star, for an unlock or a new level. */
export function burstSvg(color: string): string {
  const c = hexOf(color);
  const spark = (x: number, y: number, r: number, delay: string) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"><animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="${delay}" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.6s" begin="${delay}" repeatCount="indefinite"/></circle>`;
  const star = `<path d="M24 10l3.2 8.6L36 22l-8.8 3.4L24 34l-3.2-8.6L12 22l8.8-3.4z" fill="${c}"><animateTransform attributeName="transform" type="rotate" values="0 24 22;12 24 22;0 24 22" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".85;1;.85" dur="1.2s" repeatCount="indefinite"/></path>`;

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44">${star}${spark(8, 10, 2, "0s")}${spark(40, 8, 1.6, "-.4s")}${spark(42, 34, 2, "-.8s")}${spark(6, 34, 1.5, "-1.2s")}${spark(24, 4, 1.4, "-.6s")}${spark(24, 40, 1.4, "-1s")}</svg>`,
  );
}

/** A check that pops gently, for an agent that has just finished. */
export function popCheckSvg(color: string): string {
  const c = hexOf(color);

  return framed(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="${c}" fill-opacity=".14"><animate attributeName="r" values="8;10.5;8" dur="1.4s" repeatCount="indefinite"/></circle><path d="m8 12 3 3 5-6"/></svg>`,
  );
}
