// W1 시각 검증 — 이름 붙은 월드 프리셋(게놈)을 즉석 파노라마로 렌더한다.
// biome-shot 의 렌더 절반을 프리셋 인자로 일반화 — W3(concept-shot)의 원형이다.
// 파노라마 PLY 는 create(preset) 로 브라우저 없이 굽고, Spark 무대로 로드해 조감 촬영.
//
// 인자: 내장 프리셋 이름(temperate/ashen) 또는 게놈 JSON 파일 경로(.json) — W4 추출기 산출물.
// 사용: CHROMIUM_PATH=... node preset-shot.js <preset|genome.json> [out.png] [seed]
//   예: node preset-shot.js ashen ashen.png 7
//       node preset-shot.js ../tools/world-extract/genomes/breeze-meadow.json out.png
const fs = require('fs');
const path = require('path');
const { serve, launch, collectErrors, savePng } = require('./_common');
const T = require('../js/env/terrain-gen.js');
const WP = require('../js/env/world-profile.js');

const ARG = process.argv[2] || 'ashen';
const IS_JSON = ARG.endsWith('.json');
const LABEL = IS_JSON ? path.basename(ARG, '.json') : ARG;
const OUT = process.argv[3] || `${LABEL}.png`;
const SEED = parseInt(process.argv[4] || '7');
const EXT = 90, G = 384;

// 게놈 소스: JSON 파일이면 로드(렌더 무관 _meta 키 제거), 아니면 내장 프리셋.
let src;
if (IS_JSON) {
	const raw = JSON.parse(fs.readFileSync(ARG, 'utf8'));
	src = {}; for (const k in raw) if (!k.startsWith('_')) src[k] = raw[k];
} else {
	src = T.preset(ARG);
}
// 게놈 → 파노라마 PLY (즉석). biomeSet/water/relief 전부 게놈에서. genome.seed 가 있으면 우선.
const genome = Object.assign({ seed: SEED, extent: EXT }, src);

// W2: 게놈이 스타일 프로파일 울타리 안인지 검증 (JSON 추출물 전용 — 내장 프리셋은 통과 자명).
let profileOk = true;
if (IS_JSON) {
	const val = WP.validate(genome);
	profileOk = val.ok;
	console.log(`[${LABEL}] 스타일 프로파일: ${val.ok ? 'OK' : '반려 ' + JSON.stringify(val.violations)}`);
}
const W = T.world(genome);
const ply = Buffer.from(T.create(genome).plyBytes(G, 1.7));

(async () => {
	// 지상 진리: 이 프리셋의 바이옴 분포 (렌더 없이도 성격 확인)
	const hist = {};
	const SPREAD = EXT * 0.875;
	for (let i = 0; i < 8000; i++) {
		const x = -SPREAD + (i % 90) / 90 * 2 * SPREAD;
		const z = -SPREAD + ((i * 13) % 90) / 90 * 2 * SPREAD;
		const b = W.biomeAt(x, z);
		hist[b.key] = (hist[b.key] || 0) + 1;
	}
	console.log(`[${LABEL}] 바이옴 분포: ${JSON.stringify(hist)} · 스플랫 ${G * G} · ${(ply.length / 1e6).toFixed(2)}MB`);

	const server = await serve(8139, {
		'/assets/worlds/preset-panorama.ply': (req, res) => {
			res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': ply.length });
			res.end(ply);
		},
	});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
	});
	await page.goto('http://localhost:8139/?world=/assets/worlds/preset-panorama.ply&lod=0', { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('무대 로드 대기 초과 — 콘솔 오류:', errors);
		process.exit(1);
	}

	// W6: 게놈 대기(mood)를 무대 하늘 돔에 배선 (ashen=붉은 하늘, temperate=파란 하늘).
	await page.evaluate((mood) => { if (mood && window.HktGenesisStage.setMood) window.HktGenesisStage.setMood(mood); }, genome.mood || null);

	const CAM = { fov: 0.92, up: [0, 1, 0], target: [0, 0, 0], eye: [0, 58, 92] };
	for (let k = 0; k < 6; k++) {
		await page.evaluate((cm) => HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, 768, 640), CAM);
		await page.waitForTimeout(120);
	}
	const shot = await page.evaluate((cm) => {
		const orbit = { fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye };
		const Wd = 768, H = 640;
		const url = HktGenesisStage.capture(orbit, Wd, H);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = Wd; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0, Wd, H);
				const px = g.getImageData(0, 0, Wd, H).data;
				let r = 0, gr = 0, b = 0, land = 0;
				for (let i = 0; i < Wd * H; i++) {
					const R = px[i * 4], Gc = px[i * 4 + 1], B = px[i * 4 + 2];
					const lum = R * 0.3 + Gc * 0.5 + B * 0.2;
					if (lum < 24 && B >= R) continue;
					r += R; gr += Gc; b += B; land++;
				}
				resolve({ dataUrl: c.toDataURL('image/png'), mean: [r / land, gr / land, b / land], land });
			};
			img.onerror = () => resolve({ err: 'capture 이미지 로드 실패' });
			img.src = url;
		});
	}, CAM);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, OUT);
	const m = shot.mean.map((v) => Math.round(v));
	console.log(`저장: ${OUT} · 지형 픽셀 ${shot.land} · 렌더 평균 RGB [${m.join(',')}]`);
	const real = errors.filter((e) => !e.includes('404'));
	const ok = shot.land > 40000 && real.length === 0 && profileOk;
	console.log(`판정: 렌더 픽셀 충분 ${shot.land > 40000} · 콘솔오류 ${real.length} · 프로파일 ${profileOk} → ${ok ? 'OK' : '실패'}`);
	if (real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
