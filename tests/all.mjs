#!/usr/bin/env node
import { spawnSync } from 'child_process';

for (const file of ['tests/run.mjs', 'tests/browser.mjs', 'tests/service-worker.mjs']) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\nAll Neon Autofire test suites passed.');
