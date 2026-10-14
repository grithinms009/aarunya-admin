/* Runs scripts/rules.check.ts in Node against the mock data layer.
   It checks the business rules the backend will own: order numbering, stock and ledger
   movements, the order flow guards, adjustment clamping, product validation and the
   return flow. When the Spring Boot API lands these move to its test suite; until
   then this is what stops a rule regressing.

   Usage: npm run check:rules */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aarunya-check-')), 'bundle.cjs');

await build({
  entryPoints: [path.join(here, 'rules.check.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'error',
});

/* The mock store persists to localStorage, which Node doesn't have. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

await import(outfile);
