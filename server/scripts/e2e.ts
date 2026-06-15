/// <reference lib="dom" />
// Headless browser smoke test of the full clickable flow.
// Usage: SERVER_LOG=<path to dev server output> tsx scripts/e2e.ts
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const LOG = process.env.SERVER_LOG;
const email = `e2e-${Date.now()}@test.com`;

async function readOtp(): Promise<string> {
  if (!LOG) throw new Error("SERVER_LOG env var (path to dev server output) is required");
  for (let i = 0; i < 40; i++) {
    const txt = fs.readFileSync(LOG, "utf8");
    const matches = [...txt.matchAll(/\[DEV OTP\] (\S+)\s+->\s+(\d{6})/g)].filter((m) => m[1] === email);
    if (matches.length) return matches[matches.length - 1][2];
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("OTP not found in server log");
}

async function main() {
  const browser = await chromium.launch({
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  // Real JS errors fail the test. Console messages (incl. the benign 401 from
  // the signin page's "already logged in?" probe) are recorded but not fatal.
  const errors: string[] = [];
  const consoleNotes: string[] = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleNotes.push(m.text());
  });

  const result: Record<string, unknown> = { email };

  // 1. Sign in
  await page.goto(`${BASE}/signin.html`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL(/verify\.html/);
  const code = await readOtp();
  result.gotOtp = code;

  // 2. Enter OTP
  const boxes = await page.$$(".otp input");
  for (let i = 0; i < 6; i++) await boxes[i].fill(code[i]);
  await page.click("button[type=submit]");
  await page.waitForURL(/(onboarding|library)\.html/);

  // 3. Onboarding (new user)
  if (page.url().includes("onboarding")) {
    result.onboardingShown = true;
    await page.waitForSelector(".chip[aria-pressed='true']");
    await page.click("a.btn--primary"); // 4 defaults pre-selected
    await page.waitForURL(/library\.html/);
  }

  // 4. Library (wait for the JS render, not the static markup)
  await page.waitForFunction(() => document.documentElement.getAttribute("data-pp-ready") === "library");
  result.cardCount = await page.$$eval(".ep-card", (els) => els.length);
  result.dayCount = await page.$$eval(".day-section", (els) => els.length);

  // length filter
  await page.click('[data-length-filter] button[data-len="10"]');
  await page.waitForTimeout(100);
  result.visibleAfter10Filter = await page.$$eval(".ep-card", (els) =>
    els.filter((e) => (e as HTMLElement).style.display !== "none").length
  );
  await page.click('[data-length-filter] button[data-len="all"]');

  // search
  await page.fill(".toolbar .search input", "mercosur");
  await page.waitForTimeout(300);
  result.visibleAfterSearch = await page.$$eval(".ep-card", (els) =>
    els.filter((e) => (e as HTMLElement).style.display !== "none").length
  );
  await page.fill(".toolbar .search input", "");
  await page.waitForTimeout(300);

  // 5. Player
  await page.click(".ep-card");
  await page.waitForURL(/player\.html/);
  await page.waitForFunction(() => document.documentElement.getAttribute("data-pp-ready") === "player");
  result.playerTitle = (await page.textContent(".player-art h1"))?.trim();
  result.transcriptLines = await page.$$eval(".transcript-line", (e) => e.length);
  result.chapterRows = await page.$$eval("#panel-chapters .row", (e) => e.length);
  result.sourceItems = await page.$$eval(".notes-source", (e) => e.length);

  // play and confirm audio advances
  await page.click(".player-art [data-play-toggle]");
  await page.waitForTimeout(1500);
  result.audioCurrentTime = await page.evaluate(() => {
    const a = document.querySelector("audio") as HTMLAudioElement | null;
    return a ? Number(a.currentTime.toFixed(2)) : -1;
  });
  // pause so autoplay-next can't fire during the rest of the run
  await page.evaluate(() => {
    const a = document.querySelector("audio") as HTMLAudioElement | null;
    if (a) a.pause();
  });
  // seek via clicking the scrubber center (~middle of the clip)
  await page.click(".scrubber__track");
  await page.waitForTimeout(150);
  result.scrubberValueNow = await page.getAttribute(".scrubber__track", "aria-valuenow");

  // 6. Discover (fresh page in the same context shares the session cookie)
  const page2 = await context.newPage();
  page2.on("pageerror", (e) => errors.push("PAGEERROR(discover): " + e.message));
  await page2.goto(`${BASE}/topics.html`);
  await page2.waitForFunction(() => document.documentElement.getAttribute("data-pp-ready") === "topics");
  result.topicBlocks = await page2.$$eval(".topic-block", (e) => e.length);
  result.inPodsBadges = await page2.$$eval(".news-card__included", (e) => e.length);
  const chips = await page2.$$(".chips .chip");
  if (chips.length > 1) {
    await chips[1].click();
    await page2.waitForTimeout(100);
    result.visibleBlocksAfterChip = await page2.$$eval(".topic-block", (els) =>
      els.filter((e) => (e as HTMLElement).style.display !== "none").length
    );
  }

  // 7. Account / settings — change, save, reload, verify persistence
  await page2.goto(`${BASE}/account.html`);
  await page2.waitForFunction(() => document.documentElement.getAttribute("data-pp-ready") === "account");
  result.accountEmail = await page2.inputValue("#email");
  result.accountTopicChips = await page2.$$eval("#topics .chip", (e) => e.length);
  await page2.click('#playback .segmented button:has-text("1.5×")');
  await page2.click('#notifications label.toggle:has(input[aria-label="Breaking news alerts"])');
  await page2.click(".btn--primary");
  await page2.waitForTimeout(500);
  await page2.reload();
  await page2.waitForFunction(() => document.documentElement.getAttribute("data-pp-ready") === "account");
  result.persistedSpeed = (await page2.textContent('#playback .segmented button[aria-pressed="true"]'))?.trim();
  result.persistedBreaking = await page2.isChecked('#notifications input[aria-label="Breaking news alerts"]');

  // 8. Sign out + guard
  await page2.click('a.btn--ghost[href="signin.html"]');
  await page2.waitForURL(/signin\.html/);
  result.signedOut = true;
  await page2.goto(`${BASE}/library.html`);
  await page2.waitForURL(/signin\.html/);
  result.guardRedirectedToSignin = page2.url().includes("signin");

  result.pageErrors = errors;
  result.consoleNotes = consoleNotes;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
