import type { Deps } from "../deps.ts";
import { badge, clean, shorten } from "../label.ts";
import { loadState, validSessionId } from "../state.ts";

export const STATUS_CHARS = 60;

/** Our own line: badge, session name (from /rename or Claude Code's title), and the latest label. */
export function ourLine(stdin: string, d: Deps, color: boolean): string {
  let input: Record<string, unknown> = {};
  try {
    input = JSON.parse(stdin) ?? {};
  } catch {
    // no input: show just the badge
  }
  const id = validSessionId(input.session_id) ? input.session_id : "";
  const { emoji, ascii, ansi } = badge(id);
  const tag = d.env.CLAUDE_TAB_LABEL_ASCII === "1" ? ascii : emoji;
  const paint = (s: string, style: string) => (color ? `\x1b[${style}m${s}\x1b[0m` : s);

  const parts: string[] = [];
  const name = typeof input.session_name === "string" ? clean(input.session_name) : "";
  if (name) parts.push(paint(shorten(name, 30), `1;38;5;${ansi}`));
  const label = id ? loadState(d, id)?.label : undefined;
  if (label) parts.push(paint(`"${shorten(clean(label), STATUS_CHARS)}"`, `38;5;${ansi}`));
  return parts.length ? `${tag} ${parts.join(paint(" · ", "2"))}` : tag;
}

// A bare "bash" on Windows can be WSL's System32 launcher, so only trust it under Git Bash itself.
function gitBash(d: Deps): string | null {
  if (d.env.CLAUDE_CODE_GIT_BASH_PATH) return d.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (d.env.MSYSTEM) return "bash";
  const pf = d.env.ProgramFiles;
  const candidate = pf ? `${pf}\\Git\\bin\\bash.exe` : null;
  return candidate && d.mtime(candidate) !== null ? candidate : null;
}

/** Run the status line we wrapped at install time, with the same stdin. */
function runWrapped(after: string, stdin: string, d: Deps): string {
  const run = (cmd: string, args: string[], verbatim?: boolean) => {
    try {
      return d.exec(cmd, args, { input: stdin, timeoutMs: 3000, verbatim });
    } catch {
      return { code: null, stdout: "", stderr: "" };
    }
  };
  let r: { code: number | null; stdout: string; stderr: string };
  if (d.platform === "win32") {
    // Claude Code runs its own commands through Git Bash on Windows, so the wrapped
    // command was written for bash. Fall back to cmd.exe only if bash cannot start.
    const bash = gitBash(d);
    r = bash ? run(bash, ["-c", after]) : { code: null, stdout: "", stderr: "" };
    if (r.code === null && !r.stdout && !r.stderr) {
      r = run("cmd.exe", ["/d", "/s", "/c", `"${after}"`], true);
    }
  } else {
    r = run("/bin/sh", ["-c", after]);
  }
  return r.stdout.replace(/\s+$/, "");
}

export function runStatusline(stdin: string, argv: string[], d: Deps): string {
  const color = !d.env.NO_COLOR;
  const i = argv.indexOf("--after");
  const after = i >= 0 ? argv[i + 1] : undefined;

  let ours: string;
  try {
    ours = ourLine(stdin, d, color);
  } catch {
    ours = "";
  }
  const theirs = after ? runWrapped(after, stdin, d) : "";
  return [ours, theirs].filter(Boolean).join("\n");
}
