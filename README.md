cxresume
========
[![npm version](https://img.shields.io/npm/v/cxresume.svg?logo=npm)](https://www.npmjs.com/package/cxresume)

[中文说明](./README-zh.md)

Resume Codex sessions from `~/.codex/sessions/{year}/{month}/{day}/*.jsonl` with an interactive TUI. cxresume builds a compressed full‑history “primer” and launches Codex so you can continue right where you left off.

Install

- Node.js 18+
- Global install (recommended): `npm i -g cxresume`
- Verify: `cxresume --help`
- Upgrade: `npm i -g cxresume@latest`
- Uninstall: `npm uninstall -g cxresume`

Tip: one‑off run without installing: `npx cxresume --help`

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
