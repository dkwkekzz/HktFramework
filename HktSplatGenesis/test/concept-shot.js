// W3 검증 — 컨셉 대조 카드. 추출된 월드 게놈(JSON)을 파노라마로 렌더하고, 원본 컨셉 이미지와
// 나란히 한 장의 카드로 합성한다. "인상 일치"를 눈으로 판정하는 규격 산출물(preset-shot 확장).
//  ① 게놈이 W2 스타일 프로파일 울타리 안 (렌더 전 검증)
//  ② 좌(원본)·우(생성) 두 패널이 모두 내용이 있다 (빈 카드 아님)
//  ③ 콘솔/GPU 오류 0
//
// 사용: CHROMIUM_PATH=... node concept-shot.js <genome.json> <source-image> [out.png] [seed]
//   예: node concept-shot.js tools/world-extract/genomes/breeze-meadow.json /path/IMG.jpeg card.png
const fs = require('fs');
const path = require('path');
const { serve, launch, collectErrors, savePng } = require('./_common');
const T = require('../js/terrain-gen.js');
const WP = require('../js/world-profile.js');

const GENOME_PATH = process.argv[2];
const SRC_IMG = process.argv[3];
if (!GENOME_PATH || !SRC_IMG) { console.error('사용: node concept-shot.js <genome.json> <source-image> [out.png] [seed]'); process.exit(2); }
const LABEL = path.basename(GENOME_PATH, '.json');
const OUT = process.argv[4] || `${LABEL}-card.png`;
const SEED = parseInt(process.argv[5] || '7');
const EXT = 90, G = 384;
const PANEL_W = 640, PANEL_H = 760, CARD_W = PANEL_W * 2; // 카드 2패널

// 게놈 로드(_meta 제거) → 검증 → 파노라마 PLY
const raw = JSON.parse(fs.readFileSync(GENOME_PATH, 'utf8'));
const src = {}; for (const k in raw) if (k[0] !== '_') src[k] = raw[k];
const genome = Object.assign({ seed: SEED, extent: EXT }, src);
const val = WP.validate(genome);
console.log(`[${LABEL}] 스타일 프로파일: ${val.ok ? 'OK' : '반려 ' + JSON.stringify(val.violations)}`);
const ply = Buffer.from(T.create(genome).plyBytes(G, 1.7));
const srcBytes = fs.readFileSync(SRC_IMG);
const srcMime = SRC_IMG.endsWith('.png') ? 'image/png' : 'image/jpeg';

(async () => {
	const server = await serve(8142, {
		'/assets/worlds/concept-panorama.ply': (req, res) => {
			res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': ply.length }); res.end(ply);
		},
		'/assets/concept-source': (req, res) => {
			res.writeHead(200, { 'content-type': srcMime, 'content-length': srcBytes.length }); res.end(srcBytes);
		},
	});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: PANEL_W, height: PANEL_H } });
	const errors = collectErrors(page);
	await page.addInitScript(() => { window.__rafCbs = []; window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; }; });
	await page.goto('http://localhost:8142/?world=/assets/worlds/concept-panorama.ply&lod=0', { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld, null, { timeout: 60000, polling: 500 });
	} catch (e) { console.error('무대 로드 초과 — 오류:', errors); process.exit(1); }

	const CAM = { fov: 0.92, up: [0, 1, 0], target: [0, 0, 0], eye: [0, 58, 92] };
	for (let k = 0; k < 6; k++) {
		await page.evaluate((cm) => HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, 640, 760), CAM);
		await page.waitForTimeout(120);
	}

	// 파노라마 캡처 + 원본 이미지 로드 → 2패널 카드 합성
	const card = await page.evaluate(async (cfg) => {
		const { camEye, camFov, PANEL_W, PANEL_H } = cfg;
		const orbit = { fov: camFov, up: [0, 1, 0], target: [0, 0, 0], _eye: () => camEye };
		const panoUrl = HktGenesisStage.capture(orbit, PANEL_W, PANEL_H);
		const loadImg = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img load ' + u)); im.src = u; });
		const pano = await loadImg(panoUrl);
		const source = await loadImg('/assets/concept-source');
		const card = document.createElement('canvas'); card.width = PANEL_W * 2; card.height = PANEL_H;
		const g = card.getContext('2d');
		g.fillStyle = '#0b0d14'; g.fillRect(0, 0, card.width, card.height);
		// 좌: 원본(레터박스 fit) · 우: 생성 파노라마
		const sc = Math.min(PANEL_W / source.width, PANEL_H / source.height);
		const sw = source.width * sc, sh = source.height * sc;
		g.drawImage(source, (PANEL_W - sw) / 2, (PANEL_H - sh) / 2, sw, sh);
		g.drawImage(pano, PANEL_W, 0, PANEL_W, PANEL_H);
		// 라벨
		g.font = '20px sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)';
		g.fillText('컨셉 이미지 (입력)', 16, 30); g.fillText('생성 월드 (게놈 유도)', PANEL_W + 16, 30);
		// 우 패널 지형 픽셀 측정 (빈 카드 방지)
		const px = g.getImageData(PANEL_W, 0, PANEL_W, PANEL_H).data;
		let land = 0; for (let i = 0; i < PANEL_W * PANEL_H; i++) { const r = px[i * 4], gr = px[i * 4 + 1], b = px[i * 4 + 2]; if (!(r * 0.3 + gr * 0.5 + b * 0.2 < 24 && b >= r)) land++; }
		// 좌 패널 비배경 픽셀
		const sp = g.getImageData(0, 0, PANEL_W, PANEL_H).data;
		let srcPix = 0; for (let i = 0; i < PANEL_W * PANEL_H; i++) { const r = sp[i * 4], gr = sp[i * 4 + 1], b = sp[i * 4 + 2]; if (r + gr + b > 40) srcPix++; }
		return { dataUrl: card.toDataURL('image/png'), land, srcPix };
	}, { camEye: CAM.eye, camFov: CAM.fov, PANEL_W, PANEL_H });

	savePng(card.dataUrl, OUT);
	const real = errors.filter((e) => !e.includes('404'));
	const ok = val.ok && card.land > 30000 && card.srcPix > 30000 && real.length === 0;
	console.log(`저장: ${OUT} · 생성 패널 지형 ${card.land} · 원본 패널 픽셀 ${card.srcPix}`);
	console.log(`판정: 프로파일 ${val.ok} · 생성 내용 ${card.land > 30000} · 원본 내용 ${card.srcPix > 30000} · 오류 ${real.length} → ${ok ? 'OK' : '실패'}`);
	if (real.length) console.error('콘솔 오류:', real);
	await browser.close(); server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
