cxresume
========
[png](https://github.com/lingtaolf/cxresume/blob/master/ss/sc.png)

Resume Codex sessions from `~/.codex/sessions/{year}/{month}/{day}/*.jsonl` with an interactive picker. It builds a compressed “resume primer” and helps you launch Codex so you can continue where you left off.

Install

- Node.js 18+
- npm install -g cxresume (from this repo once published)

Usage

- cxresume — opens a split-pane TUI: the top pane lists sessions; the bottom pane previews recent dialog. Press Enter to start Codex with a compressed full-history primer passed inline as an argument (auto‑fallback to pty/clipboard if too long).

 Options

- --list — list recent session files
- --open <file> — open a specific session jsonl (relative to root or absolute)
- --root <dir> — override sessions root (default: ~/.codex/sessions)
- --codex <cmd> — override codex launch command (default: codex)
- --print — only print the primer and exit
- --no-launch — copy primer to clipboard but do not launch Codex
- --search <text> — content search across all sessions, then pick from matches
- --legacy-ui — use the legacy single-prompt selector (no split view)
- --preview / --no-preview — enable/disable preview before launching
- -y, --yes — skip interactive confirms (still shows a brief preview)

TUI (ccresume-like) interactions

- Navigation: ↑/↓ to move selection; ←/→ to change pages
- Preview scroll: j/k to scroll the preview pane
- Resume: Enter to resume selected session (builds primer and launches Codex)
- New session: n to start a new Codex session in the selected session’s directory (no primer injection)
- Edit options: - to edit extra command-line options appended to your `codex` command
- Copy ID: c to copy the session identifier (relative path) to clipboard
- Full view: f to toggle full preview view
- Quit: q or Esc to exit

Filters

- Dot filter: `cxresume .` shows only sessions whose recorded working directory matches your current directory (best-effort; depends on logs containing cwd)
- Hide in preview: `--hide [tool|thinking|user|assistant|system]` (default when provided without args: `tool thinking`)

Config

- Place a JSON config at `~/.config/cxresume/config.json`:
  {
    "logsRoot": "/home/me/.codex/sessions",
    "codexCmd": "codex",
    "preview": false,
    "inject": "inline",
    "injectDelayMs": 1000,
    "injectWakeEnter": false,
    "injectWakeDelayMs": 250,
    "inlineArgMaxChars": 120000,
    "primerAllPerMessageMax": 400,
    "primerAllTargetChars": 10000
  }

How it works

- Discovers `*.jsonl` logs under the sessions root.
- Parses each line; collects user/assistant/system messages.
- Builds a primer text (compressed full history by default):
  - A short instruction block asking Codex to ingest silently.
  - Session metadata (range, counts).
  - All messages included in chronological order, each message content truncated to fit an overall budget (tunable via config).

Notes

- Default injection is inline parameter: cxresume passes the primer as a single argument to your `codexCmd`. If it exceeds a safe size, cxresume falls back to pty/clipboard automatically.
 

Examples

- Pick interactively with preview, auto-inject primer:
  cxresume

- Search content (e.g., "bgPhoto") then pick from matches:
  cxresume --search bgPhoto

- Open a specific file and start immediately:
  cxresume --open 2025/09/24/sample.jsonl -y
cxresume
========

Resume Codex sessions from `~/.codex/sessions/{year}/{month}/{day}/*.jsonl` with an interactive TUI. cxresume builds a compressed full‑history “primer” and launches Codex so you can continue right where you left off.

Install

- Node.js 18+
- npm install -g from this repo: `npm i -g .`

Quick Start

- `cxresume` — opens a split‑pane TUI. The top pane lists sessions; the bottom pane previews recent dialog. Press Enter to start Codex with a compressed full‑history primer passed inline as a single argument. If the argument is too long, cxresume automatically falls back to pty/clipboard injection.

TUI Keys

- Navigation: `↑/↓` move selection; `←/→` change pages
- Preview: `j/k` scroll the bottom preview
- Start: `Enter` resume the selected session
- New session: `n` start a new Codex session in the same directory
- Edit options: `-` append extra arguments to your `codexCmd` for this launch
- Copy ID: `c` copy the session identifier (from the file’s meta) to clipboard
- Full view: `f` toggle full preview
- Quit: `q` or `Esc`

Options

- `--list` — list recent session files
- `--open <file>` — open a specific session jsonl (relative to root or absolute)
- `--root <dir>` — override sessions root (default: `~/.codex/sessions`)
- `--codex <cmd>` — override Codex launch command (default: `codex`)
- `--search <text>` — content search across all sessions, then pick from matches
- `--legacy-ui` — legacy selector without the split preview
- `--preview` / `--no-preview` — enable/disable a short preview before launching
- `--print` — print the computed primer and exit
- `--no-launch` — do not launch Codex (useful with `--print`)
- `-y`, `--yes` — skip interactive pauses
- `-h`, `--help` — show help
- `-v`, `--version` — show version

Filters

- Dot filter: `cxresume .` shows only sessions whose recorded working directory matches your current directory (best‑effort; depends on logs containing `cwd`).

Config

- Place JSON at `~/.config/cxresume/config.json`:

```
{
  "logsRoot": "/home/me/.codex/sessions",
  "codexCmd": "codex",
  "preview": false,
  "inject": "inline",
  "injectDelayMs": 1000,
  "injectWakeEnter": false,
  "injectWakeDelayMs": 250,
  "inlineArgMaxChars": 120000,
  "primerAllPerMessageMax": 400,
  "primerAllTargetChars": 10000
}
```

- Notes on `codexCmd`:
  - By default, cxresume appends the primer as the last argument to `codexCmd`.
  - Optionally, you can place `{contextInline}` in `codexCmd` to control where the primer is injected, e.g. `"codex chat --system {contextInline}"`.

How It Works

- Discovers `*.jsonl` logs under the sessions root.
- Parses each file; expects the first line to be `session_meta`. Messages are derived from `event_msg` of type `user_message` and `agent_message`.
- Builds a compressed full‑history primer:
  - A short system block instructing Codex to silently ingest.
  - Session metadata (ID, time range, counts).
  - All dialog messages included in chronological order; each message is truncated to fit a total size budget.
- Launches Codex with the primer inline as a single argument. If too long, cxresume auto‑falls back to pty/clipboard injection.

Examples

- Pick interactively and start:
  - `cxresume`

- Filter to current directory:
  - `cxresume .`

- Search content first, then pick:
  - `cxresume --search build script`

- Open a specific file and start immediately:
  - `cxresume --open 2025/09/24/session.jsonl -y`

License

MIT
