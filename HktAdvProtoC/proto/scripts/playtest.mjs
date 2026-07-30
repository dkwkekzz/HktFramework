// 플레이 화면 눈 검증 — §3 모듈 7 을 사람이 하는 순서대로 조작하고 화면을 그대로 찍는다.
//
// play-session.ts 가 "무엇이 일어났는가"를 수치로 적는다면, 이 스크립트는 "그게 게임처럼 보이는가"를
// 사람이 판단할 수 있게 스크린샷으로 남긴다. 판정하지 않는다 — 찍고, 화면에서 센 것만 출력한다.
//
// 실행: node scripts/playtest.mjs   (dist/ 를 스스로 빌드한다. HKT_PLAYTEST_SKIP_BUILD=1 로 건너뛴다)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

// 포트 두 가지 함정을 피한다: 4190 은 fetch 스펙의 차단 포트(sieve — 폴링이 "bad port" 로 죽는다),
// 그리고 preview 를 127.0.0.1 로 바인딩해야 Node fetch 가 닿는다(기본 바인딩은 ::1 만 잡는다).
const PORT = 4188;
const HOST = "127.0.0.1";
const OUT = process.env.OUT ?? "shots";
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
mkdirSync(OUT, { recursive: true });

if (process.env.HKT_PLAYTEST_SKIP_BUILD !== "1") {
  const built = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: process.platform === "win32" });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

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

const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", HOST], {
  stdio: "ignore",
});
let browser;
const log = [];

/** 캔버스에 실제로 그려진 것 — 배경 외 픽셀과 색 종류 */
const paintedOf = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("#play-canvas");
    const context = canvas.getContext("2d");
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const isBackground = data[i] === 0x13 && data[i + 1] === 0x1a && data[i + 2] === 0x26;
      if (!isBackground) colored += 1;
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    return { colored, total: data.length / 4, colors: colors.size };
  });

try {
  await waitForServer(`http://${HOST}:${PORT}/`);
  browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => log.push(`PAGEERROR ${error.message}`));
  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` });
    log.push(`shot ${name}`);
  };

  await page.goto(`http://${HOST}:${PORT}/#play`);
  await page.waitForFunction(() => document.querySelectorAll("#play-worlds .play-card").length > 0);
  await shot("play-1-world-select");

  // ① 세계 선택 (빌트인 — 지금 §3 1~6 을 굽는다)
  await page.click("#play-worlds .play-card");
  await page.waitForFunction(() => document.querySelectorAll("#play-agents .play-card").length > 0, undefined, {
    timeout: 60000,
  });
  await shot("play-2-agent-select");

  // ② 주체 선택 → 플레이 시작
  await page.click('#play-agents .play-card[data-agent="agent.kael"]');
  await page.waitForFunction(() => (document.querySelector("#play-status")?.textContent ?? "").length > 0, undefined, {
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await shot("play-3-start");
  log.push(`시작 화면 ${JSON.stringify(await paintedOf(page))}`);

  // ③ 배속을 올리고 산다 — 시간이 흐르는 동안 화면을 몇 번 찍는다
  await page.click("#play-speed"); // ×2
  await page.click("#play-speed"); // ×4
  await page.waitForTimeout(4000);
  await shot("play-4-running");

  // ④ WASD 로 달린다
  await page.keyboard.down("d");
  await page.waitForTimeout(2500);
  await page.keyboard.up("d");
  await page.keyboard.down("s");
  await page.waitForTimeout(2500);
  await page.keyboard.up("s");
  await shot("play-5-after-wasd");

  // ⑤ 대상 지정 — 캔버스 위 마커를 훑어 클릭해 본다 (사람이 눈으로 찾는 자리를 격자로 대신한다)
  const box = await page.locator("#play-canvas").boundingBox();
  let targeted = false;
  for (let ratioY = 0.25; ratioY <= 0.75 && !targeted; ratioY += 0.1) {
    for (let ratioX = 0.2; ratioX <= 0.8 && !targeted; ratioX += 0.06) {
      await page.mouse.click(box.x + box.width * ratioX, box.y + box.height * ratioY);
      await page.waitForTimeout(120);
      targeted = await page.evaluate(() => document.querySelector("#play-target")?.hidden === false);
    }
  }
  log.push(
    targeted
      ? `대상 지정 ✓ — ${(await page.textContent("#play-target")).replace(/\s+/g, " ").slice(0, 90)}`
      : "대상 지정 ✗ — 격자 클릭으로 마커를 잡지 못했다",
  );
  await shot("play-6-target");

  // ⑥ 행동바 — 지금 고를 수 있는 것
  const actions = await page.locator("#play-actions .play-action").allTextContents();
  log.push(`행동 버튼 ${actions.length}개 — ${actions.map((text) => text.replace(/\s+/g, " ")).slice(0, 6).join(" | ")}`);
  if (actions.length > 0) {
    await page.click("#play-actions .play-action");
    await page.waitForTimeout(2000);
    await shot("play-7-acting");
    log.push(`행동 후 상태 — ${(await page.textContent("#play-status")).replace(/\s+/g, " ").slice(0, 120)}`);
  }

  // ⑦ 패널(아는 사건 · 저널)
  await page.click("#play-panel-toggle");
  await page.waitForTimeout(2500);
  await shot("play-8-panel");
  log.push(`패널 — ${(await page.textContent("#play-panel")).replace(/\s+/g, " ").slice(0, 300)}`);

  // ⑧ 오래 살아 본다 — ×4 로 방치했을 때 화면이 달라지는가
  await page.click("#play-panel-toggle");
  const before = await paintedOf(page);
  await page.waitForTimeout(20000);
  const after = await paintedOf(page);
  await shot("play-9-later");
  log.push(`방치 20초: 배경 외 픽셀 ${before.colored}→${after.colored} · 색 ${before.colors}→${after.colors}`);
  log.push(`시계 — ${(await page.textContent("#play-status")).replace(/\s+/g, " ").slice(0, 60)}`);

  // ⑨ 모바일(가상 조이스틱) 화면
  const mobile = await browser.newPage({
    viewport: { width: 412, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  await mobile.goto(`http://${HOST}:${PORT}/#play`);
  await mobile.waitForFunction(() => document.querySelectorAll("#play-worlds .play-card").length > 0);
  await mobile.click("#play-worlds .play-card");
  await mobile.waitForFunction(() => document.querySelectorAll("#play-agents .play-card").length > 0, undefined, {
    timeout: 60000,
  });
  await mobile.click('#play-agents .play-card[data-agent="agent.kael"]');
  await mobile.waitForTimeout(3000);
  const joystick = await mobile.locator("#play-joystick").boundingBox();
  if (joystick !== null) {
    await mobile.touchscreen.tap(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2);
    await mobile.waitForTimeout(1500);
  }
  await mobile.screenshot({ path: `${OUT}/play-10-mobile.png` });
  log.push(`모바일 — 조이스틱 ${joystick === null ? "없음" : "표시됨"} · 행동 버튼 ${await mobile.locator("#play-actions .play-action").count()}개`);

  console.log(log.join("\n"));
  console.log(`\n스크린샷 → ${OUT}/`);
} finally {
  await browser?.close();
  preview.kill();
}
