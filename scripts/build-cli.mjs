/**
 * Bundle the upload CLI (tools/upload-cli) into one file the tracker serves
 * at /tools/trackarr-upload.mjs. Runs before `nuxt build` (npm prebuild).
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['tools/upload-cli/main.ts'],
  outfile: 'public/tools/trackarr-upload.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
  logLevel: 'warning',
});
console.log('Built public/tools/trackarr-upload.mjs');
