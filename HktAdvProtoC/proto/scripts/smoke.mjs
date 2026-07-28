// 실 브라우저 스모크 테스트 — DoD "브라우저에서 Worker 로 advance_time → state_patch 왕복"
// vite preview 로 빌드 산출물을 서빙하고, 사전 설치된 Chromium 으로 셸 페이지를 조작한다.
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 4173;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      fetch(url)
        .then((r) => (r.ok ? resolve(undefined) : retry()))
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error("preview 서버 기동 실패"));
      else setTimeout(poll, 300);
    };
    poll();
  });
}

const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "inherit",
});

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e));
  await page.goto(`http://localhost:${PORT}/`);

  await page.click("#init");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("0일차"));

  await page.click("#advance-day");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("1일차"));

  await page.click("#advance-hour");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("01:00"));

  const status = await page.textContent("#status");
  if (!status?.includes("heartbeatCount=1")) {
    throw new Error(`심장박동 상태가 patch 로 전달되지 않음: ${status}`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`페이지 오류: ${pageErrors.map((e) => e.message).join(", ")}`);
  }
  console.log("SMOKE OK —", JSON.stringify(status));
} finally {
  await browser?.close();
  preview.kill();
}
