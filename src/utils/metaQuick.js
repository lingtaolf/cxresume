import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { listSessionFiles } from './sessionFinder.js';

export function tryExtractCwd(obj) {
  const queue = [obj];
  const seen = new Set();
  const keyRe = /^(cwd|work(?:ing)?dir(?:ectory)?|workspace(?:Root)?|projectRoot|repo(?:Root|Path)?|rootDir)$/i;
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (typeof v === 'string' && keyRe.test(k) && (v.startsWith('/') || /^[A-Za-z]:\\\\/.test(v))) {
        return v;
      }
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return undefined;
}

export async function extractSessionMetaQuick(filePath, { maxLines = 1 } = {}) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let startTime, cwd, id;
  for await (const line of rl) {
    const s = line.trim(); if (!s) continue;
    let obj; try { obj = JSON.parse(s); } catch { break; }
    if (obj?.type === 'session_meta' && obj?.payload) {
      const ts = obj.payload.timestamp || obj.timestamp;
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d)) startTime = d;
      }
      if (obj.payload.cwd) cwd = obj.payload.cwd;
      if (obj.payload.id) id = obj.payload.id;
    } else {
      // fallback best-effort
      const ts = obj?.timestamp || obj?.payload?.timestamp;
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d)) startTime = d;
      }
      cwd = tryExtractCwd(obj);
    }
    break; // only first non-empty line
  }
  rl.close();
  return { startTime, cwd, id };
}

export async function filterSessionsByCwd(root, cwd, { limit = 2000 } = {}) {
  const all = await listSessionFiles(root);
  const target = path.resolve(cwd);
  const out = [];
  let idx = 0;
  const conc = 8;
  async function worker() {
    while (idx < Math.min(all.length, limit)) {
      const i = idx++;
      const f = all[i];
      try {
        const meta = await extractSessionMetaQuick(f.path);
        if (meta.cwd && path.resolve(meta.cwd) === target) {
          out.push(f);
        }
      } catch {}
    }
  }
  const workers = Array.from({ length: conc }, () => worker());
  await Promise.all(workers);
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}
