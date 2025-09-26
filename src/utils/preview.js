import dayjs from 'dayjs';

export function selectRecentDialogMessages(messages, { limit = 20 } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const subset = [];
  for (let i = messages.length - 1; i >= 0 && subset.length < limit; i--) {
    const m = messages[i];
    if (!m) continue;
    const isDialog = m.role === 'user' || m.role === 'assistant';
    if (!isDialog) continue;
    subset.push({
      role: m.role,
      text: String(m.text || ''),
      timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
    });
  }
  subset.reverse();
  return subset;
}

export function formatPreviewLines(items, { color = false, chalkLib = null } = {}) {
  const chalk = color && chalkLib ? chalkLib : null;
  return items.map(it => {
    const ts = it.timestamp ? dayjs(it.timestamp).format('YYYY-MM-DD HH:mm:ss') : '';
    const role = it.role === 'user' ? 'User' : 'Assistant';
    const timeStr = chalk ? chalk.gray(ts) : ts;
    const roleStr = chalk ? (it.role === 'user' ? chalk.cyan(role) : chalk.green(role)) : role;
    return `${timeStr} | ${roleStr} | ${it.text}`;
  });
}

