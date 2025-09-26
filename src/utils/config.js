import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function getConfigPath() {
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'cxresume', 'config.json');
}

export async function loadConfig({ overrideCodexCmd, overrideRoot } = {}) {
  const defaults = {
    codexCmd: 'codex',
    logsRoot: path.join(os.homedir(), '.codex', 'sessions'),
    preview: false,
    inject: 'inline',
    injectDelayMs: 1000,
    injectWakeEnter: false,
    injectWakeDelayMs: 250,
    inlineArgMaxChars: 120000,
    primerAllPerMessageMax: 400,
    primerAllTargetChars: 10000
  };

  const p = getConfigPath();
  let fileCfg = {};
  try {
    const s = fs.readFileSync(p, 'utf8');
    fileCfg = JSON.parse(s);
  } catch {
    // ignore missing
  }

  return {
    ...defaults,
    ...fileCfg,
    ...(overrideCodexCmd ? { codexCmd: overrideCodexCmd } : {}),
    ...(overrideRoot ? { logsRoot: overrideRoot } : {}),
  };
}

export function resolveLogsRoot(cfg) {
  const p = cfg.logsRoot;
  try {
    if (fs.existsSync(p)) return p;
    // Fallback to legacy singular path if it exists
    const legacy = p.replace(/sessions$/, 'session');
    if (legacy !== p && fs.existsSync(legacy)) return legacy;
  } catch {}
  return p;
}
