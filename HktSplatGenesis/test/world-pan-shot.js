// T2 검증 — 청크 무대 스트리밍. index.html 부트 후 절차 월드 타일 스트리밍을 켜고
// 카메라를 +x 로 직진시키며 링을 갱신한다. 판정:
//  ① 타일 교체가 실제로 일어난다 (팬 동안 본 타일 키 합집합 > 한 프레임 상한).
//  ② 스플랫 총량·메시 수가 시야 반경 상한 내 유지 (O(면적) 아님).
//  ③ 지형 커버리지가 전 구간 안정 — 타일 경계에 검은 틈(이음새)이 생기지 않는다(+사진).
//
// 무대는 "로드 대상" — 타일 PLY 는 월드 함수 평가로 즉석 생성(생명 아님, 절대 원칙 1 무관).
// 사용: node world-pan-shot.js [out.png] [seed=7]
const { serve, launch, collectErrors, savePng } = require('./_common');

const SEED = parseInt(process.argv[3] || '7');
const TILE = 19.2;                 // 타일 한 변(m) — 시뮬 버블(9.6)의 2배
const CENTERS = [0, TILE, 2 * TILE, 3 * TILE, 4 * TILE]; // +x 직진(5 스텝)
const NEAR_R = 1, FAR_R = 2, NEAR_G = 64, FAR_G = 32;
const MAX_MESHES = (2 * FAR_R + 1) * (2 * FAR_R + 1);          // 25
const SPLAT_CAP = 80000;           // near 9·64² + far 16·32² ≈ 53k — 여유 상한

// 카메라 타깃(cx,0)을 따라가는 조감 뷰 + 지형 픽셀·커버리지 측정
function shootSrc() {
	return (cx) => {
		const orbit = { fov: 0.9, up: [0, 1, 0], target: [cx, 1, 0], _eye: () => [cx - 3, 20, 34] };
		const W = 768, H = 640;
		const url = HktGenesisStage.capture(orbit, W, H);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = W; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
				const px = g.getImageData(0, 0, W, H).data;
				// 중앙 가로 밴드(근접 타일이 차는 영역)에서 지형 픽셀 비율 — 틈이 생기면 떨어진다
				let land = 0, band = 0, bandLand = 0;
				const y0 = (H * 0.45) | 0, y1 = (H * 0.8) | 0;
				for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
					const i = (y * W + x) * 4;
					const r = px[i], gr = px[i + 1], b = px[i + 2];
					const lum = r * 0.3 + gr * 0.5 + b * 0.2;
					const isLand = !(lum < 24 && b >= r);
					if (isLand) land++;
					if (y >= y0 && y < y1) { band++; if (isLand) bandLand++; }
				}
				resolve({ dataUrl: c.toDataURL('image/png'), land, bandCover: bandLand / band });
			};
			img.onerror = () => resolve({ err: 'capture 이미지 로드 실패' });
			img.src = url;
		});
	};
}

(async () => {
	const out = process.argv[2] || 'world-pan.png';
	const server = await serve(8141);
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
	});
	await page.goto('http://localhost:8141/', { waitUntil: 'load' });
	// stage.js 는 모듈(지연 로드) — HktGenesisStage 노출까지 대기
	await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisTerrainGen, null, { timeout: 30000, polling: 200 });

	await page.evaluate((cfg) => window.HktGenesisStage.startTileWorld({
		seed: cfg.seed, tile: { tileSize: cfg.tile, nearR: cfg.nearR, farR: cfg.farR, nearG: cfg.nearG, farG: cfg.farG },
	}), { seed: SEED, tile: TILE, nearR: NEAR_R, farR: FAR_R, nearG: NEAR_G, farG: FAR_G });

	const shoot = new Function('return (' + shootSrc().toString() + ')')();
	const seen = new Set();
	let maxMeshes = 0, maxSplats = 0, minBand = 1, savedMid = false;
	const trail = [];

	for (let s = 0; s < CENTERS.length; s++) {
		const cx = CENTERS[s];
		await page.evaluate((x) => window.HktGenesisStage.updateTileCenter(x, 0), cx);
		// Spark 스플랫 GPU 패킹에 렌더 몇 프레임 필요 — 새 타일이 다 올라올 때까지 워밍업
		let shot = null;
		for (let k = 0; k < 8; k++) {
			shot = await page.evaluate(new Function('cx', 'return (' + shootSrc().toString() + ')(cx)'), cx);
			await page.waitForTimeout(90);
		}
		const st = await page.evaluate(() => window.HktGenesisStage.tileStats());
		st.keys.forEach((k) => seen.add(k));
		maxMeshes = Math.max(maxMeshes, st.meshes);
		maxSplats = Math.max(maxSplats, st.splats);
		minBand = Math.min(minBand, shot.bandCover);
		trail.push({ cx, meshes: st.meshes, splats: st.splats, band: +shot.bandCover.toFixed(3), center: st.center });
		console.log(`팬 cx=${cx.toFixed(1)} · 메시 ${st.meshes} · 스플랫 ${st.splats} · 중앙밴드 지형 ${(shot.bandCover * 100).toFixed(0)}%`);
		if (s === 2 && shot.dataUrl) { savePng(shot.dataUrl, out); savedMid = true; } // 중간 지점 사진
	}

	if (!savedMid) console.error('중간 사진 미저장');
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: 타일 교체(합집합 > 상한) + 메시·스플랫 상한 내 + 커버리지 안정(틈 없음) + 오류 0
	const rotated = seen.size > MAX_MESHES;
	const bounded = maxMeshes <= MAX_MESHES && maxSplats <= SPLAT_CAP && maxSplats > 0;
	const seamless = minBand > 0.9;
	const ok = rotated && bounded && seamless && savedMid && real.length === 0;
	console.log(`저장: ${out}`);
	console.log(`판정: 타일교체 ${rotated}(합집합 ${seen.size}>${MAX_MESHES}) · 상한 ${bounded}(메시 ${maxMeshes}≤${MAX_MESHES}, 스플랫 ${maxSplats}≤${SPLAT_CAP}) · 이음새없음 ${seamless}(최소밴드 ${(minBand * 100).toFixed(0)}%) → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
