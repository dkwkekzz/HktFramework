// HktSplatEnv 자립 검증 — 환경(정적=무대) 렌더 스택이 생명 없이 단독 작동하는가.
// 실제 index.html 을 로드해 절차 월드 타일(terrain-gen → stage/Spark)을 스트리밍하고,
// 무대 캔버스를 캡처해 ① 타일 메시가 실렸는가 ② Bake 식생 타일이 있는가 ③ 지형 픽셀이
// 배경 위로 유의미하게 그려졌는가를 판정한다. GPU/콘솔 오류 0 → OK.
// 사용: node env-shot.js [out.png] [seed=7]
const path = require('path');
const { serve, launch, collectErrors, savePng } = require('./_common');

const SEED = parseInt(process.argv[3] || '7');
const W = 768, H = 640;

(async () => {
	const out = process.argv[2] || 'env.png';
	const server = await serve(8161, {});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: W, height: H } });
	const errors = collectErrors(page);
	// 앱 자체 rAF 루프는 재운다 — 촬영은 stage.capture 로 직접 구동(프레임 타이밍 통제).
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
	});
	await page.goto(`http://localhost:8161/index.html?seed=${SEED}`, { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => !!window.HktGenesisStage, null, { timeout: 60000, polling: 300 });
	} catch (e) { console.error('무대 모듈 로드 초과 — 오류:', errors); process.exit(1); }

	// 타일 월드를 직접 시작하고, 비동기 타일 로드(mesh.initialized)가 끝나도록 캡처를 반복 구동.
	// Spark 는 스플랫 GPU 패킹에 렌더 몇 프레임이 필요하다(DESIGN) — 워밍업 캡처로 채운다.
	const CAM = { fov: 1.0, up: [0, 1, 0], target: [0, 0, 0], eye: [0, 34, 46] };
	await page.evaluate((cm) => {
		// 앱(env-app)과 같은 경로: temperate 프리셋(mood=하늘 돔·구름 포함) + 시드
		const genome = window.HktGenesisTerrainGen.preset('temperate');
		genome.mood.cloud = 0.45;
		HktGenesisStage.startTileWorld(Object.assign(genome, { seed: cm.seed, tile: { tileSize: 19.2, nearR: 1, farR: 2, detG: 256, nearG: 192, farG: 48 } }));
	}, { seed: SEED });
	const orbit = (cm) => ({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye });
	for (let k = 0; k < 12; k++) {
		await page.evaluate(async ({ cm, W, H }) => {
			await HktGenesisStage.updateTileCenter(0, 0); // 링 로드 완료 대기
			HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, W, H);
		}, { cm: CAM, W, H });
		await page.waitForTimeout(120);
	}

	const shot = await page.evaluate(({ cm, W, H }) => {
		const url = HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, W, H);
		const st = HktGenesisStage.tileStats();
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = W; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
				const px = g.getImageData(0, 0, W, H).data;
				let land = 0, green = 0;
				for (let i = 0; i < W * H; i++) {
					const r = px[i * 4], gr = px[i * 4 + 1], b = px[i * 4 + 2];
					const lum = r * 0.3 + gr * 0.5 + b * 0.2;
					if (lum < 24 && b >= r) continue;     // 배경 클리어색(0x06070f) 근처 제외
					land++;
					if (gr > r + 6 && gr > b + 8) green++;  // 식생·평야 초록 계열
				}
				resolve({ dataUrl: c.toDataURL('image/png'), land, green, st });
			};
			img.onerror = () => resolve({ err: 'capture 이미지 로드 실패' });
			img.src = url;
		});
	}, { cm: CAM, W, H });

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, path.resolve(out));
	const st = shot.st, real = errors.filter((e) => !e.includes('404'));
	console.log(`무대(시드 ${SEED}): 타일 메시 ${st.meshes}(스플랫 ${st.splats}) · 식생 메시 ${st.vegMeshes} · 수면 메시 ${st.waterMeshes}`);
	console.log(`캡처: 지형 픽셀 ${shot.land} · 초록 계열 ${shot.green} · 저장 ${out}`);
	const ok = st.meshes >= 9 && shot.land > 40000 && real.length === 0;
	console.log(`판정: 타일 ${st.meshes >= 9}(${st.meshes}≥9) · 지형픽셀 ${shot.land > 40000}(${shot.land}) · 오류0 ${real.length === 0} → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
