/** Pure helpers: the per-session badge and the text that goes into titles. */

const BADGES: { emoji: string; ascii: string; ansi: number }[] = [
  { emoji: "🟥", ascii: "[R]", ansi: 196 },
  { emoji: "🟧", ascii: "[O]", ansi: 208 },
  { emoji: "🟨", ascii: "[Y]", ansi: 220 },
  { emoji: "🟩", ascii: "[G]", ansi: 41 },
  { emoji: "🟦", ascii: "[B]", ansi: 33 },
  { emoji: "🟪", ascii: "[P]", ansi: 135 },
  { emoji: "🟫", ascii: "[N]", ansi: 137 },
  { emoji: "⬜", ascii: "[W]", ansi: 252 },
];

/** FNV-1a, so the same session id always gets the same badge. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function badge(sessionId: string): { emoji: string; ascii: string; ansi: number } {
  return BADGES[hash(sessionId) % BADGES.length]!;
}

/** Control characters (C0, DEL, C1) would break the escape sequence or the status line; turn them into spaces. */
export function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Cut to `max` characters (code points, so emoji and Hangul are never split), with an ellipsis. */
export function shorten(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
}

export const DEFAULT_MIN_CHARS = 6;

/**
 * The part of a prompt worth showing: its first non-empty line, cleaned. Null when the prompt
 * should not replace the current label: slash commands and short replies such as "ok" or "계속".
 */
export function labelFrom(prompt: string, minChars = DEFAULT_MIN_CHARS): string | null {
  const first = prompt.split(/\r?\n/).map(clean).find((l) => l.length > 0) ?? "";
  if (!first || first.startsWith("/")) return null;
  if (Array.from(clean(prompt)).length < minChars) return null;
  return first;
}
