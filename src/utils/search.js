import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { listSessionFiles } from './sessionFinder.js';
import { extractTextFromContent } from './parser.js';

export async function searchSessions(root, query, { limit = 2000 } = {}) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const files = await listSessionFiles(root);
  const results = [];
  for (const f of files.slice(0, limit)) {
    let hits = 0;
    let lastSnippet = '';
    const stream = fs.createReadStream(f.path, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      const s = line.trim();
      if (!s) continue;
      let obj; try { obj = JSON.parse(s); } catch { continue; }
      const text = extractTextFromContent(obj?.payload?.content ?? obj?.content);
      if (!text) continue;
      if (text.toLowerCase().includes(q)) {
        hits++;
        lastSnippet = text.slice(0, 200);
      }
    }
    if (hits > 0) {
      results.push({ ...f, hits, snippet: lastSnippet });
    }
  }
  // sort by recency first, then hit count
  results.sort((a, b) => (b.mtime - a.mtime) || (b.hits - a.hits));
  return results;
}
