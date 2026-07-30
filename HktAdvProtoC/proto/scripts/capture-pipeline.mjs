// §3 파이프라인 캡처 — 모듈 1~6 의 처리 기록과 모듈 7(플레이)의 로드를 화면 그대로 찍는다.
// 목적: "모듈이 분리되고 처리 과정이 직관적으로 확인되는가"를 주장이 아니라 스크린샷으로 판단하기 위한 것.
// 실행: node scripts/capture-pipeline.mjs  (dist/ 가 이미 빌드되어 있어야 한다 — npm run build)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 4189;
const OUT = process.env.OUT ?? "shots-pipeline";
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

  // ── 1. 스튜디오에서 세계를 생성하고 (§5 15단계) 플레이 패키지로 굽는다 (§3 모듈 1~6) ──
  await page.click("#tab-seed");
  await page.click("#generate");
  await page.waitForFunction(
    () => document.querySelector("#generation")?.textContent?.includes("15 실행 데이터 저장"),
    undefined,
    { timeout: 120000 },
  );
  await page.click("#save-generated");
  await page.waitForFunction(
    () => document.querySelector("#package-report")?.textContent?.includes("보관 완료"),
    undefined,
    { timeout: 120000 },
  );
  // 모듈별 처리 기록을 전부 펼친 채로 찍는다 — 접혀 있으면 "직관적 확인"이 아니다
  await page.$$eval("#package-report details", (nodes) => nodes.forEach((node) => (node.open = true)));
  await shot("p1-studio-package-report", "#package-report");

  // ── 2. 플레이 모드 — 세계 카드가 §3 처리 기록을 달고 있다 ─────────────────────────
  await page.click("#mode-play");
  await page.waitForFunction(() => document.querySelectorAll("#play-worlds .play-card").length > 1);
  await page.$$eval("#play-worlds .play-pipeline", (nodes) => nodes.forEach((node) => (node.open = true)));
  await shot("p2-play-world-cards", "#play-select");

  // ── 3. 보관된(생성) 세계를 로드 — 모듈 7 은 4단계 스냅샷을 그대로 복원한다 ─────────
  // 펼친 기록은 접고 제목을 클릭한다 — 기록 영역 클릭은 (의도대로) 세계 시작이 아니다
  await page.$$eval("#play-worlds .play-pipeline", (nodes) => nodes.forEach((node) => (node.open = false)));
  await page.click('#play-worlds .play-card:nth-child(2) b'); // 첫 번째는 빌트인, 두 번째가 방금 보관한 세계
  await page.waitForFunction(() => document.querySelectorAll("#play-agents .play-card").length > 0, undefined, {
    timeout: 60000,
  });
  await shot("p3-play-agent-select", "#play-agent-select");

  // ── 4. 주체를 골라 플레이 — 로드된 그 데이터가 화면에서 돈다 ───────────────────────
  await page.click("#play-agents .play-card");
  await page.waitForFunction(() => (document.querySelector("#play-status")?.textContent ?? "").length > 0, undefined, {
    timeout: 60000,
  });
  await page.waitForTimeout(2500); // 자동 tick 몇 번 — 세계가 흐르는 모습
  await shot("p4-play-stage");

  console.log(log.join("\n"));
  console.log(`OK — ${OUT}/ 에 4장`);
} catch (error) {
  console.error("CAPTURE FAILED:", error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  preview.kill();
}
