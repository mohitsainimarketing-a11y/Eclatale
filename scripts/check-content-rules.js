#!/usr/bin/env node
/**
 * Rule Zero enforcement. See CLAUDE.md and UNIVERSAL_HUMAN_WRITING_RULES.
 *
 *   node scripts/check-content-rules.js
 *
 * Exits 1 if any em dash or en dash reaches content. Banned vocabulary is
 * reported as a warning, since a handful of hits are legitimate (a glossary
 * headword, a code identifier, an image orientation) and need a human read.
 */
const fs = require('fs');
const p = require('path');

const ROOTS = ['frontend/src', 'frontend/public', 'backend/lib', 'backend/api', 'extension', 'content/guides'];
// Individual files outside the roots above. index.html carries the <title> and the OG/Twitter
// meta, which is the most visible copy on the site: browser tabs, Google results, share cards.
const EXTRA_FILES = ['frontend/index.html', 'CLAUDE.md'];
const SKIP_DIR = /^(node_modules|\.git|worktrees|dist|build|\.next|coverage)$/;
const EXT = /\.(ts|tsx|js|jsx|json|md|txt|xml|html|css)$/;

// Files that must contain the banned characters in order to define or detect them.
const DASH_ALLOW = new Set([
  'backend/lib/writingStyles.ts',   // the ruleset itself
  'backend/lib/contentPrompts.ts',  // banned-pattern examples
  'backend/api/intelligence.ts',    // humanizer punctuation pass
]);
// CLAUDE.md states the rule, so it must show the character once to define it.
const DASH_LINE_ALLOW = /NEVER use an em dash/;

const BANNED = /\b(delve|leverage|leveraging|synergy|empower|empowering|transformative|game-changer|cutting-edge|holistic|paradigm|utilize|utilizing|unlock|unlocking|foster|fostering|nuanced|streamline|streamlining|elevate|elevating|robust|comprehensive|insights|landscape|notably|crucial|pivotal|seamlessly|groundbreaking|revolutionary|innovative)\b/gi;

// Legitimate uses: product feature name, code identifiers, image orientation,
// the glossary that defines jargon, and the banned-word lists themselves.
const VOCAB_ALLOW = [
  /LinkedIn Insights/,
  /linkedin[_-]?insights/i,
  /insights["']?\s*:/,        // JSON schema key / object property
  /\.insights\b/,
  /writingInsights/,
  /[/-]insights\b/,           // routes and filenames: /sync-insights, content-insights.js
  /insights\.(js|ts|tsx)/,
  /["']landscape["']/,
  /landscape|portrait/i,
];
const VOCAB_ALLOW_FILES = [
  'content/guides/corporate-jargons-guide.html', // defines the jargon
  'content/guides/salary-negotiation-scripts-guide.html', // "leverage" as a negotiation noun, legitimate here
  'backend/lib/writingStyles.ts',
  'backend/lib/freeTools.ts',
  'backend/api/intelligence.ts',
  'frontend/src/pages/Resources.tsx',            // jargon preview cards
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = p.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(fp, acc); }
    else if (EXT.test(e.name)) acc.push(fp);
  }
  return acc;
}

const files = [
  ...ROOTS.flatMap(r => walk(r)).map(f => f.replace(/\\/g, '/')),
  ...EXTRA_FILES.filter(f => fs.existsSync(f)),
];
const dashes = [];
const vocab = [];

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const dashOk = DASH_ALLOW.has(f);
  const vocabOk = VOCAB_ALLOW_FILES.includes(f);

  lines.forEach((line, i) => {
    if (!dashOk && !DASH_LINE_ALLOW.test(line) && (line.includes('—') || line.includes('–'))) {
      dashes.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
    if (!vocabOk) {
      const hits = line.match(BANNED);
      if (hits && !VOCAB_ALLOW.some(re => re.test(line))) {
        vocab.push(`${f}:${i + 1}  [${[...new Set(hits.map(h => h.toLowerCase()))].join(', ')}]`);
      }
    }
  });
}

console.log(`Rule Zero check: scanned ${files.length} files\n`);

if (vocab.length) {
  console.log(`WARN  banned vocabulary, ${vocab.length} line(s) to review:`);
  vocab.slice(0, 30).forEach(v => console.log('      ' + v));
  if (vocab.length > 30) console.log(`      ... and ${vocab.length - 30} more`);
  console.log('');
}

if (dashes.length) {
  console.log(`FAIL  em/en dashes found in ${dashes.length} place(s). Rule Zero allows zero.`);
  dashes.forEach(d => console.log('      ' + d));
  console.log('\n      Replace each with a period, colon, comma, or parentheses. Never a bare hyphen.');
  process.exit(1);
}

console.log('PASS  zero em/en dashes in content.');
