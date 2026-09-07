// content-insights.js — Eclatale LinkedIn Insights Scraper
// Runs on linkedin.com pages. Reads ONLY the authenticated user's own
// data (follower count, profile views, post analytics) from the DOM.
// Never reads other people's data. Sends to Eclatale backend for storage.

(function () {
  if (window.top !== window.self) return;

  const ECLATALE_API = 'https://api.eclatale.com';

  // ── Helpers ───────────────────────────────────────────────────────────────

  function parseCount(text) {
    if (!text) return null;
    const clean = text.replace(/,/g, '').replace(/\s/g, '');
    // Handle abbreviations: 12.5K → 12500, 1.2M → 1200000
    const m = clean.match(/^([\d.]+)([KkMm]?)$/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (m[2].toLowerCase() === 'k') n *= 1000;
    if (m[2].toLowerCase() === 'm') n *= 1000000;
    return Math.round(n);
  }

  function findNumberNear(keyword, bodyText) {
    // Finds a number appearing near a keyword in the page text
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
    // LinkedIn shows an "Edit profile" button only on the user's own profile
    return !!document.querySelector('a[href*="/in/"][aria-label*="Edit"]') ||
      !!document.querySelector('button[aria-label*="Edit your profile"]') ||
      !!document.querySelector('.pvs-profile-actions__action[aria-label*="More"]') &&
      !!document.querySelector('a[data-field="nav_settings"]');
  }

  function getPageType() {
    const path = window.location.pathname;
    if (path.startsWith('/analytics/creator')) return 'analytics';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.match(/^\/in\/[^/]+\/?$/) && isOwnProfile()) return 'own-profile';
    if (path.match(/^\/in\/[^/]+\/recent-activity/)) return 'activity';
    if (path.match(/^\/feed\/update\//)) return 'post';
    return 'other';
  }

  // ── Scrapers ──────────────────────────────────────────────────────────────

  async function scrapeOwnProfile() {
    await sleep(2000); // wait for LinkedIn SPA to finish rendering
    const bodyText = document.body.innerText;

    const data = {
      pageType: 'profile',
      scrapedAt: new Date().toISOString(),
    };

    // Follower count
    data.followerCount = findNumberNear('followers', bodyText);

    // Connection count
    data.connectionCount = findNumberNear('connections', bodyText);

    // Profile views (LinkedIn shows this on your own profile dashboard card)
    data.profileViews = findNumberNear('profile views?', bodyText);

    // Search appearances
    data.searchAppearances = findNumberNear('search appearances?', bodyText);

    // Post impressions (shown in the analytics panel on profile)
    const impressionMatch = bodyText.match(/([0-9,]+[KkMm]?)\s*(?:post\s+)?impressions?/i);
    data.postImpressions = impressionMatch ? parseCount(impressionMatch[1]) : null;

    // Headline
    const headlineEl = document.querySelector('.text-heading-xlarge');
    data.name = headlineEl?.innerText?.trim() || null;

    const headlineSectionEl = document.querySelector('.text-body-medium.break-words');
    data.headline = headlineSectionEl?.innerText?.trim() || null;

    // Location
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
    data.location = locationEl?.innerText?.trim() || null;

    return data;
  }

  async function scrapeAnalyticsPage() {
    await sleep(3000); // analytics page loads charts slowly
    const bodyText = document.body.innerText;

    const data = {
      pageType: 'analytics',
      scrapedAt: new Date().toISOString(),
    };

    // Profile views from analytics
    data.profileViews = findNumberNear('profile views?', bodyText);

    // Post impressions from analytics
    data.postImpressions = findNumberNear('impressions?', bodyText);

    // Followers from analytics
    data.followerCount = findNumberNear('followers?', bodyText);

    // Unique visitors
    data.uniqueVisitors = findNumberNear('unique visitors?', bodyText);

    // Engagement rate — look for percentage
    const engMatch = bodyText.match(/([0-9]+\.?[0-9]*)\s*%\s*engagement/i);
    data.engagementRate = engMatch ? parseFloat(engMatch[1]) : null;

    // Scrape stat cards if rendered
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

    const data = {
      pageType: 'activity',
      scrapedAt: new Date().toISOString(),
      posts: [],
    };

    // Wait for posts to render
    await waitForEl('.feed-shared-update-v2, .occludable-update', 5000);
    await sleep(1000);

    const postEls = document.querySelectorAll('.feed-shared-update-v2, .occludable-update');

    postEls.forEach((el, idx) => {
      if (idx >= 20) return; // cap at 20 posts

      const post = {};

      // Post URN / ID from data attribute
      const urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || null;
      post.urn = urn;

      // Post text
      const textEl = el.querySelector('.feed-shared-update-v2__description, .feed-shared-text, .attributed-text-segment-list__content');
      post.text = textEl?.innerText?.trim()?.slice(0, 500) || null;

      // Timestamp
      const timeEl = el.querySelector('time, .feed-shared-actor__sub-description');
      post.postedAt = timeEl?.getAttribute('datetime') || timeEl?.innerText?.trim() || null;

      // Reactions count
      const reactEl = el.querySelector('.social-details-social-counts__reactions-count, [aria-label*="reaction"]');
      post.likes = reactEl ? parseCount(reactEl.innerText) : null;

      // Comments count
      const commentEl = el.querySelector('.social-details-social-counts__comments, [aria-label*="comment"]');
      post.comments = commentEl ? parseCount(commentEl.innerText) : null;

      // Reposts / shares
      const repostEl = el.querySelector('[aria-label*="repost"], [aria-label*="share"]');
      post.reposts = repostEl ? parseCount(repostEl.innerText) : null;

      // Impressions — LinkedIn shows these inline for own posts
      const analyticsEl = el.querySelector('.feed-shared-update-v2__analytics, [aria-label*="impression"]');
      if (analyticsEl) {
        const impMatch = analyticsEl.innerText?.match(/([0-9,]+[KkMm]?)\s*impression/i);
        post.impressions = impMatch ? parseCount(impMatch[1]) : null;
      }

      // Post type
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

    const data = {
      pageType: 'post',
      scrapedAt: new Date().toISOString(),
      url: window.location.href,
    };

    // Extract URN from URL: /feed/update/urn:li:activity:123456789
    const urnMatch = window.location.pathname.match(/urn:li:[^/]+/);
    data.urn = urnMatch ? decodeURIComponent(urnMatch[0]) : null;

    data.impressions = findNumberNear('impressions?', bodyText);
    data.likes = findNumberNear('reactions?', bodyText);
    data.comments = findNumberNear('comments?', bodyText);
    data.reposts = findNumberNear('reposts?', bodyText);

    return data;
  }

  // ── Sync to Eclatale ──────────────────────────────────────────────────────

  async function syncToEclatale(payload) {
    const result = await chrome.storage.local.get(['eclatale_token', 'eclatale_user']);
    const token = result.eclatale_token;
    const user = result.eclatale_user;
    if (!token || !user) return; // not signed in, silently skip

    try {
      await fetch(`${ECLATALE_API}/api/linkedin/sync-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: user.id, ...payload }),
      });
    } catch (_) {
      // fire-and-forget, never throw
    }
  }

  // ── Throttle: don't sync the same page more than once per 10 minutes ──────

  async function shouldSync(key) {
    const stored = await chrome.storage.local.get([key]);
    const last = stored[key] || 0;
    if (Date.now() - last < 10 * 60 * 1000) return false;
    await chrome.storage.local.set({ [key]: Date.now() });
    return true;
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  async function run() {
    const pageType = getPageType();

    if (pageType === 'own-profile') {
      if (!await shouldSync('last_profile_sync')) return;
      const data = await scrapeOwnProfile();
      await syncToEclatale(data);
    }

    if (pageType === 'analytics') {
      if (!await shouldSync('last_analytics_sync')) return;
      const data = await scrapeAnalyticsPage();
      await syncToEclatale(data);
    }

    if (pageType === 'activity') {
      if (!await shouldSync('last_activity_sync')) return;
      const data = await scrapePostActivity();
      await syncToEclatale(data);
    }

    if (pageType === 'post') {
      if (!await shouldSync(`last_post_sync_${window.location.pathname}`)) return;
      const data = await scrapePostDetail();
      await syncToEclatale(data);
    }
  }

  // Run on page load + SPA navigation
  run();

  let lastPath = window.location.pathname;
  new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      setTimeout(run, 500); // slight delay for SPA render
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

})();
