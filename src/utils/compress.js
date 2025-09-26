import dayjs from 'dayjs';

function trimText(s, max = 280) {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function firstSentence(s) {
  const m = /([\s\S]*?[.!?。！？])(\s|$)/.exec(s);
  return m ? m[1] : s;
}


// Build a primer that includes ALL messages in chronological order, with per-message truncation
export function buildPrimerAll({ messages, sessionId, startTime, endTime, perMessageMax = 400, targetChars = 10000 }) {
  const total = messages.length;
  const overheadPer = 80; // timestamp + labels + formatting overhead

  // Estimate size if using perMessageMax
  function estimateTotal(maxPer) {
    let sum = 0;
    for (const m of messages) {
      const bodyLen = (m.text || '').toString().replace(/\s+/g, ' ').trim().length;
      sum += Math.min(bodyLen, maxPer) + overheadPer;
    }
    return sum;
  }

  let usedPer = perMessageMax;
  const est = estimateTotal(usedPer);
  if (est > targetChars && total > 0) {
    const ratio = targetChars / est;
    usedPer = Math.max(80, Math.floor(perMessageMax * Math.max(0.2, Math.min(1, ratio))));
  }

  const lines = messages.map((m, i) => {
    const ts = m.timestamp ? dayjs(m.timestamp).format('YYYY-MM-DD HH:mm:ss') : '';
    const prefix = m.role === 'user' ? 'User' : (m.role === 'assistant' ? 'Assistant' : 'System');
    const body = trimText(m.text, usedPer);
    return `${i + 1}. [${prefix}${ts ? ' @ ' + ts : ''}]\n${body}`;
  }).join('\n\n');

  const header = [
    'System: Resume previous session context. Do not reply.',
    'Instructions:',
    '- Ingest the following compressed full history and update internal context only.',
    '- Do not send a message; wait for the user.',
  ].join('\n');

  const meta = `Session: ${sessionId}\nRange: ${startTime ? dayjs(startTime).format('YYYY-MM-DD HH:mm:ss') : '?'} -> ${endTime ? dayjs(endTime).format('YYYY-MM-DD HH:mm:ss') : '?'}\nMessages: ${total} (compressed all)`;

  const primer = `${header}\n\n${meta}\n\nFull context (compressed, chronological):\n${lines}`.trim() + '\n';
  return primer;
}
