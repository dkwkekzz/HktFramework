// 이펙트 오버레이 검증 — engine/view-kernel/fx/effect-layer.ts 가 *게임 쪽에서* 성립하는가.
//
// 랩 하니스(fx-shot.js)는 스플랫 엔진을 직접 구동한다. 게임에서 새로 생긴 것은 그 위의 한 겹 —
// 세계 캔버스 위에 투명하게 겹치고, 게임 좌표를 이펙트 공간으로 옮기고, 투영을 WebGPU
// 규약으로 다시 만드는 층이다. 그 겹이 하는 일을 픽셀로 판정한다.
//
// 판정
//   ① 뜬다     — 층이 부팅하고 캔버스가 컨테이너에 붙는다
//   ② 투명하다 — 아무 일도 없을 때 오버레이는 완전히 비어 있다 (뒤의 세계를 가리지 않는다)
//   ③ 그린다   — 이펙트를 켜면 그 자리에 불투명한 픽셀이 생긴다
//   ④ 가운데다 — 그 픽셀들의 무게중심이 발생점의 화면 좌표 근처다
//                 (뷰 스케일·투영을 잘못 만들면 어긋나거나 통째로 잘려 나간다)
//   ⑤ 오류 0
//
// vite dev 서버가 필요하다 (TypeScript 를 그대로 읽는다). 이 스크립트가 직접 띄운다.
// 사용: node overlay-shot.js [png=overlay.png]
const path = require('path');
const { spawn } = require('node:child_process');
const { launch, collectErrors, savePng } = require('./_common');

const [out = 'overlay.png'] = process.argv.slice(2);
const PORT = 5199;
const ROOT = path.join(__dirname, '..', '..', '..');

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((resolve, reject) => {
    const done = (line) => {
      if (/localhost:\d+/.test(line)) resolve(child);
    };
    child.stdout.on('data', (b) => done(String(b)));
    child.stderr.on('data', (b) => {
      if (process.env.FXLAB_TRACE) console.error('[vite]', String(b).trim());
    });
    child.on('exit', (code) => reject(new Error(`vite 가 떴다 말았다 (code ${code})`)));
    setTimeout(() => reject(new Error('vite 가 뜨지 않는다')), 60000);
  });
}

(async () => {
  const vite = await startVite();
  const browser = await launch();
  // 작은 창 — 소프트웨어 GPU 에서 면적은 그대로 대기 시간이다 (lab-smoke.js 주석)
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  const errors = collectErrors(page);
  if (process.env.FXLAB_TRACE) {
    page.on('console', (m) => console.error('[page]', m.text()));
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  }
  await page.goto(`http://localhost:${PORT}/tools/fx-lab/overlay/index.html`);

  await page.waitForFunction(
    'window.__overlayReady === true || window.__overlayFailed !== undefined',
    null,
    { timeout: 120000 },
  );
  const failed = await page.evaluate(() => window.__overlayFailed);
  if (failed) {
    console.error('이펙트 층이 뜨지 않았다:', failed);
    await browser.close();
    vite.kill();
    process.exit(1);
  }

  const canvases = await page.evaluate(() => {
    const list = [...document.querySelectorAll('#stage canvas')];
    return list.map((c) => ({
      width: c.width,
      height: c.height,
      clientWidth: c.clientWidth,
      clientHeight: c.clientHeight,
      pointerEvents: getComputedStyle(c).pointerEvents,
    }));
  });

  // 한 프레임 촬영 — 복사는 층이 제 프레임 안에서 건다 (effect-layer.snapshot).
  // 밖에서 WebGPU 캔버스를 2D 로 그려 읽으면(drawImage) 헤드리스 합성기에서는 빈 그림이다.
  const shoot = () => page.evaluate(() => window.__shoot());

  const names = await page.evaluate(() => window.__names());
  const activeQuiet = await page.evaluate(() => window.__activeEffects());
  const quiet = await shoot();
  // 세는 것은 켠 *직후*여야 한다 — 촬영을 기다리는 동안 수명(0.24s)이 지나간다.
  const activeStruck = await page.evaluate(() => {
    window.__fire('타격');
    return window.__activeEffects();
  });
  const struck = await shoot();
  console.log(`장면의 이펙트: ${names.join(' · ')}`);
  console.log(`살아 있는 이벤트: 정적 ${activeQuiet} → 발생 직후 ${activeStruck}`);
  savePng(struck.dataUrl, path.resolve(out));

  // 발생점(0, 1.4, 0)의 화면 좌표 — 카메라가 그 자리를 겨누고 있으므로 화면 한가운데다.
  const centerX = struck.w / 2;
  const centerY = struck.h / 2;

  console.log(`캔버스: ${JSON.stringify(canvases)}`);
  console.log(`정적   불투명 ${quiet.lit}`);
  console.log(`타격   불투명 ${struck.lit} · 무게중심 (${struck.cx.toFixed(0)}, ${struck.cy.toFixed(0)})`
    + ` · 화면 중앙 (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) · 저장 ${path.resolve(out)}`);

  const real = errors.filter((e) => !e.includes('404'));
  const gates = [
    ['캔버스가 겹쳐 붙는다', canvases.length === 1 && canvases[0].width > 0],
    ['조작을 가로채지 않는다 (pointer-events: none)', canvases[0]?.pointerEvents === 'none'],
    ['정적일 때 완전히 투명하다 (뒤의 세계를 가리지 않는다)', quiet.lit === 0],
    ['이펙트가 켜진다 (살아 있는 이벤트 ≥ 1)', activeQuiet === 0 && activeStruck >= 1],
    ['이펙트가 그려진다 (불투명 픽셀 > 300)', struck.lit > 300],
    ['발생점 자리에 그려진다 (무게중심이 화면 중앙 ±25%)',
      Math.abs(struck.cx - centerX) < struck.w * 0.25 && Math.abs(struck.cy - centerY) < struck.h * 0.25],
    ['페이지 오류 0', real.length === 0],
  ];
  for (const [label, ok] of gates) console.log(`판정: ${label} → ${ok ? 'OK' : '실패'}`);
  if (real.length) console.log('오류:', real);
  const ok = gates.every(([, v]) => v);
  console.log(`판정: 종합 → ${ok ? 'OK' : '실패'}`);
  await browser.close();
  vite.kill();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
