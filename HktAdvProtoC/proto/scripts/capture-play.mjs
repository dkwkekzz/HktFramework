// 실제 플레이 캡처 — 사람이 하는 순서대로 조작하고 화면을 그대로 찍는다.
// 목적: "게임처럼 보이는가"를 주장이 아니라 스크린샷으로 판단하기 위한 것.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 4188;
const OUT = process.env.OUT ?? "/tmp/claude-0/-home-user-HktFramework/35cd4b00-64f8-50ca-8d39-b411abe465fc/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      fetch(url).then((r) => (r.ok ? resolve(undefined) : retry())).catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error("preview 기동 실패"));
      else setTimeout(poll, 300);
    };
    poll();
  });
}

const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
let browser;
const log = [];

try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1100 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => log.push(`PAGEERROR ${e.message}`));
  await page.goto(`http://localhost:${PORT}/`);

  const shot = async (name, selector) => {
    const target = selector === undefined ? page : page.locator(selector);
    await target.screenshot({ path: `${OUT}/${name}.png` });
    log.push(`shot ${name}`);
  };
  const text = (selector) => page.textContent(selector);

  // ── 1. 플레이어가 처음 보는 화면 ───────────────────────────────────────────────
  await shot("01-first-screen");

  // ── 2. 세계를 시작한다 (개입 세계) ─────────────────────────────────────────────
  await page.click("#tab-simulation");
  await page.click("#init-player");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("0일차"));
  await shot("02-world-start-day0");
  await shot("02b-map-day0", "#map");

  // ── 3. 한 주체를 조작한다 (§31) ───────────────────────────────────────────────
  await page.click("#attach");
  await page.waitForFunction(() => document.querySelector("#player")?.textContent?.includes("지금 할 수 있는 것"));
  await page.click("#mode-player");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("시점 플레이어"));
  await shot("03-attached-player-view");
  await shot("03b-action-panel", "#player");
  log.push(`행동 후보 ${await page.locator("#player button[data-action]").count()}개`);

  // ── 4. 플레이어처럼 12일을 산다 — 하루에 한 번 행동을 고르고 시간을 민다 ──────
  const played = [];
  for (let day = 1; day <= 12; day++) {
    const buttons = page.locator("#player button[data-action]");
    const count = await buttons.count();
    if (count > 0) {
      // 사람처럼 위쪽(점수 높은) 후보 중 하나를 고른다 — 날마다 조금씩 다르게
      const index = Math.min(count - 1, day % 3);
      const label = (await buttons.nth(index).textContent()) ?? "";
      await buttons.nth(index).click();
      await page.waitForTimeout(150);
      played.push(`${day}일 ${label.trim()}`);
    }
    await page.click("#advance-day");
    try {
      await page.waitForFunction((d) => document.querySelector("#status")?.textContent?.includes(`${d}일차`), day, {
        timeout: 20000,
      });
    } catch (error) {
      log.push(`DAY ${day} 실패 — status: ${(await text("#status"))?.replace(/\s+/g, " ")}`);
      log.push(`  notice: ${(await text("#notice"))?.replace(/\s+/g, " ")}`);
      await shot(`err-day${day}`);
      throw error;
    }
    // 성장 선택지가 올라오면 사람처럼 하나 고른다 (§32)
    const offers = page.locator("#player button[data-offer]");
    if ((await offers.count()) > 0) {
      const label = (await offers.first().textContent()) ?? "";
      await offers.first().click();
      await page.waitForTimeout(150);
      played.push(`${day}일 [성장] ${label.trim()}`);
    }
  }
  log.push(`플레이 기록: ${played.join(" / ")}`);
  await shot("04-day12-player-view");
  await shot("04b-map-day12", "#map");
  await shot("04c-player-panel-day12", "#player");

  // ── 5. 사건 화면 — 플레이어가 아는 사건 ───────────────────────────────────────
  await page.click("#tab-events");
  await page.waitForTimeout(400);
  await shot("05-events-player");
  const eventButtons = page.locator("#events button[data-event]");
  log.push(`플레이어가 아는 사건 ${await eventButtons.count()}건`);
  if ((await eventButtons.count()) > 0) {
    await eventButtons.first().click();
    await page.waitForFunction(() => (document.querySelector("#event-detail")?.textContent ?? "").length > 50);
    await shot("06-event-detail-player");
    await shot("06b-event-detail-only", "#event-detail");
  }

  // ── 6. 같은 사건을 개발자 시점으로 ───────────────────────────────────────────
  await page.click("#tab-simulation");
  await page.click("#mode-developer");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("시점 개발자"));
  await shot("07-map-developer-day12", "#map");
  await page.click("#tab-events");
  await page.waitForTimeout(400);
  await shot("08-event-detail-developer");

  // ── 7. 주체 관찰 화면 (§36.3) ─────────────────────────────────────────────────
  await page.click("#tab-simulation");
  await page.selectOption("#agent-select", "creature.echo_beast_mother");
  await page.waitForFunction(() => (document.querySelector("#agent")?.textContent ?? "").includes("실제 상태"));
  await shot("09-agent-observation", "#agent");

  // ── 8. 세계 생성 화면 ────────────────────────────────────────────────────────
  await page.click("#tab-seed");
  await page.click("#generate");
  await page.waitForFunction(
    () => document.querySelector("#generation")?.textContent?.includes("15 실행 데이터 저장"),
    undefined,
    { timeout: 90000 },
  );
  await shot("10-world-generation");

  log.push(`상태줄: ${(await text("#status"))?.replace(/\s+/g, " ")}`);
  log.push(`플레이어 패널 앞부분: ${(await text("#player"))?.replace(/\s+/g, " ").slice(0, 400)}`);
} finally {
  console.log(log.join("\n"));
  await browser?.close();
  preview.kill();
}
