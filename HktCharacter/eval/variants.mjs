// ===========================================================================
//  HktCharacter · variants — 본 스케일 커스터마이징 변형 체형 눈 검증 CLI
//
//  본 스케일(다리/팔/몸통/머리/어깨)을 조합한 변형 체형들을 정점 메시 모드로
//  빌드해 A-포즈 + 걷기 위상 스크린샷을 찍는다. 커스터마이징의 회귀 항목:
//    · 힙 이음(웰드 곡선)이 다리 길이를 따라오는가 (hipBlend 허벅지 비례)
//    · fit-mesh 잔차가 올바른 높이에 내려앉는가 (랜드마크 y 리맵)
//    · 뼈를 늘였을 때/걷기 굽힘에서 면 튐·웰드 파탄·이중 바인딩 찢어짐
//  eval 게이트는 레퍼런스 시트 전용이라 변형에는 적용 불가 — 이 도구는 눈 검증
//  + 간이 기하 sanity(링 폭의 행간 연속성, NaN)만 본다.
//
//  실행:  node eval/variants.mjs            (전 변형)
//         node eval/variants.mjs longlegs   (한 변형만)
//  산출:  eval/out/variants/<name>-{apose,walk1,walk2}.png + 콘솔 sanity 표
// ===========================================================================
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChromium, ensureServer } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out', 'variants');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

const VARIANTS = {
  base:      {},
  longlegs:  { legs: 1.3 },
  shortlegs: { legs: 0.72 },
  longtorso: { torso: 1.3 },
  bighead:   { head: 1.4 },
  wideshld:  { shoulders: 1.4 },
  lanky:     { legs: 1.22, arms: 1.25, torso: 1.1, shoulders: 0.92 },
  compact:   { legs: 0.78, arms: 0.85, torso: 0.9, head: 1.25, shoulders: 1.1 },
};
const only = process.argv[2];
const names = only ? [only] : Object.keys(VARIANTS);
// 걷기 위상: ph = poseT·speed·4 — π/2(최대 보폭), π·¾(교차 직전 굽힘)
const WALK_TS = [Math.PI / 8, Math.PI * 3 / 16];

const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 520 } });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 1; });
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    h.st.speed = 0;
  });
  const canvas = await page.$('#app canvas');
  const frame = () => page.evaluate(() => new Promise(res => {
    window.__hkt.st.pause = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__hkt.st.pause = true; res(); }));
  }));
  const shoot = async file => { await frame(); writeFileSync(join(OUT, file), await canvas.screenshot()); };

  const report = [];
  for (const name of names) {
    if (!(name in VARIANTS)) { console.error(`미지의 변형: ${name}`); process.exitCode = 1; break; }
    // 변형 빌드 (본 스케일 → 리그+메시 재빌드) — A-포즈에서 굽는다
    await page.evaluate(v => {
      const h = window.__hkt;
      h.st.clip = 'apose'; h.st.speed = 0; h.st.poseT = 0;
      h.setBoneScales({ legs: 1, arms: 1, torso: 1, head: 1, shoulders: 1, ...v });
      h.setFleshMode(true);
      h.st.az = 0.5; h.st.el = 0.02; h.st.dist = 3.6; h.target.y = 0.95;
    }, VARIANTS[name]);
    await shoot(`${name}-apose.png`);
    // 걷기 위상 2컷 (3/4 후면 — 힙 이음·무릎이 같이 보이는 각)
    for (let i = 0; i < WALK_TS.length; i++) {
      await page.evaluate(t => {
        const h = window.__hkt;
        h.st.clip = 'walk'; h.st.speed = 1; h.st.poseT = t;
        h.st.az = 2.5; h.st.el = -0.05;
      }, WALK_TS[i]);
      await shoot(`${name}-walk${i + 1}.png`);
    }
    // 간이 기하 sanity: 링 폭(xMax−xMin)의 행간 급변(>4cm)·NaN — 면 튐 지표
    const sane = await page.evaluate(() => {
      const rings = window.__hkt.fleshStats.rings;
      let nan = 0, spikes = 0;
      const byChain = new Map();
      for (const r of rings) {
        if (![r.y, r.xMin, r.xMax, r.zMin, r.zMax].every(Number.isFinite)) { nan++; continue; }
        const k = r.fit + ':' + r.side;
        if (!byChain.has(k)) byChain.set(k, []);
        byChain.get(k).push(r);
      }
      for (const rs of byChain.values()) {
        for (let i = 1; i < rs.length; i++) {
          const w0 = rs[i - 1].xMax - rs[i - 1].xMin, w1 = rs[i].xMax - rs[i].xMin;
          if (Math.abs(w1 - w0) > 0.04) spikes++;
        }
      }
      return { nan, spikes, verts: window.__hkt.fleshStats.verts };
    });
    report.push({ name, ...sane });
    console.log(`${name.padEnd(10)} verts ${sane.verts}  NaN ${sane.nan}  폭 스파이크 ${sane.spikes}`);
  }
  // 기본 체형 복원 (상주 페이지 재사용 대비)
  await page.evaluate(() => window.__hkt.setBoneScales({ legs: 1, arms: 1, torso: 1, head: 1, shoulders: 1 }));
  console.log(`저장: eval/out/variants/ (${names.length}개 변형 × ${1 + WALK_TS.length}컷)`);
} finally {
  await browser.close();
  server.proc?.kill();
}
