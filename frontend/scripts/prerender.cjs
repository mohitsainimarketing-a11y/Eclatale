// react-snap bundles its own ancient Puppeteer (v1.x, pinned via its own
// package.json), which downloads a 2019-era Chromium that cannot parse
// modern JS syntax (optional chaining, etc.) used throughout this codebase,
// so every prerendered page fails with "SyntaxError: Unexpected token '?'".
//
// react-snap's config has a `puppeteerExecutablePath` option, but it is a
// dead stub: declared in its defaultOptions, never actually read anywhere
// in its source. What DOES work: Puppeteer itself, even react-snap's old
// v1.x copy, checks the PUPPETEER_EXECUTABLE_PATH environment variable at
// launch time when no explicit executablePath is passed. So instead of
// touching react-snap's resolution, we install a modern `puppeteer` as our
// own top-level devDependency purely to get its (current) Chromium
// downloaded during `npm install`, on Vercel exactly as it does locally,
// and point the env var at it before invoking react-snap's old copy.
//
// npm nests react-snap's incompatible puppeteer@^1.8.0 under
// react-snap/node_modules automatically since our own puppeteer devDependency
// doesn't satisfy that range, so react-snap's require('puppeteer') is
// unaffected by which version this file requires.
// react-snap also has a known bug independent of the above: after it finishes
// crawling and writing every page (confirmed correct via the sanity check
// below), an internal stream-cleanup step throws ("Cannot write to stream
// after nil", from its `highland` dependency) and the process exits 1. The
// actual prerendered output is unaffected; only its own teardown crashes.
// react-snap has no explicit process.exit calls, so this is Node surfacing
// an uncaught rejection from an abandoned dependency, not a real failure.
// Rather than trust its exit code, verify the real success criterion: did it
// actually write the expected files.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const REQUIRED_ROUTES = ['index.html', 'pricing/index.html', 'blog/index.html', 'resources/index.html'];

(async () => {
  const puppeteer = require('puppeteer');
  const executablePath = await puppeteer.executablePath();
  console.log(`[prerender] using modern Chromium at ${executablePath}`);

  try {
    execSync('npx react-snap', {
      stdio: 'inherit',
      env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: executablePath },
    });
  } catch (e) {
    console.log(`[prerender] react-snap exited non-zero (${e.status}); verifying actual output before deciding whether to fail the build`);
  }

  const missing = REQUIRED_ROUTES.filter(r => !fs.existsSync(path.join(BUILD_DIR, r)));
  if (missing.length) {
    console.error(`[prerender] FAILED: missing expected prerendered files: ${missing.join(', ')}`);
    process.exit(1);
  }

  const pageCount = fs.readdirSync(BUILD_DIR, { recursive: true }).filter(f => String(f).endsWith('index.html')).length;
  console.log(`[prerender] OK: ${pageCount} pages prerendered, all required routes present`);
})();
