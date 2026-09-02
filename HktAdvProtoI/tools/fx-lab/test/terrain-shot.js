// 땅 검증 촬영 — C-TERRAIN-001 · C-TERRAIN-002 의 Stage 8 을 눈으로 닫는다.
//
// game-shot.js 가 이펙트 경로를 보는 자리라면, 여기서는 **지면 구역**을 본다:
// 세계(GroundZones) → 관찰 계약(ground.zones) → 결정 Layer(groundZonePlans)
// → SceneState.zones → 렌더러의 지면 구역 장치.
//
// 판정
//   ① 법칙이 걸린 자리의 범위가 땅 위에 보인다
//   ② 예외 자리(멎는 곳)의 범위가 구분되어 보인다
//   ③ 지금 내 몸에 어느 법칙이 작용 중인가 + 사유
//   ④ 값이 줄어드는 것 / 멎는 것
//
// C-TERRAIN-002 가 더하는 판정 — **머물면 발밑의 땅이 열린다**
//   ⑤ 자리마다 얼마나 찼는지가 이름에 실린다 (`빙원 · 찬 NN%`)
//   ⑥ 머무는 동안 그 값이 오른다 — 내가 준 열이 그 자리에 쌓인다
//   ⑦ 넘치면 그 자리가 분출구가 되고 (`해숨구멍 · 남은 NN%`) 그 순간 거둠이 멎는다
//   ⑧ 그리고 열이 **돌아온다** (`열을 돌려받는 중`)
//
// 그림은 둘을 찍는다 — 열리기 전과 열린 뒤. 같은 자리가 다른 시각에 다르다는 것이
// 이 Cycle 의 전부이므로, 한 장으로는 보일 수가 없다.
//
// ①② 는 픽셀로, ③④ 는 HUD 글자로 판정한다. 플레이어를 빙원까지 걸려 보내므로
// 조작 없이는 ③④ 가 서지 않는다 — 걷는 것이 이 Cycle 의 유일한 입력이다.
//
// 사용: node terrain-shot.js [png=terrain.png]
const path = require('path');
const { spawn } = require('node:child_process');
const { launch, collectErrors } = require('./_common');

const [out = 'terrain.png'] = process.argv.slice(2);
const outBefore = out.replace(/\.png$/, '-before.png');
const outAfter = out.replace(/\.png$/, '-after.png');
const PORT = 5201;
const ROOT = path.join(__dirname, '..', '..', '..');
// zone-vein-4(-8.5, 8.5 · 반경 5) 의 중심 부근이되 뿜는 중인 zone-vein-1(-13.5, 13.5)
// 밖이다 — 거두어 가는 자리이고, **머물면 이 맥이 먼저 찬다** (중심까지 0.7 로 가장 가깝다).
const SPAWN = process.env.HKT_SPAWN || '-9,9';

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    // 빙원 안에서 시작한다 — 소프트웨어 GPU 에서는 프레임이 수 초씩 걸려 걷는 조작이
    // 이어지지 않는다. 세계의 규칙이 아니라 **처음 놓이는 자리**만 바꾼다 (vite.config.ts).
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HKT_SPAWN: SPAWN } },
  );
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (b) => {
      if (/localhost:\d+/.test(String(b))) resolve(child);
    });
    child.stderr.on('data', (b) => {
      if (process.env.FXLAB_TRACE) console.error('[vite]', String(b).trim());
    });
    child.on('exit', (code) => reject(new Error(`vite 가 떴다 말았다 (code ${code})`)));
    setTimeout(() => reject(new Error('vite 가 뜨지 않는다')), 60000);
  });
}

async function until(page, read, ok, tries) {
  let value = await read();
  for (let i = 0; i < tries && !ok(value); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    value = await read();
  }
  return value;
}

const panelText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.hud-panel, .hud-self, [class*="self"]')]
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

