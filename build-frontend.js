#!/usr/bin/env node

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname);
const entryPoint = join(rootDir, 'static/js/cad/index.ts');
const outputFile = join(rootDir, 'static/js/cad/bundle.js');

console.log(`Building ${entryPoint}...`);

build({
  entryPoints: [entryPoint],
  bundle: true,
  outfile: outputFile,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
}).then(() => {
  console.log(`Built successfully: ${outputFile}`);
}).catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
