#!/usr/bin/env node
import('../src/index.js').catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

