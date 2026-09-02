// 게임 전 경로 검증 — 세계에서 일어난 일이 이펙트를 켜는 자리까지 실제로 닿는가.
//
// overlay-shot.js 가 이펙트 층 하나만 세워 산수를 본다면, 여기서는 게임을 통째로 띄운다:
// 세계(같은 프로세스 안 world 서버) → 관찰 결과 → 결정 Layer → 렌더러 → 이펙트 오버레이.
// NPC 가 스스로 다가와 치므로 조작 없이도 타격 사건이 일어난다 (이후).
//
// 판정
//   ① 캔버스 둘   — 세계(three)와 이펙트(WebGPU)가 겹쳐 있고, 오버레이는 조작을 가로채지 않는다
//   ② 세계가 붙는다 — HUD 에 세계 시간이 흐른다
//   ③ 사건이 온다  — 타격 결과가 화면에 뜬다 (= 결정 Layer 가 이펙트 지시를 낸 프레임이다)
//   ④ 오류 0
//
// 이펙트 픽셀은 여기서 재지 않는다 — 소프트웨어 GPU 에서 three 와 스플랫을 한 프로세스에
// 올리면 프레임이 수 초씩 걸려 순간을 잡을 수 없다. 그림의 판정은 overlay-shot.js 의 몫이다.
//
// 사용: node game-shot.js [png=game.png]
const path = require('path');
const { spawn } = require('node:child_process');
const { launch, collectErrors } = require('./_common');

const [out = 'game.png'] = process.argv.slice(2);
const PORT = 5200;
const ROOT = path.join(__dirname, '..', '..', '..');

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
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

// 조건이 설 때까지 초 단위로 되묻는다 — 소프트웨어 GPU 에서는 한 프레임이 길다.
async function until(page, read, ok, tries) {
  let value = await read();
  for (let i = 0; i < tries && !ok(value); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    value = await read();
  }
  return value;
}

(async () => {
  const vite = await startVite();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const errors = collectErrors(page);
  if (process.env.FXLAB_TRACE) page.on('console', (m) => console.error('[page]', m.text()));
  await page.goto(`http://localhost:${PORT}/`);

  const canvases = await until(
    page,
    () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#game canvas')].map((c) => ({
          width: c.width,
          height: c.height,
          pointerEvents: getComputedStyle(c).pointerEvents,
        })),
      ),
    (list) => list.length >= 2,
    60,
  );

  const worldTime = await until(
    page,
    () => page.evaluate(() => document.querySelector('.hud-panel')?.textContent ?? ''),
    (text) => /세계 시간/.test(text),
    30,
  );

  // 타격 — NPC 가 다가와 칠 때까지 기다린다. 조작하지 않는다.
  const strikes = await until(
    page,
    () => page.evaluate(() => document.querySelectorAll('.hud-strike').length),
    (n) => n > 0,
    60,
  );

  await page.screenshot({ path: path.resolve(out) }).catch(() => {});

  const real = errors.filter((e) => !e.includes('404'));
  console.log(`캔버스: ${JSON.stringify(canvases)}`);
  console.log(`HUD: ${worldTime.replace(/\s+/g, ' ').trim()}`);
  console.log(`떠 있는 타격 결과: ${strikes} · 저장 ${path.resolve(out)}`);

  const overlay = canvases[1];
  const gates = [
    ['세계와 이펙트가 겹쳐 있다 (캔버스 둘)', canvases.length === 2],
    ['이펙트가 조작을 가로채지 않는다', overlay?.pointerEvents === 'none'],
    ['두 캔버스의 크기가 같다',
      overlay?.width === canvases[0]?.width && overlay?.height === canvases[0]?.height],
    ['세계가 붙는다 (세계 시간이 온다)', /세계 시간/.test(worldTime)],
    ['사건이 온다 (타격 결과가 뜬다)', strikes > 0],
    ['페이지 오류 0', real.length === 0],
  ];
  for (const [label, ok] of gates) console.log(`판정: ${label} → ${ok ? 'OK' : '실패'}`);
  if (real.length) console.log('오류:', real);
  const ok = gates.every(([, v]) => v);
  console.log(`판정: 종합 → ${ok ? 'OK' : '실패'}`);

  // 정리는 기다리지 않는다 — 소프트웨어 GPU 가 밀린 프레임을 다 게울 때까지 붙잡히면
  // 판정이 끝난 뒤에도 프로세스가 돌아오지 않는다.
  browser.close().catch(() => {});
  vite.kill('SIGKILL');
  setTimeout(() => process.exit(ok ? 0 : 1), 1500).unref();
})().catch((e) => { console.error(e); process.exit(1); });
