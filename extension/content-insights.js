// content-insights.js: Eclatale LinkedIn Insights Scraper
// Runs on linkedin.com pages. Reads ONLY the authenticated user's own
// data (follower count, profile views, post analytics) from the DOM.
// Lead scraping only runs when the user explicitly clicks "Save Lead" in the popup.
// Sends to Eclatale backend for storage.

(function () {
  if (window.top !== window.self) return;

  const ECLATALE_API = 'https://api.eclatale.com';

  // ── Helpers ───────────────────────────────────────────────────────────────

  function parseCount(text) {
    if (!text) return null;
    const clean = text.replace(/,/g, '').replace(/\s/g, '');
    const m = clean.match(/^([\d.]+)([KkMm]?)$/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (m[2].toLowerCase() === 'k') n *= 1000;
    if (m[2].toLowerCase() === 'm') n *= 1000000;
    return Math.round(n);
  }

  function findNumberNear(keyword, bodyText) {
    const patterns = [
      new RegExp(`([\\d,.]+[KkMm]?)\\s*${keyword}`, 'i'),
      new RegExp(`${keyword}[^\\d]{0,20}([\\d,.]+[KkMm]?)`, 'i'),
    ];
    for (const re of patterns) {
      const m = bodyText.match(re);
      if (m) return parseCount(m[1]);
    }
    return null;
  }

  function waitForEl(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Page classifiers ──────────────────────────────────────────────────────

  function isOwnProfile() {
    return !!document.querySelector('a[href*="/in/"][aria-label*="Edit"]') ||
      !!document.querySelector('button[aria-label*="Edit your profile"]') ||
      (!!document.querySelector('.pvs-profile-actions__action[aria-label*="More"]') &&
      !!document.querySelector('a[data-field="nav_settings"]'));
  }

  function getPageType() {
    const path = window.location.pathname;
    if (path.startsWith('/analytics/creator')) return 'analytics';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.match(/^\/in\/[^/]+\/?$/) && isOwnProfile()) return 'own-profile';
    if (path.match(/^\/in\/[^/]+\/?$/)) return 'other-profile';
    if (path.match(/^\/in\/[^/]+\/recent-activity/)) return 'activity';
    if (path.match(/^\/feed\/update\//)) return 'post';
    return 'other';
  }

  // ── Own-profile scrapers ──────────────────────────────────────────────────

  async function scrapeOwnProfile() {
    await sleep(2000);
    const bodyText = document.body.innerText;
    const data = { pageType: 'profile', scrapedAt: new Date().toISOString() };
    data.followerCount = findNumberNear('followers', bodyText);
    data.connectionCount = findNumberNear('connections', bodyText);
    data.profileViews = findNumberNear('profile views?', bodyText);
    data.searchAppearances = findNumberNear('search appearances?', bodyText);
    const impressionMatch = bodyText.match(/([0-9,]+[KkMm]?)\s*(?:post\s+)?impressions?/i);
    data.postImpressions = impressionMatch ? parseCount(impressionMatch[1]) : null;
    const headlineEl = document.querySelector('.text-heading-xlarge');
    data.name = headlineEl?.innerText?.trim() || null;
    const headlineSectionEl = document.querySelector('.text-body-medium.break-words');
    data.headline = headlineSectionEl?.innerText?.trim() || null;
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
    data.location = locationEl?.innerText?.trim() || null;
    return data;
  }

  async function scrapeAnalyticsPage() {
    await sleep(3000);
    const bodyText = document.body.innerText;
    const data = { pageType: 'analytics', scrapedAt: new Date().toISOString() };
    data.profileViews = findNumberNear('profile views?', bodyText);
    data.postImpressions = findNumberNear('impressions?', bodyText);
    data.followerCount = findNumberNear('followers?', bodyText);
    data.uniqueVisitors = findNumberNear('unique visitors?', bodyText);
    const engMatch = bodyText.match(/([0-9]+\.?[0-9]*)\s*%\s*engagement/i);
    data.engagementRate = engMatch ? parseFloat(engMatch[1]) : null;
    const statCards = document.querySelectorAll('[data-view-name="profile-analytics-creator-card"], .analytics-creator-account-dashboard__main-stat');
    statCards.forEach(card => {
      const label = card.innerText?.toLowerCase() || '';
      const numEl = card.querySelector('.analytics-creator-account-dashboard__main-stat-number, .t-bold');
      const num = numEl ? parseCount(numEl.innerText) : null;
      if (label.includes('impression') && num) data.postImpressions = num;
      if (label.includes('view') && num) data.profileViews = num;
      if (label.includes('follower') && num) data.followerCount = num;
      if (label.includes('reaction') && num) data.totalReactions = num;
      if (label.includes('comment') && num) data.totalComments = num;
    });
    return data;
  }

  async function scrapePostActivity() {
    await sleep(2500);
    const data = { pageType: 'activity', scrapedAt: new Date().toISOString(), posts: [] };
    await waitForEl('.feed-shared-update-v2, .occludable-update', 5000);
    await sleep(1000);
    const postEls = document.querySelectorAll('.feed-shared-update-v2, .occludable-update');
    postEls.forEach((el, idx) => {
      if (idx >= 20) return;
      const post = {};
      post.urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || null;
      const textEl = el.querySelector('.feed-shared-update-v2__description, .feed-shared-text, .attributed-text-segment-list__content');
      post.text = textEl?.innerText?.trim()?.slice(0, 500) || null;
      const timeEl = el.querySelector('time, .feed-shared-actor__sub-description');
      post.postedAt = timeEl?.getAttribute('datetime') || timeEl?.innerText?.trim() || null;
      const reactEl = el.querySelector('.social-details-social-counts__reactions-count, [aria-label*="reaction"]');
      post.likes = reactEl ? parseCount(reactEl.innerText) : null;
      const commentEl = el.querySelector('.social-details-social-counts__comments, [aria-label*="comment"]');
      post.comments = commentEl ? parseCount(commentEl.innerText) : null;
      const repostEl = el.querySelector('[aria-label*="repost"], [aria-label*="share"]');
      post.reposts = repostEl ? parseCount(repostEl.innerText) : null;
      const analyticsEl = el.querySelector('.feed-shared-update-v2__analytics, [aria-label*="impression"]');
      if (analyticsEl) {
        const impMatch = analyticsEl.innerText?.match(/([0-9,]+[KkMm]?)\s*impression/i);
        post.impressions = impMatch ? parseCount(impMatch[1]) : null;
      }
      const hasImage = !!el.querySelector('.feed-shared-image, .feed-shared-external-image-display');
      const hasVideo = !!el.querySelector('.feed-shared-linkedin-video, video');
      const hasDocument = !!el.querySelector('.feed-shared-document');
      post.type = hasVideo ? 'video' : hasDocument ? 'document' : hasImage ? 'image' : 'text';
      if (post.text || post.urn) data.posts.push(post);
    });
    return data;
  }

  async function scrapePostDetail() {
    await sleep(2000);
    const bodyText = document.body.innerText;
    const data = { pageType: 'post', scrapedAt: new Date().toISOString(), url: window.location.href };
    const urnMatch = window.location.pathname.match(/urn:li:[^/]+/);
    data.urn = urnMatch ? decodeURIComponent(urnMatch[0]) : null;
    data.impressions = findNumberNear('impressions?', bodyText);
    data.likes = findNumberNear('reactions?', bodyText);
    data.comments = findNumberNear('comments?', bodyText);
    data.reposts = findNumberNear('reposts?', bodyText);
    return data;
  }

  // ── Full lead scraper — runs only on explicit user action ─────────────────

  async function scrapeFullProfile() {
    await sleep(1500);
    const bt = document.body.innerText;
    const lead = {
      linkedinUrl: window.location.href.split('?')[0],
      name: null, headline: null, company: null, location: null,
      about: null, connectionDegree: null, followerCount: null,
      connectionCount: null, currentTitle: null,
    };

    // Name
    const nameEl = document.querySelector('.text-heading-xlarge, h1.inline');
    lead.name = nameEl?.innerText?.trim() || null;

    // Headline
    const hlEl = document.querySelector('.text-body-medium.break-words');
    lead.headline = hlEl?.innerText?.trim() || null;

    // Location
    const locEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
    lead.location = locEl?.innerText?.trim() || null;

    // Connection degree (1st / 2nd / 3rd)
    const degEl = document.querySelector('.dist-value');
    const degText = degEl?.innerText?.trim() || '';
    const degMatch = degText.match(/1st|2nd|3rd/i) || bt.match(/\b(1st|2nd|3rd)\b/i);
    if (degMatch) lead.connectionDegree = degMatch[0];

    // Follower and connection counts
    lead.followerCount = findNumberNear('followers?', bt);
    lead.connectionCount = findNumberNear('connections?', bt);

    // About section — try DOM first, fall back to text scan
    const aboutSpans = document.querySelectorAll('#about ~ .pvs-list__outer-container span[aria-hidden="true"]');
    if (aboutSpans.length > 0) {
      lead.about = Array.from(aboutSpans).map(s => s.innerText?.trim()).filter(Boolean).join(' ').slice(0, 800);
    } else {
      const am = bt.match(/About\n([\s\S]{20,800})(?=\n(?:Experience|Education|Skills|Licenses|Certifications|[A-Z]{3,}))/);
      if (am) lead.about = am[1].trim().slice(0, 800);
    }

    // Current title and company from first experience entry
    const expItems = document.querySelectorAll('.pvs-list__item--line-separated');
    if (expItems.length > 0) {
      const first = expItems[0];
      const spans = Array.from(first.querySelectorAll('span[aria-hidden="true"]'))
        .map(s => s.innerText?.trim()).filter(Boolean);
      if (spans[0]) lead.currentTitle = spans[0];
      if (spans[1]) lead.company = spans[1];
    }

    // Fallback: parse company from headline "Role at Company"
    if (!lead.company && lead.headline) {
      const atMatch = lead.headline.match(/\bat\s+(.+)$/i);
      if (atMatch) lead.company = atMatch[1].trim().slice(0, 100);
    }

    return lead;
  }

  // ── Post text extractor — runs only on explicit user action ───────────────

  function extractCurrentPostText() {
    const selectors = [
      '.feed-shared-update-v2__description .attributed-text-segment-list__content',
      '.feed-shared-text .break-words',
      '.feed-shared-update-v2__description',
      '[data-test-id="main-feed-activity-card__commentary"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return null;
  }

  // ── Sync own analytics to Eclatale ───────────────────────────────────────

  async function syncToEclatale(payload) {
    const result = await chrome.storage.local.get(['eclatale_token', 'eclatale_user']);
    const token = result.eclatale_token;
    const user = result.eclatale_user;
    if (!token || !user) return;
    try {
      await fetch(`${ECLATALE_API}/api/linkedin/sync-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, ...payload }),
      });
    } catch (_) {}
  }

  // ── Throttle ──────────────────────────────────────────────────────────────

  async function shouldSync(key) {
    const stored = await chrome.storage.local.get([key]);
    const last = stored[key] || 0;
    if (Date.now() - last < 10 * 60 * 1000) return false;
    await chrome.storage.local.set({ [key]: Date.now() });
    return true;
  }

  // ── Passive sync (own data only) ──────────────────────────────────────────

  async function run() {
    const pageType = getPageType();
    let synced = false;

    if (pageType === 'own-profile') {
      if (!await shouldSync('last_profile_sync')) return;
      await syncToEclatale(await scrapeOwnProfile());
      synced = true;
    }
    if (pageType === 'analytics') {
      if (!await shouldSync('last_analytics_sync')) return;
      await syncToEclatale(await scrapeAnalyticsPage());
      synced = true;
    }
    if (pageType === 'activity') {
      if (!await shouldSync('last_activity_sync')) return;
      await syncToEclatale(await scrapePostActivity());
      synced = true;
    }
    if (pageType === 'post') {
      if (!await shouldSync(`last_post_sync_${window.location.pathname}`)) return;
      await syncToEclatale(await scrapePostDetail());
      synced = true;
    }
    if (synced) await chrome.storage.local.set({ last_insights_sync: Date.now() });
  }

  async function runForced() {
    const pageType = getPageType();
    if (pageType === 'own-profile') {
      await syncToEclatale(await scrapeOwnProfile());
      await chrome.storage.local.set({ last_profile_sync: Date.now() });
    } else if (pageType === 'analytics') {
      await syncToEclatale(await scrapeAnalyticsPage());
      await chrome.storage.local.set({ last_analytics_sync: Date.now() });
    } else if (pageType === 'activity') {
      await syncToEclatale(await scrapePostActivity());
      await chrome.storage.local.set({ last_activity_sync: Date.now() });
    } else if (pageType === 'post') {
      await syncToEclatale(await scrapePostDetail());
      await chrome.storage.local.set({ [`last_post_sync_${window.location.pathname}`]: Date.now() });
    }
    await chrome.storage.local.set({ last_insights_sync: Date.now() });
  }

  // ── Message listeners ─────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === 'ECLATALE_SYNC_NOW') {
      runForced()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === 'ECLATALE_SCRAPE_LEAD') {
      scrapeFullProfile()
        .then(lead => sendResponse({ ok: true, lead }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === 'ECLATALE_COPY_POST') {
      const text = extractCurrentPostText();
      sendResponse({ ok: !!text, text: text || '' });
    }
  });

  // ── Passive sync on load + SPA nav ────────────────────────────────────────

  run();

  let lastPath = window.location.pathname;
  new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      setTimeout(run, 500);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

})();
