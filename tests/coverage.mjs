#!/usr/bin/env node
import { spawnSync } from 'child_process';

const args = [
  '--experimental-test-coverage',
  '--test',
  '--test-coverage-include=js/*.js',
  '--test-coverage-include=sw.js',
  '--test-coverage-lines=100',
  '--test-coverage-branches=80',
  '--test-coverage-functions=95',
  'tests/run.mjs',
  'tests/browser.mjs',
  'tests/service-worker.mjs',
];

const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
