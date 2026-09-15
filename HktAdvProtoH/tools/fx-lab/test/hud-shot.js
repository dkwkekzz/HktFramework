// HUD 자리 검증 — **패널이 서로 위에 포개지지 않는다**를 눈이 아니라 수로 닫는다.
//
// game-shot.js 가 이펙트 경로를, terrain-shot.js 가 지면 구역을 보는 자리라면
// 여기서는 **자리판**을 본다 (engine/view-kernel/hud/hud-layout.ts).
// 게임을 통째로 띄우고, 자리판에 놓인 것들의 화면 사각형을 재어 둘씩 겹쳐 본다.
//
// 판정
//   ① 자리판에 놓인 것들이 서로 겹치지 않는다 (한 픽셀도)
//   ② 놓인 것이 화면 밖으로 나가지 않는다
//   ③ 폭마다 그렇다 — 넓은 창 · 좁은 창 · 손가락 기기
//
// 재는 것은 **보이는 사각형**이다 — 요소의 상자를 자기 자리(region)와 겹쳐 자른 것.
// 자리가 잘라 내는 부분은 화면에 없으므로 겹침도 아니다. 대신 자리 밖으로 얼마나
// 밀려 났는지는 따로 센다 (③ 자리 안) — 그것은 겹침이 아니라 **담을 것이 자리보다
// 많다**는 신호이고, 줄 수를 줄이는 일은 팩(VIEW 레인)의 몫이다.
//
// 겹침은 배치의 실수가 아니라 **불가능**이어야 한다. 세계가 자라 패널의 줄이 늘어도
// (26 Cycle 이 지나 self 패널은 서른 줄이 되었다) 이 검사가 계속 참이어야 한다.
//
// 사용: node hud-shot.js [png=hud.png]
const path = require('path');
const { spawn } = require('node:child_process');
const { launch, collectErrors } = require('./_common');

const [out = 'hud.png'] = process.argv.slice(2);
const PORT = 5202;
const ROOT = path.join(__dirname, '..', '..', '..');

// 재어 볼 화면 셋 — 검증 그림이 쓰는 좁은 창(terrain-shot 과 같은 560×420)이 첫째다.
// 겹침이 처음 보고된 자리가 거기이기 때문이다 (C-TERRAIN-002 · C-TERRAIN-003 의 08).
const SCREENS = [
  { name: 'narrow', width: 560, height: 420 },
  { name: 'wide', width: 1280, height: 800 },
  { name: 'touch', width: 820, height: 480, hasTouch: true, isMobile: true },
];

/** 띄운 무리를 통째로 거둔다 — 남은 vite 가 다음 판의 포트를 잡고 있지 않게 */
function stop(child) {
  try {
    process.kill(-child.pid);
  } catch {
    child.kill();
  }
}

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(PORT), '--strictPort'],
    // 볼 것이 많은 자리에서 잰다 — 땅의 줄까지 실려야 패널이 제일 길어진다.
    // detached 로 띄우는 이유는 끝낼 때 무리째 거두기 위해서다 — npx 만 죽이면
    // 그 아래 vite 가 남아 다음 판이 포트를 못 잡는다.
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, HKT_SPAWN: process.env.HKT_SPAWN || '-9,9' },
    },
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

// 자리판에 놓인 것들의 사각형 — 이 도구는 무엇이 놓였는지 알지 못한다.
// 자리판이 놓은 것 전부를 그대로 잰다 (새 패널이 생기면 검사도 따라 는다).
const readRects = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#hud-layout .hl-region > *')]
      .map((node) => {
        const box = node.getBoundingClientRect();
        // 자리가 잘라 낸 뒤 남는 것이 실제로 보이는 것이다 (자리는 overflow:hidden)
        const clip = node.parentElement.getBoundingClientRect();
        const x = Math.max(box.x, clip.x);
        const y = Math.max(box.y, clip.y);
        const right = Math.min(box.x + box.width, clip.x + clip.width);
        const bottom = Math.min(box.y + box.height, clip.y + clip.height);
        return {
          name: node.id || node.className,
          x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y),
          // 자리 밖으로 밀려난 만큼 — 겹침은 아니지만 담을 것이 자리보다 많다는 뜻이다
          spillX: Math.round(Math.max(0, box.width - (right - x))),
          spillY: Math.round(Math.max(0, box.height - (bottom - y))),
          text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30),
        };
      })
      .filter((r) => r.w > 0.5 && r.h > 0.5),
  );

