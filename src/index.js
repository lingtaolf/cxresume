import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveLogsRoot } from './utils/config.js';
import { pickSessionInteractively, showMessage, renderPreview } from './ui.js';
import { pickSessionSplitTUI } from './tui/splitPicker.js';
import { buildPrimerAll } from './utils/compress.js';
import { parseSessionFile } from './utils/parser.js';
import { listSessionFiles } from './utils/sessionFinder.js';
import { searchSessions } from './utils/search.js';
import { launchCodex, launchCodexRaw } from './utils/launch.js';
import { filterSessionsByCwd } from './utils/metaQuick.js';
// dynamic keep is not used in full-history compression mode

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-')) { args._.push(a); continue; }
    const [k, v] = a.includes('=') ? a.split('=') : [a, undefined];
    switch (k) {
      case '-h':
      case '--help': args.help = true; break;
      case '-v':
      case '--version': args.version = true; break;
      case '--list': args.list = true; break;
      case '--open': args.open = argv[++i] || v; break;
      case '--root': args.root = argv[++i] || v; break;
      case '--codex': args.codex = argv[++i] || v; break;
      case '--search': args.search = argv[++i] || v; break;
      case '--preview': args.preview = true; break;
      case '--no-preview': args.preview = false; break;
      // injection is default and not configurable via CLI anymore
      case '--hide': {
        // Collect subsequent non-option tokens as hide options
        const valid = new Set(['tool','thinking','user','assistant','system']);
        const vals = [];
        let j = i + 1;
        while (j < argv.length && !String(argv[j]).startsWith('-')) {
          const tok = String(argv[j]);
          if (valid.has(tok)) vals.push(tok);
          else break;
          j++;
        }
        args.hide = vals.length ? vals : ['tool','thinking'];
        i = j - 1;
        break;
      }
      case '-y':
      case '--yes': args.yes = true; break;
      case '--legacy-ui': args.legacyUI = true; break;
      case '--print': args.print = true; break;
      case '--no-launch': args.noLaunch = true; break;
      case '--debug': args.debug = true; break;
      default:
        console.warn(chalk.yellow(`Unknown option: ${a}`));
    }
  }
  return args;
}

