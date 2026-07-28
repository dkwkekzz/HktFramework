// 실 브라우저 스모크 테스트 — §36 네 화면이 실제 브라우저에서 동작하는가
//
// vite preview 로 빌드 산출물을 서빙하고, 사전 설치된 Chromium 으로 네 화면을 차례로 조작한다.
// Phase 8 부터는 "왕복이 된다"에 그치지 않고 **화면에 무엇이 그려졌는가**까지 본다 —
// Canvas 픽셀을 세어 지도가 실제로 그려졌는지, 모드 전환이 표를 바꾸는지 확인한다.
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e));
  await page.goto(`http://localhost:${PORT}/`);

  // ── ① 세계 생성 화면 (§36.1) — 다섯 문장에서 15단계가 돌아 세계가 나오는가 ─────────
  await page.click("#tab-seed");
  await page.click("#generate");
  await page.waitForFunction(
    () => document.querySelector("#generation")?.textContent?.includes("15 실행 데이터 저장"),
    undefined,
    { timeout: 60000 },
  );
  const generation = await page.textContent("#generation");
  if (!generation?.includes("정합성 검증 통과")) {
    throw new Error(`생성 정합성 검증 실패: ${generation?.slice(0, 400)}`);
  }
  if (await page.isDisabled("#use-generated")) throw new Error("생성된 세계로 시작할 수 없음");

  // ── ② 세계 구조 검토 화면 (§36.1 승격) — 항목 재생성 = 증분 재실행 ───────────────
  await page.click("#tab-editor");
  await page.waitForFunction(() => document.querySelectorAll("#editor button[data-step]").length > 0);
  const stepCount = await page.locator("#editor button[data-step]").count();
  if (stepCount !== 15) throw new Error(`단계 아티팩트 트리가 15개가 아님: ${stepCount}`);
  // 뒤쪽 단계를 다시 생성하면 앞 단계는 재사용(=)으로 표시된다
  await page.click('#editor button[data-step="event_patterns"]');
  await page.waitForFunction(
    () => (document.querySelector("#editor")?.textContent ?? "").includes("[reused]"),
    undefined,
    { timeout: 60000 },
  );
  const editor = await page.textContent("#editor");
  const reusedCount = (editor.match(/\[reused\]/g) ?? []).length;
  if (reusedCount < 10) throw new Error(`증분 재실행이 앞 단계를 재사용하지 않음 (reused ${reusedCount})`);

  // ── ③ 월드 지도 · 주체 관찰 화면 (§36.2, §36.3) ─────────────────────────────────
  await page.click("#tab-simulation");
  await page.click("#init-player");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("0일차"));
  const entityCount = (text) => Number(/개체 (\d+)개/.exec(text ?? "")?.[1] ?? "0");
  const worldWideCount = entityCount(await page.textContent("#status"));

  for (let day = 0; day < 3; day++) {
    await page.click("#advance-day");
    await page.waitForFunction((d) => document.querySelector("#status")?.textContent?.includes(`${d}일차`), day + 1);
  }

  // 지도가 실제로 그려졌는가 — Canvas 픽셀을 센다 (ViewModel → 렌더러 → 화면의 최종 확인)
  const painted = await page.evaluate(() => {
    const canvas = document.querySelector("#map");
    const context = canvas.getContext("2d");
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled += 1;
    return { filled, total: data.length / 4 };
  });
  if (painted.filled < painted.total * 0.05) {
    throw new Error(`지도가 그려지지 않음 — 채워진 픽셀 ${painted.filled}/${painted.total}`);
  }

  // 텍스트 덤프 렌더러도 같은 장면을 그린다 (§8.0 격리 증명)
  const dump = await page.textContent("#world");
  if (!dump?.includes("[지도]") || !dump.includes("region.silent_forest")) {
    throw new Error(`텍스트 덤프 렌더러가 같은 장면을 그리지 않음: ${dump?.slice(0, 300)}`);
  }

  // 배속 조절 (§36.2)
  await page.click("#speed-up");
  await page.waitForFunction(() => document.querySelector("#speed-view")?.textContent === "×2");

  // 주체 관찰 화면 — 개발자 모드는 실제와 믿음을 나란히 보여준다 (§36.3)
  await page.selectOption("#agent-select", "creature.echo_beast_mother");
  await page.waitForFunction(() =>
    (document.querySelector("#agent")?.textContent ?? "").includes("실제 상태"),
  );
  const developerRows = await page.locator("#agent table tr").count();
  const developerAgent = await page.textContent("#agent");
  for (const label of ["목적 그래프", "기억", "관계", "능력과 제약"]) {
    if (!developerAgent.includes(label)) throw new Error(`§36.3 항목 누락: ${label}`);
  }

  // 플레이어 개입 (§30·§31) — 조작 중에는 화면이 세계가 아니라 아는 것을 그린다 (§36.3)
  await page.click("#attach");
  await page.waitForFunction(() => document.querySelector("#player")?.textContent?.includes("지금 할 수 있는 것"));
  const optionCount = await page.locator("#player button[data-action]").count();
  if (optionCount === 0) throw new Error("플레이어 행동 후보가 표시되지 않음");
  await page.click("#player button[data-action]");
  await page.waitForFunction(() => document.querySelector("#notice")?.textContent?.includes("시작 (완료"));

  await page.click("#mode-player");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("시점 플레이어"));
  const knownCount = entityCount(await page.textContent("#status"));
  if (knownCount === 0 || knownCount > worldWideCount) {
    throw new Error(`지식 필터가 어긋남 — 세계 ${worldWideCount}개 / 화면 ${knownCount}개`);
  }
  const playerAgentPanel = await page.textContent("#agent");
  if (!playerAgentPanel.includes("감춰진 상태")) {
    throw new Error(`플레이어 시점에서 감춰진 상태 수가 표시되지 않음: ${playerAgentPanel.slice(0, 300)}`);
  }
  // 플레이어 시점의 상태 표에는 실제값 열이 채워지지 않는다 (— 로만 남는다)
  const playerActuals = await page.evaluate(() =>
    [...document.querySelectorAll("#agent table tr")]
      .slice(1)
      .map((row) => row.children[1]?.textContent ?? "")
      .filter((text) => text.length > 0 && text !== "—").length,
  );
  if (playerActuals > 0) throw new Error(`플레이어 시점에 실제값이 ${playerActuals}항 실렸다`);

  // ── ④ 사건 화면 (§36.4) ────────────────────────────────────────────────────────
  // 모드 버튼은 시뮬레이션 화면에 있다 — 시점을 개발자로 돌린 뒤 사건 화면으로 넘어간다
  await page.click("#mode-developer");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("시점 개발자"));
  await page.click("#tab-events");
  await page.waitForFunction(() => document.querySelectorAll("#events button[data-event]").length > 0, undefined, {
    timeout: 30000,
  });
  await page.click("#events button[data-event]");
  await page.waitForFunction(() =>
    (document.querySelector("#event-detail")?.textContent ?? "").includes("알려진 정보"),
  );
  const detail = await page.textContent("#event-detail");
  for (const label of [
    "참여자",
    "알려진 정보",
    "실제 원인",
    "시간순 상태 변화",
    "플레이어 개입 기록",
    "발생한 결과",
    "후속 사건 가능성",
    "소문 —",
    "문서 —",
  ]) {
    if (!detail.includes(label)) throw new Error(`§36.4 항목 누락: ${label}`);
  }

  // 같은 사건을 플레이어 시점으로 보면 실제 원인이 감춰진다 (§30)
  await page.click("#tab-simulation");
  await page.click("#mode-player");
  await page.click("#tab-events");
  await page.waitForFunction(() =>
    (document.querySelector("#event-detail")?.textContent ?? "").includes("플레이어 시점에서는 감춰진다"),
  );
  const playerDetail = await page.textContent("#event-detail");

  if (pageErrors.length > 0) {
    throw new Error(`페이지 오류: ${pageErrors.map((e) => e.message).join(", ")}`);
  }
  console.log("SMOKE OK — 네 화면 전부 동작");
  console.log(`① 생성 — ${generation.replace(/\s+/g, " ").slice(0, 160)}`);
  console.log(`② 구조 검토 — 단계 ${stepCount}개 · 증분 재실행에서 재사용 ${reusedCount}단계`);
  console.log(
    `③ 지도 — Canvas 채워진 픽셀 ${painted.filled}/${painted.total} · 개체 세계 ${worldWideCount} → 플레이어 시점 ${knownCount} · ` +
      `관찰 표 ${developerRows}행 (플레이어 시점 실제값 ${playerActuals}항)`,
  );
  console.log(`④ 사건 — ${playerDetail.replace(/\s+/g, " ").slice(0, 200)}`);
} finally {
  await browser?.close();
  preview.kill();
}
