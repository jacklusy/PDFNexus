#!/usr/bin/env node
/**
 * Bundle budget gate for Next.js production build.
 * Fails if the largest first-load JS chunk exceeds the budget.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const nextDir = path.join(root, 'apps/web/.next');

/** Soft budget for largest static JS chunk (bytes) — conversion is lazy-loaded */
const MAX_CHUNK_BYTES = 900 * 1024;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const staticJs = walk(path.join(nextDir, 'static'));
if (staticJs.length === 0) {
  console.error('[bundle-budget] No JS chunks found under apps/web/.next/static — build first.');
  process.exit(1);
}

let largest = { file: '', size: 0 };
for (const file of staticJs) {
  const size = fs.statSync(file).size;
  if (size > largest.size) largest = { file, size };
}

const mb = (largest.size / 1024 / 1024).toFixed(2);
const budgetMb = (MAX_CHUNK_BYTES / 1024 / 1024).toFixed(2);
console.log(
  `[bundle-budget] Largest chunk: ${path.relative(root, largest.file)} (${mb} MB)`
);
console.log(`[bundle-budget] Budget: ${budgetMb} MB`);

if (largest.size > MAX_CHUNK_BYTES) {
  console.error('[bundle-budget] FAILED — chunk exceeds budget');
  process.exit(1);
}

console.log('[bundle-budget] OK');
