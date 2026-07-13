// ============================================================================
//  flesh-capture.mjs — 살(baked) 을 headless 브라우저로 실제 렌더해 캡처한다.
//
//  샌드박스 headless Chromium 은 **막혀 있지 않다** — SwiftShader(ANGLE/Vulkan)로
//  WebGL2 가 돈다. 따라서 시각 검증은 우리가 직접 수행한다(사용자에게 육안 확인을
//  떠넘기지 않는다). dist 를 정적 서빙 → Playwright 로 __hkt 훅을 몰아 baked 살을
//  5각도(참조 시트 배치)로 찍어 한 장의 몽타주 PNG 로 합친다.
//
//  선행: npm run build (dist 생성). 실행: node tools/flesh-capture.mjs [out.png] [preset] [model]
// ============================================================================
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const OUT = process.argv[2] || 'flesh-capture.png';
const PRESET = process.argv[3] || 'stylized-f';
const MODEL = process.argv[4] || 'Y Bot'; // 여성 베이스 (참조 시트가 여성)
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.fbx': 'application/octet-stream', '.png': 'image/png', '.jpeg': 'image/jpeg' };

// 본 비율(길이/골격) — 프리셋별. y-bot 은 실제 모델 비율을 따르므로 손대지 않음(전부 1).
const PROP_SET = {
  'stylized-f': { shoulder: 0.82, head: 0.86, leg: 1.14, torso: 1.0, arm: 0.96 },
};
const PROPS = PROP_SET[process.argv[3]] || {};

// dist 정적 서버 (공백 파일명 대응: decodeURIComponent)
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const buf = await readFile(join('dist', normalize(p)));
    res.setHeader('Content-Type', CT[extname(p)] || 'application/octet-stream');
    res.end(buf);
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 300, height: 760, deviceScaleFactor: 2 } });
page.on('pageerror', e => console.log('PAGEERR:', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__hkt && window.__hkt.ready && window.__hkt.ready(), null, { timeout: 30000 });

// 여성 베이스로 교체 → 프리셋·본 비율 적용 → baked 굽기 → 캡처 모드
const stats = await page.evaluate(async ({ preset, model, props }) => {
  const h = window.__hkt;
  const m = h.MODELS.find(x => x.label === model);
  if (m) { await h.switchModel(m); }
  await new Promise(r => setTimeout(r, 300));
  h.setPreset(preset);
  for (const k in props) h.setProp(k, props[k]);
  h.setFleshMode('baked');
  h.captureMode(true);
  return h.bakeNow();
}, { preset: PRESET, model: MODEL, props: PROPS });
console.log(`baked: 정점 ${stats.vCount} · 삼각형 ${stats.tris} · 실루엣 변화 ${(stats.bboxGrow * 100).toFixed(1)}%`);

const views = [['front', 'Front'], ['3q', '3/4 Front'], ['side', 'Side'], ['3qback', '3/4 Back'], ['back', 'Back']];
const shots = [];
for (const [v, label] of views) {
  await page.evaluate(vn => window.__hkt.camView(vn), v);
  await page.waitForTimeout(180); // 프레임 몇 개 렌더 대기
  const buf = await page.screenshot();
  shots.push({ label, dataurl: 'data:image/png;base64,' + buf.toString('base64') });
}

// 참조 시트처럼 5열 몽타주 합성 (2D 캔버스 — WebGL 아님, toDataURL 안정)
const montage = await page.evaluate(async ({ shots, title, preset }) => {
  const imgs = await Promise.all(shots.map(s => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = s.dataurl; })));
  const colW = 200, colH = Math.round(colW * imgs[0].height / imgs[0].width), pad = 8, top = 44;
  const cv = document.createElement('canvas');
  cv.width = imgs.length * (colW + pad) + pad; cv.height = colH + top + pad;
  const g = cv.getContext('2d');
  g.fillStyle = '#e9ecf0'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#2a2f36'; g.font = '20px sans-serif'; g.textAlign = 'left';
  g.fillText(title, pad, 28);
  g.font = '14px sans-serif'; g.textAlign = 'center';
  imgs.forEach((im, i) => {
    const x = pad + i * (colW + pad);
    g.drawImage(im, x, top, colW, colH);
    g.fillStyle = '#4a5560'; g.fillText(shots[i].label, x + colW / 2, top - 8);
  });
  return cv.toDataURL('image/png');
}, { shots, title: `HktCharacter · baked flesh · preset "${PRESET}" · ${MODEL}`, preset: PRESET });

await writeFile(OUT, Buffer.from(montage.split(',')[1], 'base64'));
console.log('저장:', OUT);
await browser.close();
server.close();
