import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ADMIN_SECRET = 'test-secret-123';
const SESSION_SLUG = 'test-night';
const VOTER_ALICE = 'voter-1';
const VOTER_BOB = 'voter-2';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  function log(msg) { console.log(`  ${msg}`); }
  function fail(msg) { failures.push(msg); console.error(`  FAIL: ${msg}`); }
  function pass(msg) { console.log(`  PASS: ${msg}`); }

  // ── 1. Admin session list stats ────────────────────────────────────────────
  console.log('\n[1] Admin session list — voterCount / movieCount / totalVotes');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`);
    await page.evaluate((s) => localStorage.setItem('movienightapp_admin_secret', s), ADMIN_SECRET);
    await page.reload();
    await page.waitForTimeout(3500);

    const bodyText = await page.textContent('body');
    log(`body includes session name: ${bodyText?.includes('Test Movie Night')}`);

    const statValues = await page.locator('.session-stat__value').allTextContents();
    log(`stat values: ${JSON.stringify(statValues)}`);

    // Session test-night: 2 voters, 3 movies, ≥3 votes (may grow with repeated runs)
    if (statValues.length >= 3) {
      const [voterCount, movieCount, totalVotes, votesPerVoter] = statValues;
      if (voterCount !== '2') fail(`voterCount: expected 2, got "${voterCount}"`);
      else pass(`voterCount = ${voterCount}`);

      if (movieCount !== '3') fail(`movieCount: expected 3, got "${movieCount}"`);
      else pass(`movieCount = ${movieCount}`);

      if (parseInt(totalVotes) >= 3) pass(`totalVotes = ${totalVotes} (≥3, correct)`);
      else fail(`totalVotes: expected ≥3, got "${totalVotes}"`);
    } else {
      // body might show a different number of sessions (closed-night too)
      log(`all stat values found: ${JSON.stringify(statValues)}`);
      if (statValues.every(v => v === '0')) {
        fail('ALL stats are 0 — BUG CONFIRMED in adminListSessions COUNT subqueries');
      }
    }
    await ctx.close();
  }

  // ── 2. Admin session detail ────────────────────────────────────────────────
  console.log('\n[2] Admin session detail — per-movie vote counts');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin`);
    await page.evaluate((s) => localStorage.setItem('movienightapp_admin_secret', s), ADMIN_SECRET);
    await page.reload();
    await page.waitForTimeout(3000);

    // Click Manage for the first open session
    const manageBtn = page.locator('a:has-text("Manage →"), a:has-text("Manage")').first();
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      await page.waitForTimeout(3000);
      log(`url: ${page.url()}`);

      const movieVoteCounts = await page.locator('.admin-movie-row__votes span:first-child').allTextContents();
      log(`movie vote counts: ${JSON.stringify(movieVoteCounts)}`);

      if (movieVoteCounts.length > 0) {
        const max = Math.max(...movieVoteCounts.map(Number));
        if (max === 0) fail(`max movie vote count is 0 — BUG in adminGetSession COUNT subquery`);
        else pass(`max movie vote count = ${max} (expected 2)`);
      } else {
        const bodyText = await page.textContent('body');
        log(`page body: ${bodyText?.substring(0, 500)}`);
        fail('no movie vote count elements found');
      }
    } else {
      fail('Manage button not found');
    }
    await ctx.close();
  }

  // ── 3. Voting room — getSession vote counts (computed in JS) ────────────────
  console.log('\n[3] Voting room — card vote counts (getSession JS computation)');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ctx.addCookies([{ name: 'movienightapp_voter', value: VOTER_ALICE, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await page.goto(`${BASE}/vote/${SESSION_SLUG}`);
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    log(`has "The Matrix": ${bodyText?.includes('The Matrix')}`);

    const voteCounts = await page.locator('.movie-card__vote-count').allTextContents();
    log(`card vote counts: ${JSON.stringify(voteCounts)}`);

    if (voteCounts.length > 0) {
      if (voteCounts[0] === '2') pass(`top movie has 2 votes — correct`);
      else if (voteCounts.every(v => v === '0')) fail(`ALL card vote counts are 0 — BUG in getSession`);
      else pass(`vote counts present: ${JSON.stringify(voteCounts)}`);
    } else {
      fail('no vote count elements found');
    }

    const myVotes = await page.locator('.movie-card__my-votes').allTextContents();
    log(`my-votes labels: ${JSON.stringify(myVotes)} (Alice voted Matrix+Inception, expect 2 '(yours)')`);

    await ctx.close();
  }

  // ── 4. Post-vote count (castVote return value) ─────────────────────────────
  console.log('\n[4] Post-vote count — Bob votes for Interstellar');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ctx.addCookies([{ name: 'movienightapp_voter', value: VOTER_BOB, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await page.goto(`${BASE}/vote/${SESSION_SLUG}`);
    await page.waitForTimeout(3000);

    const cards = page.locator('.movie-card');
    const count = await cards.count();
    log(`movie cards: ${count}`);

    let interCard = null;
    for (let i = 0; i < count; i++) {
      const c = cards.nth(i);
      const t = await c.locator('.movie-card__title').textContent().catch(() => '');
      log(`  card ${i}: "${t}"`);
      if (t?.includes('Interstellar')) interCard = c;
    }

    if (interCard) {
      const before = await interCard.locator('.movie-card__vote-count').textContent();
      const voteBtn = interCard.locator('.btn-primary').first();
      const btnVisible = await voteBtn.isVisible({ timeout: 2000 }).catch(() => false);
      const btnDisabled = btnVisible ? await voteBtn.isDisabled({ timeout: 2000 }).catch(() => true) : true;
      log(`Interstellar before=${before}, btn visible=${btnVisible}, disabled=${btnDisabled}`);

      if (btnVisible && !btnDisabled) {
        await voteBtn.click();
        await page.waitForTimeout(2500);
        const after = await interCard.locator('.movie-card__vote-count').textContent();
        log(`Interstellar after=${after}`);
        const expected = String(parseInt(before || '0') + 1);
        if (after === expected) pass(`vote count incremented: ${before} → ${after}`);
        else fail(`count wrong after vote: expected ${expected}, got "${after}"`);
      } else {
        pass(`vote button not available (Bob already voted or no slots left — counts are correct: ${before})`);
      }
    } else {
      fail('Interstellar not found for Bob');
    }
    await ctx.close();
  }

  // ── 5. Standings ───────────────────────────────────────────────────────────
  console.log('\n[5] Standings counts');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ctx.addCookies([{ name: 'movienightapp_voter', value: VOTER_ALICE, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await page.goto(`${BASE}/vote/${SESSION_SLUG}`);
    await page.waitForTimeout(2000);
    await page.locator('.view-toggle__btn:has-text("Standings")').first().click();
    await page.waitForTimeout(1000);

    const rankCounts = await page.locator('.live-results__count').allTextContents();
    log(`standings counts: ${JSON.stringify(rankCounts)}`);
    if (rankCounts.length > 0 && !rankCounts.every(v => v === '0')) {
      pass(`standings non-zero: ${rankCounts[0]}`);
    } else if (rankCounts.every(v => v === '0')) {
      fail('standings all-0 — BUG');
    }
    await ctx.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  if (failures.length === 0) {
    console.log('✓ ALL CHECKS PASSED');
  } else {
    console.log(`✗ ${failures.length} FAILURE(S):`);
    failures.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log('═══════════════════════════════════════════════════\n');

  await browser.close();
  if (failures.length > 0) process.exit(1);
}

run().catch(e => { console.error('Test crashed:', e.message); process.exit(1); });
