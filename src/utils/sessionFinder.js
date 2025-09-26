import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

export async function listSessionFiles(root) {
  const pattern = path.join(root, '**/*.jsonl').replace(/\\/g, '/');
  const entries = await fg(pattern, { dot: false, onlyFiles: true });
  const mapped = entries.map(p => {
    const st = fs.statSync(p);
    return { path: p, rel: path.relative(root, p), mtime: st.mtimeMs, size: st.size };
  });
  mapped.sort((a,b) => b.mtime - a.mtime);
  return mapped;
}