function showHelp() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(`\n${chalk.cyan('cxresume')} v${pkg.version}\n`);
  console.log('Resume Codex sessions from ~/.codex/sessions');
  console.log('\nUsage:');
  console.log('  cxresume               # interactive session picker');
  console.log('  cxresume --list        # list recent session files');
  console.log('  cxresume --open <file> # open a specific session file');
  console.log('  cxresume .             # filter sessions by current working directory (if available)');
  console.log('\nOptions:');
  console.log('  --root <dir>           Override sessions root (default: ~/.codex/sessions)');
  console.log('  --codex <cmd>          Codex launch command (default: "codex")');
  // console.log('  --keep-last <n>        Keep last N messages verbatim (default: 8)');
  console.log('  --search <text>        Content search, then pick from matches');
  console.log('  --hide [types...]      Hide types in preview: tool thinking user assistant system (default: tool thinking)');
  // injection is inline by default; advanced injection flags removed for simplicity
  console.log('  --legacy-ui            Use legacy single-prompt selector (no split view)');
  console.log('  --print                Only print the primer and exit');
  console.log('  --no-launch            Do not launch Codex (copy primer to clipboard only)');
  console.log('  --debug                Print extra diagnostics');
  console.log('  -h, --help             Show help');
  console.log('  -v, --version          Show version');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return showHelp();
  if (args.version) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    console.log(pkg.version);
    return;
  }

  const cfg = await loadConfig({ overrideCodexCmd: args.codex, overrideRoot: args.root });
  const root = resolveLogsRoot(cfg);

  if (args.list) {
    const files = await listSessionFiles(root);
    if (!files.length) {
      console.log(chalk.yellow('No session files found.'), `Root: ${root}`);
      return;
    }
    console.log(chalk.cyan(`Found ${files.length} sessions under ${root}`));
    for (const f of files.slice(0, 100)) {
      console.log(`- ${f.rel} ${chalk.gray(`(${new Date(f.mtime).toLocaleString()})`)}`);
    }
    if (files.length > 100) console.log(chalk.gray(`... and ${files.length - 100} more`));
    return;
  }

  // Handle current dir filter shorthand '.' in positional args
  const hadDot = (args._ || []).includes('.');
  const currentDirOnly = hadDot;
  if (hadDot) args._ = args._.filter(x => x !== '.');

  // Find session: via --search, --open or interactive
  let targetFile = args.open;
  let tuiResult = null;
  if (args.search) {
    const results = await searchSessions(root, args.search);
    if (!results.length) {
      console.log(chalk.yellow(`No matches for "${args.search}" under ${root}`));
      return;
    }
    // Use split TUI with prefiltered results
    tuiResult = await pickSessionSplitTUI(root, results, { hide: args.hide, currentDirOnly });
    if (!tuiResult) return;
    if (tuiResult.action === 'startNew') {
      const cmd = [cfg.codexCmd, (tuiResult.extraArgs || '').trim()].filter(Boolean).join(' ');
      await launchCodexRaw({ codexCmd: cmd, workingDir: tuiResult.workingDir || process.cwd() });
      return;
    }
    targetFile = tuiResult.path;
  } else if (!targetFile) {
    let preset = null;
    if (currentDirOnly) {
      try {
        preset = await filterSessionsByCwd(root, process.cwd());
        if (!preset.length) console.log(chalk.gray('No sessions matched current directory; showing all.'));
      } catch {}
    }
    const choice = args.legacyUI
      ? await pickSessionInteractively(root, preset)
      : await pickSessionSplitTUI(root, preset, { hide: args.hide, currentDirOnly });
    if (!choice) return; // user aborted
    if (choice.action === 'startNew') {
      const cmd = [cfg.codexCmd, (choice.extraArgs || '').trim()].filter(Boolean).join(' ');
      await launchCodexRaw({ codexCmd: cmd, workingDir: choice.workingDir || process.cwd() });
      return;
    }
    tuiResult = choice;
    targetFile = choice.path;
  } else {
    // allow shorthand relative segments under root
    const abs = path.isAbsolute(targetFile) ? targetFile : path.join(root, targetFile);
    if (fs.existsSync(abs)) targetFile = abs;
  }

  if (!fs.existsSync(targetFile)) {
    console.error(chalk.red(`File not found: ${targetFile}`));
    process.exit(2);
  }

  if (args.debug) console.error(chalk.gray(`Parsing ${targetFile} ...`));
  const { messages, meta } = await parseSessionFile(targetFile);
  if (!messages.length) {
    console.error(chalk.red('No messages could be parsed from the session.'));
    process.exit(3);
  }

  const wantPreview = args.preview !== undefined ? args.preview : cfg.preview;
  if (wantPreview && !args.print) {
    console.log(chalk.magenta('\nPreview of recent dialog (auto-continue):'));
    console.log(renderPreview({ messages, max: 5, query: args.search }));
  }

  // Using full-history compression; derive per-message/max budget from config
  const perMessageMax = (cfg.primerAllPerMessageMax || 400);
  const targetChars = (cfg.primerAllTargetChars || 10000);
  const primer = buildPrimerAll({
    messages,
    sessionId: (meta?.id) ? meta.id : path.relative(root, targetFile),
    startTime: meta.startTime,
    endTime: meta.endTime,
    perMessageMax,
    targetChars,
  });

  if (args.print) {
    console.log(primer);
    return;
  }

  const cmdWithArgs = [cfg.codexCmd, (tuiResult?.extraArgs || '').trim()].filter(Boolean).join(' ');
  if (args.noLaunch) {
    await showMessage('已生成上下文但未启动（--no-launch）。');
    return;
  }

  const inject = cfg.inject || 'inline';
  const injectDelayMs = (cfg.injectDelayMs || 1000);
  const injectWakeEnter = !!cfg.injectWakeEnter;
  const injectWakeDelayMs = (cfg.injectWakeDelayMs || 250);
  const inlineArgMax = cfg.inlineArgMaxChars || 120000;
  await launchCodex({ primer, codexCmd: cmdWithArgs, inject, injectDelayMs, workingDir: tuiResult?.workingDir || process.cwd(), injectWakeEnter, injectWakeDelayMs, inlineArgMax });
}

main();
