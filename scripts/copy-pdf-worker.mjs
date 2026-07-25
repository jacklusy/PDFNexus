#!/usr/bin/env node
/**
 * Copy the untransformed pdf.js worker into apps/web/public
 * so Next/SWC never rewrites it with bare @swc/helpers imports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const destDir = path.join(root, 'apps/web/public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${path.relative(root, dest)}`);