function overlaps(rects) {
  const found = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) found.push(`${a.name} ↔ ${b.name} (${Math.round(ox)}×${Math.round(oy)}px)`);
    }
  }
  return found;
}

function outside(rects, screen) {
  return rects
    .filter((r) => r.x < -0.5 || r.y < -0.5 || r.x + r.w > screen.width + 0.5 || r.y + r.h > screen.height + 0.5)
    .map((r) => `${r.name} (x ${Math.round(r.x)} y ${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)})`);
}

(async () => {
  const vite = await startVite();
  const browser = await launch();
  const failures = [];

  for (const screen of SCREENS) {
    const page = await browser.newPage({
      viewport: { width: screen.width, height: screen.height },
      hasTouch: screen.hasTouch ?? false,
      isMobile: screen.isMobile ?? false,
    });
    const errors = collectErrors(page);
    if (process.env.FXLAB_TRACE) page.on('console', (m) => console.error('[page]', m.text()));
    await page.goto(`http://localhost:${PORT}/`);

    // 세계가 붙고 패널이 다 실릴 때까지 — 붙기 전의 빈 패널은 겹칠 수가 없다
    let rects = [];
    for (let i = 0; i < 60; i++) {
      rects = await readRects(page);
      if (rects.some((r) => /세계 시간|온기|HP/.test(r.text))) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    // 몇 프레임 더 — 소지품·기술 줄이 늦게 실린다
    await new Promise((r) => setTimeout(r, 4000));
    rects = await readRects(page);

    const png = out.replace(/\.png$/, `-${screen.name}.png`);
    await page.screenshot({ path: path.resolve(png) }).catch(() => {});

    console.log(`\n[${screen.name}] ${screen.width}×${screen.height}${screen.hasTouch ? ' (손가락)' : ''} → ${png}`);
    for (const r of rects) {
      console.log(`  ${String(r.name).padEnd(14)} x=${Math.round(r.x)} y=${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}  "${r.text}"`);
    }

    const hit = overlaps(rects);
    const out0 = outside(rects, screen);
    const spilled = rects
      .filter((r) => r.spillX > 1 || r.spillY > 1)
      .map((r) => `${r.name} (밖 ${r.spillX}×${r.spillY}px)`);
    console.log(`  ① 겹침      ${hit.length === 0 ? 'PASS — 없음' : `FAIL — ${hit.join(' · ')}`}`);
    console.log(`  ② 화면 안   ${out0.length === 0 ? 'PASS' : `FAIL — ${out0.join(' · ')}`}`);
    console.log(`  ③ 자리 안   ${spilled.length === 0 ? 'PASS' : `⚠ 자리보다 담을 것이 많다 — ${spilled.join(' · ')}`}`);
    if (rects.length === 0) console.log('  ⚠ 잰 것이 없다 — 세계가 붙지 않았거나 자리판이 서지 않았다');

    if (hit.length) failures.push(`${screen.name}: 겹침 ${hit.join(' · ')}`);
    if (out0.length) failures.push(`${screen.name}: 화면 밖 ${out0.join(' · ')}`);
    if (rects.length === 0) failures.push(`${screen.name}: 잰 것이 없다`);
    const real = errors.filter((e) => !e.includes('404'));
    if (real.length) console.log(`  ⚠ 콘솔 오류 ${real.length} — ${real[0]}`);

    await page.close();
  }

  await browser.close();
  stop(vite);
  console.log(`\n${failures.length === 0 ? '전부 PASS — 패널은 서로 포개지지 않는다' : `FAIL ${failures.length}\n  ${failures.join('\n  ')}`}`);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