(async () => {
  const vite = await startVite();
  const browser = await launch();
  // 작게 잡는다 — 소프트웨어 GPU 에서 화면이 커지면 한 프레임이 수 초로 늘어나고,
  // 그동안 세계와의 이어짐이 굶어 끊긴다 (game-shot.js 가 400x300 을 쓰는 이유와 같다).
  const page = await browser.newPage({ viewport: { width: 560, height: 420 } });
  const errors = collectErrors(page);
  if (process.env.FXLAB_TRACE) page.on('console', (m) => console.error('[page]', m.text()));
  await page.goto(`http://localhost:${PORT}/`);

  // 세계가 붙을 때까지
  await until(page, () => panelText(page), (t) => /세계 시간/.test(t), 60);

  // 빙원(-11, 11)까지 **걸어간다.** 걷기가 이 Cycle 의 유일한 입력이다.
  //
  // 방향키는 세계의 축이 아니라 지금 보고 있는 쪽으로 간다 — 시점이 어디를
  // 향하는지 이 도구는 알지 못하므로, 네 대각을 차례로 밀어 보고 빙원에 닿는 것을 쓴다.
  // 거리 15.5 · moveSpeed 6/s 이므로 한 방향당 4초면 충분하다.
  // 겹침 표면이 열려 있으면 방향키가 삼켜진다 (app/main.ts — surfaces.capturing()).
  // 먼저 화면에 초점을 주고 열린 것을 닫는다.
  const canvas = await page.$('#game canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));
  }

  // 걷지 않는다 — HKT_SPAWN 이 이미 빙원 안에 세웠다 (위 startVite 주석).
  let inField = await until(page, () => panelText(page), (t) => /빙원/.test(t), 40);

  // 시점을 조금 내려 땅을 넓게 본다 — 범위를 눈으로 보려면 지면이 보여야 한다.
  // 한 번 누르는 키라 프레임이 느려도 이어진다 (걷는 조작과 다른 점이다).
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('KeyT');
    await new Promise((r) => setTimeout(r, 300));
  }

  // ── 열리기 전 ───────────────────────────────────────────────────────
  // 빙원 안에서 잠시 머문다 — 머무는 동안 줄어드는 것이 C-TERRAIN-001 의 요점이었다.
  if (/빙원/.test(inField)) await new Promise((r) => setTimeout(r, 2500));
  const before = await panelText(page);
  await page.screenshot({ path: path.resolve(outBefore) }).catch(() => {});

  // ── 머문다 — 그리고 발밑이 열리기를 기다린다 ────────────────────────
  // zone-vein-4 는 60 중 30 이 차 있고 rate 4.0 이므로 7.5초를 머물면 넘친다.
  // 조작은 하나도 하지 않는다 — **아무것도 하지 않는 것**이 이 Cycle 의 입력이다.
  const seen = [];
  let after = before;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    after = await panelText(page);
    seen.push(after);
    if (/돌려받는 중/.test(after)) break;
  }
  await page.screenshot({ path: path.resolve(outAfter) }).catch(() => {});
  // 두 장 중 뒤엣것을 기본 이름으로도 남긴다 (옛 호출부 호환)
  await page.screenshot({ path: path.resolve(out) }).catch(() => {});

  inField = after;
  const warmth = /온기 (\d+)\/(\d+)/.exec(before);
  const warmthAfter = /온기 (\d+)\/(\d+)/.exec(after);
  const real = errors.filter((e) => !e.includes('404'));

  console.log(`self 패널 (열리기 전): ${before}`);
  console.log(`self 패널 (열린 뒤):   ${after}`);
  console.log(`저장 ${path.resolve(outBefore)}`);
  console.log(`저장 ${path.resolve(outAfter)}`);

  // ①② (범위가 땅 위에 보인다)는 이 도구가 판정하지 않는다 — **사람이 그림을 본다.**
  // 색 맞추기로 자동 판정하면 채움이 18% 라 지형 초록과 21 단계밖에 안 벌어져,
  // 통과해도 통과의 뜻이 없고 실패해도 실패의 뜻이 없다. 저장된 그림이 그 판정의 자리다.
  const gates = [
    ['지금 걸린 법칙이 읽힌다 (③)', /빙원|해숨구멍/.test(before)],
    ['거두어 가는 중임이 읽힌다 (③)', /거두어 가는 중/.test(before)],
    ['지닌 열이 읽힌다 (④)', warmth !== null],
    ['열이 실제로 줄었다 (④)', warmth !== null && Number(warmth[1]) < Number(warmth[2])],
    // ⑦⑧ — 발밑이 열렸다. self 패널의 전이가 그 증거다: 거두어 가던 자리가 같은
    // 자리에서 돌려주는 자리가 되었고, 나는 한 걸음도 옮기지 않았다.
    ['머문 자리가 분출구가 되었다 (⑦)', /해숨구멍/.test(after)],
    ['열이 돌아온다 (⑧)', /돌려받는 중/.test(after)],
    ['돌아온 열이 실제로 늘었다 (⑧)',
      warmth !== null && warmthAfter !== null && Number(warmthAfter[1]) > Number(warmth[1])],
    ['페이지 오류 0', real.length === 0],
  ];
  // ⑤⑥ (자리 이름의 퍼센트가 오른다)는 이 도구가 판정하지 않는다 — 라벨이 캔버스 안에
  // 스프라이트로 그려져 DOM 에서 읽히지 않고, 그것을 읽으려면 엔진이 Render Plan 을
  // 밖으로 내주어야 한다(기반 변경). 결정 Layer 를 직접 돌리는 검사가 그 자리를 맡는다
  // (view/tests/terrain.spec.ts — '이름에 지금이 실린다').
  for (const [label, ok] of gates) console.log(`판정: ${label} → ${ok ? 'OK' : '실패'}`);
  if (real.length) console.log('오류:', real);
  const ok = gates.every(([, v]) => v);
  console.log(`판정: 종합 → ${ok ? 'OK' : '실패'}`);

  browser.close().catch(() => {});
  vite.kill('SIGKILL');
  setTimeout(() => process.exit(ok ? 0 : 1), 1500).unref();
})().catch((e) => { console.error(e); process.exit(1); });
