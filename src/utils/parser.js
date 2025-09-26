import fs from 'node:fs';
import readline from 'node:readline';

function coerceRole(raw) {
  const r = String(raw || '').toLowerCase();
  if (r === 'assistant' || r === 'user' || r === 'system' || r === 'tool') return r;
  return 'other';
}

export function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(it => it && typeof it.text === 'string')
      .map(it => it.text)
      .join('\n');
  }
  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }
  return '';
}

function normalizeLegacy(obj) {
  const type = obj?.type || obj?.payload?.type;
  const role = obj?.payload?.role || obj?.role;
  const timestamp = obj?.timestamp || obj?.payload?.timestamp;
  const content = obj?.payload?.content ?? obj?.content;
  const text = extractTextFromContent(content);
  return {
    role: coerceRole(role),
    text,
    timestamp: timestamp ? new Date(timestamp) : undefined,
    rawType: type || 'unknown'
  };
}

export async function parseSessionFile(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const messages = [];
  let startTime, endTime, cwd, id;
  let firstLineHandled = false;
  let newFormat = false;

  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }

    if (!firstLineHandled) {
      firstLineHandled = true;
      if (obj?.type === 'session_meta' && obj?.payload) {
        newFormat = true;
        const ts = obj.payload.timestamp || obj.timestamp;
        if (ts) {
          const d = new Date(ts); if (!isNaN(d)) startTime = d;
        }
        cwd = obj.payload.cwd || cwd;
        id = obj.payload.id || id;
        continue; // do not treat meta as message
      }
    }

    if (newFormat) {
      if (obj?.type === 'event_msg' && obj?.payload && (obj.payload.type === 'user_message' || obj.payload.type === 'agent_message')) {
        const role = obj.payload.type === 'user_message' ? 'user' : 'assistant';
        const text = String(obj.payload.message ?? '');
        const ts = obj.timestamp || obj.payload.timestamp;
        const when = ts ? new Date(ts) : undefined;
        const msg = { role, text, timestamp: when };
        messages.push(msg);
        if (!startTime && when) startTime = when;
        if (when) endTime = when;
      }
    } else {
      const msg = normalizeLegacy(obj);
      if ((msg.role === 'assistant' || msg.role === 'user' || msg.role === 'system') && msg.text) {
        messages.push(msg);
        if (!startTime && msg.timestamp) startTime = msg.timestamp;
        if (msg.timestamp) endTime = msg.timestamp;
      }
    }
  }

  return { messages, meta: { startTime, endTime, cwd, id } };
}
