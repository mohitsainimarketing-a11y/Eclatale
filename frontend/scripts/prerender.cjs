// react-snap's CLI (run.js) only reads its `reactSnap` block from
// package.json and calls index.js's exported `run()`. That leaves no way to
// vary options by platform (Windows dev machine vs. Vercel's Linux build
// container) through package.json alone, so this script calls `run()`
// programmatically instead, replicating what run.js does plus a
// platform-specific Chromium executable and launch args.
//
// A regular Chromium download (from a plain `puppeteer` install) needs full
// desktop shared libraries (libnspr4.so etc.) that Vercel's minimal Linux
// build container does not have, and fails with "error while loading shared
// libraries". @sparticuz/chromium ships a build made specifically for
// constrained serverless/CI Linux containers (originally for AWS Lambda,
// which Vercel's build containers are closely related to), plus a matching
// set of required launch args (--single-process, disabled GPU, etc.) that a
// full desktop Chromium doesn't need. Locally on Windows/Mac, fall back to a
// plain puppeteer install's own downloaded Chromium instead, since
// @sparticuz/chromium is Linux-only.
const fs = require('fs');
const path = require('path');
const url = require('url');
const { run } = require('react-snap');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const REQUIRED_ROUTES = ['index.html', 'pricing/index.html', 'blog/index.html', 'resources/index.html'];

async function resolveChromium() {
  if (process.platform === 'linux') {
    const chromium = require('@sparticuz/chromium');
    return { executablePath: await chromium.executablePath(), args: chromium.args };
  }
  const puppeteer = require('puppeteer');
  return { executablePath: await puppeteer.executablePath(), args: ['--no-sandbox', '--disable-setuid-sandbox'] };
}

(async () => {
  const { executablePath, args } = await resolveChromium();
  console.log(`[prerender] platform=${process.platform} chromium=${executablePath}`);

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const publicUrl = process.env.PUBLIC_URL || pkg.homepage;

  try {
    await run({
      publicPath: publicUrl ? url.parse(publicUrl).pathname : '/',
      ...pkg.reactSnap,
      puppeteerExecutablePath: executablePath,
      puppeteerArgs: args,
    });
  } catch (e) {
    // react-snap has a known bug independent of the above: after it finishes
    // crawling and writing every page (confirmed correct via the sanity
    // check below), an internal stream-cleanup step throws ("Cannot write
    // to stream after nil", from its `highland` dependency). The actual
    // prerendered output is unaffected; only its own teardown fails. Rather
    // than trust that this rejection means the run failed, verify the real
    // success criterion: did it actually write the expected files.
    console.log(`[prerender] run() rejected (${e.message}); verifying actual output before deciding whether to fail the build`);
  }

  const missing = REQUIRED_ROUTES.filter(r => !fs.existsSync(path.join(BUILD_DIR, r)));
  if (missing.length) {
    console.error(`[prerender] FAILED: missing expected prerendered files: ${missing.join(', ')}`);
    process.exit(1);
  }

  const pageCount = fs.readdirSync(BUILD_DIR, { recursive: true }).filter(f => String(f).endsWith('index.html')).length;
  console.log(`[prerender] OK: ${pageCount} pages prerendered, all required routes present`);
})();
