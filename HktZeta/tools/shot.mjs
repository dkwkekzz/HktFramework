// 눈으로 보는 검증(3D) — 헤드리스 Chromium 으로 세 시점을 스크린샷으로 굳힌다.
// core 가 Scene 을 굳히고, 브라우저가 그것만 소비해 그린 결과를 PNG 로 회귀 보존한다.
// 사용: node tools/shot.mjs [seed] [ticks] [count]
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { buildScene } from '../render/viewmodel.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = 8137;
const VIEWS = ['field', 'terrain', 'worm'];

const seed = Number(process.argv[2] ?? 7);
const ticks = Number(process.argv[3] ?? 400);
const count = Number(process.argv[4] ?? 8);

// 1) Scene 을 굳힌다(core 권위)
const scene = buildScene(seed, ticks, count);
writeFileSync(join(ROOT, 'render', 'scene.json'), JSON.stringify(scene));
console.log(`scene: bodies=${scene.bodies.length} trails=${scene.trails.length}×${scene.trails[0].length} terrain=${scene.terrain.W}²`);

// 2) 정적 서버 기동
const server = spawn(process.execPath, [join(HERE, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
const shotsDir = join(HERE, 'shots');
mkdirSync(shotsDir, { recursive: true });

async function waitServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/three.module.js`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not come up');
}

(async () => {
  await waitServer();
  const gRoot = execSync('npm root -g').toString().trim();
  const { chromium } = require(join(gRoot, 'playwright'));
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('  ⚠ pageerror:', e.message));

  for (const view of VIEWS) {
    await page.goto(`http://localhost:${PORT}/render/?view=${view}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 350)); // 첫 프레임 안정화
    const file = join(shotsDir, `hktzeta-${view}.png`);
    await page.screenshot({ path: file });
    console.log(`  ✅ ${view} → ${file}`);
  }
  await browser.close();
  server.kill();
})().catch((e) => { console.error('shot 실패:', e.message); server.kill(); process.exit(1); });
