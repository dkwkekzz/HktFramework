// P0.5 눈 검증 — 존 게임 뷰를 헤드리스로 열어 사냥/채집 순간을 캡처한다.
// 실행: node demo/shot-play.mjs  (playwright-core + /opt/pw-browsers chromium)
import { chromium } from 'playwright-core';
import { startServer } from './server.js';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function main() {
  const srv = await startServer(0);
  const browser = await chromium.launch({ executablePath: EXE });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
    await page.goto(`${srv.url}/play.html?name=사냥꾼`, { waitUntil: 'domcontentloaded' });
    // 첫 폴링 + 존 렌더 대기
    await page.waitForFunction(() => window.STATE && window.STATE.zone && window.STATE.zone.entities.length, { timeout: 8000 });

    // 가까운 권속을 향해 이동 + 공격 명령 (사람 클릭을 스크립트로 재현)
    await page.evaluate(async () => {
      const me = window.localStorage.getItem('hktadv-player');
      const post = (p, b) => fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      const s = window.STATE;
      const mob = s.zone.entities.find((e) => e.kind === 'mob' && e.archetype === '권속');
      if (mob) { await post('/api/play/cmd', { id: me, cmd: 'moveTo', x: mob.x - 40, y: mob.y }); }
    });
    await page.waitForTimeout(4000); // 이동
    await page.evaluate(async () => {
      const me = window.localStorage.getItem('hktadv-player');
      const post = (p, b) => fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      const s = window.STATE;
      const mob = s.zone.entities.find((e) => e.kind === 'mob' && e.archetype === '권속');
      if (mob) await post('/api/play/cmd', { id: me, cmd: 'attack', target: mob.id });
    });
    await page.waitForTimeout(2500); // 교전(데미지 플로터)
    await page.screenshot({ path: 'shot-play-hunt.png' });
    console.log('[shot] shot-play-hunt.png — 사냥 순간(HP바·데미지 플로터·존 게임 뷰)');
  } finally {
    await browser.close();
    await srv.close();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
