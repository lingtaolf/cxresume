import chalk from 'chalk';
import enq from 'enquirer';
const { AutoComplete } = enq;
import cliTruncate from 'cli-truncate';
import stringWidth from 'string-width';
import { listSessionFiles } from './utils/sessionFinder.js';
import { selectRecentDialogMessages } from './utils/preview.js';

function formatChoice(item, width = process.stdout.columns || 100) {
  const date = new Date(item.mtime).toLocaleString();
  const left = `${item.rel}`;
  const right = chalk.gray(date);
  const spacer = '  ';
  const maxLeft = Math.max(10, width - stringWidth(right) - stringWidth(spacer) - 2);
  const leftTrunc = cliTruncate(left, maxLeft);
  return `${leftTrunc}${spacer}${right}`;
}

export async function pickSessionInteractively(root, filesOverride = null, { showSnippets = false } = {}) {
  const files = filesOverride || await listSessionFiles(root);
  if (!files.length) {
    console.log(chalk.yellow('No session files found.'), `Root: ${root}`);
    return null;
  }
  const choices = files.slice(0, 2000).map(f => ({ name: f.path, message: formatChoice(f), value: f.path }));

  const prompt = new AutoComplete({
    name: 'session',
    message: 'Select a session (searchable):',
    choices,
    limit: 15,
  });

  try {
    const answer = await prompt.run();
    return { path: answer };
  } catch {
    return null;
  }
}

export async function showMessage(msg) {
  console.log(msg);
}

export function renderPreview({ messages, max = 10, query }) {
  const items = selectRecentDialogMessages(messages, { limit: max });
  return items.map(m => {
    const role = m.role === 'user' ? chalk.cyan('User') : chalk.green('Assistant');
    let text = m.text || '';
    if (query) {
      const q = String(query);
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      text = text.replace(re, (s) => chalk.bgYellow.black(s));
    }
    return `${role}: ${text}`;
  }).join('\n\n');
}

// previewAndConfirm removed; launch is non-interactive by default
