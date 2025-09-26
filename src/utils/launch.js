import { execaCommand } from 'execa';
import chalk from 'chalk';
import clipboard from 'clipboardy';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function shellQuoteSingleArg(s) {
  // POSIX-safe single-arg quoting: wraps in single-quotes and escapes internal single-quotes
  if (s === '') return "''";
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

export async function launchCodex({ primer, codexCmd = 'codex', inject = 'auto', injectDelayMs = 1000, workingDir, injectWakeEnter = false, injectWakeDelayMs = 250, inlineArgMax }) {
  try {
    await clipboard.write(primer);
  } catch {}
  console.log(chalk.cyan('Launching Codex...'));
  if (inject === 'clipboard' || inject === 'none') {
    console.log(chalk.gray('Tip: once inside Codex, paste (Cmd/Ctrl+V) then press Enter to silently ingest the context.'));
  }

  try {
    let cmd = codexCmd;

    if (inject === 'inline') {
      const quoted = shellQuoteSingleArg(primer);
      if (cmd.includes('{contextInline}')) {
        cmd = cmd.replaceAll('{contextInline}', quoted);
      } else {
        cmd = `${cmd} ${quoted}`;
      }
      const limit = Number(inlineArgMax || process.env.CXRESUME_INLINE_MAX || 0) || 0;
      if (limit && primer.length > limit) {
        console.log(chalk.yellow(`内联参数长度(${primer.length})超过限制(${limit})，尝试降级为自动注入`));
        // Fallback to pty auto-injection
        let ptyModule = null;
        try { ptyModule = await import('node-pty'); } catch {}
        if (ptyModule?.default) {
          const pty = ptyModule.default;
          const shell = process.env.SHELL || '/bin/bash';
          const p = pty.spawn(shell, ['-lc', codexCmd], {
            name: 'xterm-color',
            cols: process.stdout.columns || 120,
            rows: process.stdout.rows || 30,
            cwd: workingDir || process.cwd(),
            env: process.env,
          });
          p.onData(data => process.stdout.write(data));
          p.onExit(({ exitCode }) => process.exitCode = exitCode);
          setTimeout(() => {
            const performWrite = () => {
              try { p.write(primer.replace(/\n/g, '\r')); } catch {}
              setTimeout(() => { try { p.write('\r'); } catch {} }, 100);
            };
            if (injectWakeEnter) {
              try { p.write('\r'); } catch {}
              setTimeout(performWrite, Math.max(50, injectWakeDelayMs || 250));
            } else {
              performWrite();
            }
          }, injectDelayMs);
          return;
        } else {
          console.log(chalk.yellow('node-pty 不可用，降级为剪贴板模式')); 
          try { await clipboard.write(primer); } catch {}
          const child = execaCommand(codexCmd, { stdio: 'inherit', shell: true, cwd: workingDir || process.cwd() });
          await child;
          return;
        }
      } else {
        const child = execaCommand(cmd, { stdio: 'inherit', shell: true, cwd: workingDir || process.cwd() });
        await child;
        return;
      }
    }

    // Auto/clipboard/none: prefer pty-based inject when available and chosen
    const wantPty = inject === 'auto' || inject === 'pty';
    let ptyModule = null;
    if (wantPty) {
      try { ptyModule = await import('node-pty'); } catch (e) { /* silent fallback */ }
    }
    if (wantPty && ptyModule?.default) {
      const pty = ptyModule.default;
      const shell = process.env.SHELL || '/bin/bash';
      const p = pty.spawn(shell, ['-lc', cmd], {
        name: 'xterm-color',
        cols: process.stdout.columns || 120,
        rows: process.stdout.rows || 30,
        cwd: workingDir || process.cwd(),
        env: process.env,
      });
      p.onData(data => process.stdout.write(data));
      p.onExit(({ exitCode }) => process.exitCode = exitCode);
      setTimeout(() => {
        const performWrite = () => {
          try { p.write(primer.replace(/\n/g, '\r')); } catch {}
          setTimeout(() => { try { p.write('\r'); } catch {} }, 100);
        };
        if (injectWakeEnter) {
          try { p.write('\r'); } catch {}
          setTimeout(performWrite, Math.max(50, injectWakeDelayMs || 250));
        } else {
          performWrite();
        }
      }, injectDelayMs);
      return;
    }

    // Fallback: normal spawn; user pastes manually
    const child = execaCommand(cmd, { stdio: 'inherit', shell: true, cwd: workingDir || process.cwd() });
    await child;
  } catch (err) {
    console.error(chalk.red('无法启动 Codex：'), err?.shortMessage || err?.message || err);
    console.log('您仍可手动运行该命令，并粘贴剪贴板内容。');
  }
}

export async function launchCodexRaw({ codexCmd = 'codex', workingDir }) {
  try {
    const child = execaCommand(codexCmd, { stdio: 'inherit', shell: true, cwd: workingDir || process.cwd() });
    await child;
  } catch (err) {
    console.error(chalk.red('无法启动 Codex：'), err?.shortMessage || err?.message || err);
  }
}

// No resume-by-id support
