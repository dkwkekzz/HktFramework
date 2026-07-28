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

  // §36.1 세계 생성 화면 — 다섯 문장에서 15단계가 돌아 세계가 나오는가
  await page.click("#generate");
  await page.waitForFunction(
    () => document.querySelector("#generation")?.textContent?.includes("15 실행 데이터 저장"),
    undefined,
    { timeout: 30000 },
  );
  const generation = await page.textContent("#generation");
  if (!generation?.includes("정합성 검증 통과")) {
    throw new Error(`생성 정합성 검증 실패: ${generation?.slice(0, 400)}`);
  }
  if (await page.isDisabled("#use-generated")) {
    throw new Error("생성된 세계로 시작할 수 없음");
  }

  await page.click("#init");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("0일차"));
  // 수동 세계의 개체가 ViewModel 을 통해 화면까지 도달했는가
  await page.waitForFunction(() => document.querySelector("#world")?.textContent?.includes("agent.kael"));

  await page.click("#advance-day");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("1일차"));

  await page.click("#advance-hour");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("01:00"));

  const status = await page.textContent("#status");
  const world = await page.textContent("#world");
  // 하루가 지나는 동안 주체가 실제로 움직였는가 (patch 왕복의 최종 확인)
  if (!world?.includes("current_action=")) {
    throw new Error(`주체의 행동 상태가 patch 로 전달되지 않음: ${world?.slice(0, 400)}`);
  }
  if (!world.includes("region.silent_forest")) {
    throw new Error("지역 묶음이 표시되지 않음");
  }
  // Phase 7 — 개입 세계를 올리고 한 주체를 조작한다 (§30 개입 기회 · §31 동일 행동 체계)
  await page.click("#init-player");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("0일차"));
  const entityCount = (text) => Number(/개체 (\d+)개/.exec(text ?? "")?.[1] ?? "0");
  const worldWideCount = entityCount(await page.textContent("#status"));
  await page.click("#attach");
  await page.waitForFunction(() => document.querySelector("#player")?.textContent?.includes("지금 할 수 있는 것"));
  const optionCount = await page.locator("#player button[data-action]").count();
  if (optionCount === 0) throw new Error("플레이어 행동 후보가 표시되지 않음");
  // 표시 목록은 세계의 모든 행동이 아니다 (§31) — 지금 가능한 것만 나온다
  await page.click("#player button[data-action]");
  await page.waitForFunction(() => document.querySelector("#player")?.textContent?.includes("시작 (완료"));
  for (let day = 0; day < 3; day++) {
    await page.click("#advance-day");
    await page.waitForFunction((d) => document.querySelector("#status")?.textContent?.includes(`${d}일차`), day + 1);
  }
  const player = await page.textContent("#player");
  if (!player?.includes("아직 모르는 개체") || !player.includes("저널")) {
    throw new Error("플레이어 지식 요약·저널이 표시되지 않음");
  }
  // 조작 중이면 화면은 세계가 아니라 **아는 것**을 그린다 (§36.3)
  const knownCount = entityCount(await page.textContent("#status"));
  if (knownCount === 0 || knownCount > worldWideCount) {
    throw new Error(`지식 필터가 어긋남 — 세계 ${worldWideCount}개 / 화면 ${knownCount}개`);
  }
  // 남의 상태는 실제값이 아니라 믿음값이다 — 빌더가 확신을 붙여 표시한다 (`값?0.27`)
  const playerWorld = await page.textContent("#world");
  if (!/=[^\s]*\?\d\.\d\d/.test(playerWorld ?? "")) {
    throw new Error("믿음 기반 표시(확신 포함)가 화면에 없음 — 실제 상태를 그리고 있을 수 있다");
  }
  // 남의 관찰 불가 상태(§9)는 화면에 없어야 한다.
  // (자기 자신의 같은 상태는 자기 감각이므로 실린다 — 그래서 "한 블록 이하"가 정답이다.)
  const hiddenBlocks = await page.evaluate(() =>
    (document.querySelector("#world")?.textContent ?? "").split("\n[").filter((block) => block.includes("offspring_threat")).length,
  );
  if (hiddenBlocks > 1) {
    throw new Error(`관찰 불가 상태가 남의 개체 블록에 노출됨 (${hiddenBlocks}개 블록)`);
  }

  if (pageErrors.length > 0) {
    throw new Error(`페이지 오류: ${pageErrors.map((e) => e.message).join(", ")}`);
  }
  console.log("SMOKE OK —", JSON.stringify(status));
  console.log("플레이어 패널 —", player.replace(/\s+/g, " ").slice(0, 300));
  console.log("생성 화면 —", generation.replace(/\s+/g, " ").slice(0, 260));
} finally {
  await browser?.close();
  preview.kill();
}
