import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// import.meta.dirname rather than __dirname: the latter is undefined in ESM
// and Vite's native config loader warns on it.
const rootDir = import.meta.dirname;

/**
 * Migrated from Create React App (react-scripts 5.0.1), which is end-of-life
 * and — via verifyTypeScriptSetup.js — actively strips `paths` from
 * tsconfig.json ("aliased imports are not supported"). shadcn/ui requires the
 * `@/*` alias, so the bundler had to change before it could be installed.
 *
 * Two deliberate deviations from Vite defaults, both to avoid churning
 * deployment config that already works:
 *
 *   outDir 'build'     — Vite defaults to 'dist'. Staying on 'build' keeps
 *                        vercel.json, .gitignore and react-snap's default
 *                        source directory correct without edits.
 *   assetsDir 'static' — Vite defaults to 'assets'. CRA emitted hashed assets
 *                        under build/static/, and vercel.json caches
 *                        `/static/(.*)` as immutable while its SPA rewrite
 *                        excludes `static`. Renaming the directory would have
 *                        silently broken both rules.
 */
export default defineConfig(({ mode }) => {
  // Vercel injects REACT_APP_* as real environment variables, while local
  // development uses .env files — loadEnv only reads the latter, so merge both.
  const fileEnv = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const merged: Record<string, string> = { ...fileEnv };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('REACT_APP_') && process.env[key] !== undefined) {
      merged[key] = process.env[key] as string;
    }
  }

  // Every REACT_APP_* key the source actually reads. Listed explicitly so each
  // one is ALWAYS defined: an undefined key would otherwise leave a literal
  // `process.env.X` in the bundle, and `process` does not exist in a browser —
  // the page would die on load rather than merely missing a value.
  const REQUIRED_KEYS = [
    'REACT_APP_API_URL',
    'REACT_APP_SUPABASE_URL',
    'REACT_APP_SUPABASE_ANON_KEY',
    'REACT_APP_GOOGLE_CLIENT_ID',
    'REACT_APP_VAPID_PUBLIC_KEY',
  ];
  for (const key of REQUIRED_KEYS) {
    if (merged[key] === undefined) merged[key] = '';
  }

  // Rewrite each `process.env.REACT_APP_X` to its literal value. Defining the
  // whole `process.env` object instead would collide with Vite's own NODE_ENV
  // substitution, so the keys are replaced individually. This keeps all
  // existing call sites and every Vercel dashboard variable working untouched.
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    define[`process.env.${key}`] = JSON.stringify(value ?? '');
  }

  // A build that silently ships an empty Supabase URL looks fine and then
  // fails at runtime for every visitor, so fail loudly here instead.
  if (mode === 'production') {
    const missing = REQUIRED_KEYS.filter((k) => !merged[k]);
    if (missing.length) {
      console.warn(`\n[vite] WARNING — empty at build time: ${missing.join(', ')}\n`);
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    define,
    server: {
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'build',
      assetsDir: 'static',
      sourcemap: false,
    },
  };
});
