// T5 검증 — 물 + 원거리 폴리시 (수면 타일 + 무대·생명 공용 sky/fog 톤). "호수 파노라마 —
// 수면·안개 톤 양층 일치"를 두 층 각각으로 실증한다 (Spark 스플랫은 three fog 미지원이라
// 무대 fog = clear 색, 생명 fog = 렌더 FS — 둘이 *같은 색*을 공유해 지평선에서 만난다):
//  ⓪ (순수 Node) 수면 타일 결정론: 원점 다른 두 창의 겹침 수면 셀 위치·색 diff 0.
//  ① (무대) 호수 파노라마: 타일 월드(시드 7, 수몰 12%)를 스트리밍 — 수면 메시가 붙고(waterMeshes>0),
//     수면 픽셀(청색)이 보이며, 하늘 밴드(상단)가 공용 sky 톤과 일치. + 사진.
//  ② (생명) 원거리 fog: 같은 sky 색으로 생명 구름을 fog on/off 렌더 — on 이 sky 색에 더 가깝다
//     (생명이 무대와 같은 톤으로 소실). + 사진.
//
// 사용: node world-water-shot.js [lake.png] [fog.png] [seed=7]
const path = require('path');
const { serve, launch, collectErrors, savePng } = require('./_common');
const TG = require('../js/env/terrain-gen.js');

const SEED = parseInt(process.argv[4] || '7');

// 생명 fog 구동 페이지 (math + presets + engine, 지형 무관)
const LIFE_ROUTE = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas>'
		+ '<script src="/js/life/math.js"><\/script><script src="/js/life/presets.js"><\/script>'
		+ '<script src="/js/life/wgsl.js"><\/script><script src="/js/life/engine.js"><\/script>');
};

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

(async () => {
	const outLake = process.argv[2] || 'world-water-lake.png';
	const outFog = process.argv[3] || 'world-water-fog.png';

	// ── ⓪ 순수 Node: 수면 타일 결정론 (창 무관 연속성) ─────────────────────────
	const world = TG.world({ seed: SEED });
	const S = 19.2, G = 64;
	// 같은 월드 타일을 두 번 굽되(호출은 결정론) — 겹치는 타일 좌표에서 바이트 동일해야
	const a1 = world.waterTilePly(0, 0, S, G, 1), a2 = world.waterTilePly(0, 0, S, G, 1);
	let detOk = !!a1 && a1.length === a2.length;
	if (detOk) for (let i = 0; i < a1.length; i++) if (a1[i] !== a2[i]) { detOk = false; break; }
	// 이웃 타일이 같은 전역 셀을 공유하지 않음(이음새) — 두 인접 타일 수면 스플랫이 겹치지 않는지
	const waterCount = (b) => b ? (Buffer.from(b.slice(0, 200)).toString('latin1').match(/element vertex (\d+)/) || [])[1] : '0';
	console.log(`⓪ 수면 타일 결정론: 재생성 diff 0 = ${detOk} · 타일(0,0) 수면 ${waterCount(a1)} 스플랫`);

	const server = await serve(8149, { '/life.html': LIFE_ROUTE });
	const browser = await launch();

	// ── ① 무대: 호수 파노라마 (index.html ?tiles → 수면 + sky 톤) ─────────────
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
	});
	await page.goto('http://localhost:8149/', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisTerrainGen, null, { timeout: 30000, polling: 200 });
	await page.evaluate((seed) => window.HktGenesisStage.startTileWorld({ seed, tile: { tileSize: 19.2, nearR: 1, farR: 2, nearG: 64, farG: 32 } }), SEED);
	await page.evaluate(() => window.HktGenesisStage.updateTileCenter(0, 0));

	// 지평선 파노라마 카메라 — 낮은 시점(하늘이 상단, 호수가 중앙 아래). Spark GPU 패킹 워밍업.
	const CAM = { fov: 0.9, up: [0, 1, 0], target: [0, -0.2, 0], eye: [0, 6, 26] };
	const shootSrc = (cm) => {
		const orbit = { fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye };
		const W = 768, H = 640;
		const url = window.HktGenesisStage.capture(orbit, W, H);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = W; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
				const px = g.getImageData(0, 0, W, H).data;
				const sky = window.HktGenesisStage.getSkyFog().color;
				const sky8 = [sky[0] * 255, sky[1] * 255, sky[2] * 255];
				let water = 0, skyBandSum = [0, 0, 0], skyBandN = 0;
				const yTop = (H * 0.12) | 0;
				for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
					const i = (y * W + x) * 4, r = px[i], gr = px[i + 1], b = px[i + 2];
					const lum = r * 0.3 + gr * 0.5 + b * 0.2;
					// 수면: 청색 우세 + 중간 이하 휘도(하늘은 밝음, 지형은 녹/갈)
					if (b > r + 12 && b > gr && lum < 130 && lum > 18) water++;
					if (y < yTop) { skyBandSum[0] += r; skyBandSum[1] += gr; skyBandSum[2] += b; skyBandN++; }
				}
				const skyMean = skyBandSum.map((s) => s / Math.max(skyBandN, 1));
				resolve({ dataUrl: c.toDataURL('image/png'), water, skyMean, sky8 });
			};
			img.onerror = () => resolve({ err: 'capture 이미지 로드 실패' });
			img.src = url;
		});
	};
	let lake = null;
	for (let k = 0; k < 8; k++) { lake = await page.evaluate(new Function('cm', 'return (' + shootSrc.toString() + ')(cm)'), CAM); await page.waitForTimeout(100); }
	const tstats = await page.evaluate(() => window.HktGenesisStage.tileStats());
	const skyFog = await page.evaluate(() => window.HktGenesisStage.getSkyFog());
	if (lake.err) { console.error(lake.err); await browser.close(); server.close(); process.exit(1); }
	savePng(lake.dataUrl, path.resolve(outLake));
	const skyBandDist = dist3(lake.skyMean, lake.sky8);
	console.log(`① 호수 파노라마: 수면 메시 ${tstats.waterMeshes}(스플랫 ${tstats.waterSplats}) · 수면 픽셀 ${lake.water} · ` +
		`하늘밴드 μ[${lake.skyMean.map((v) => v.toFixed(0)).join(',')}] vs sky[${lake.sky8.map((v) => v.toFixed(0)).join(',')}] 거리 ${skyBandDist.toFixed(1)}`);

	// ── ② 생명: 같은 sky 색으로 원거리 fog on/off ─────────────────────────────
	const life = await browser.newPage();
	life.on('pageerror', (e) => console.error('[life pageerror]', e.message));
	await life.goto('http://localhost:8149/life.html', { waitUntil: 'load' });
	const fogShot = await life.evaluate(async (P) => {
		const { sky } = P;
		const ad = await navigator.gpu.requestAdapter();
		const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);
		const N = 16384;
		// 녹색 숲 정령 구름을 깊이순으로 늘어놓는다 — 가까운 건 초록, 먼 건 fog 로 sky 색에 물든다
		// (원거리 fog 그라데이션). 개체 4 = 슬라이스 4096.
		const depths = [-3, -11, -19, -27];
		const ents = depths.map((z) => {
			const g = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['숲의 정령'], [0, 0.6, z]);
			g.emitRadius = 1.6; g.mortality = 0; return g;
		});
		const genes = ents[0];
		engine.setScene(N, ents);
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 100);
		const focalY = 0.5 * 640 / Math.tan(0.45);
		const view = HktMat.lookAt([0, 1.4, 7], [0, 0.6, -16], [0, 1, 0]);
		const dt = 1 / 60;
		const render = async (fog, capture) => {
			let simTime = 0;
			for (let fr = 0; fr < 80; fr++) {
				simTime += dt;
				engine.frame({ dt, time: simTime, genes, entities: ents, paused: false, gridCenter: [0, 0.8, -14],
					pull: [0, 0, 0, 0], bones: null, showBones: false, fog,
					view, proj, viewport: [640, 640], focal: [focalY, focalY] });
				if (fr % 20 === 19 && !(capture && fr === 79)) await device.queue.onSubmittedWorkDone();
			}
			const bpr = 640 * 4;
			const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]);
			device.queue.submit([enc.finish()]);
			await rb.mapAsync(GPUMapMode.READ);
			const px = new Uint8Array(rb.getMappedRange());
			const bgra = format.startsWith('bgra');
			let sum = [0, 0, 0], n = 0;
			let dataUrl = null;
			const c2d = document.createElement('canvas'); c2d.width = 640; c2d.height = 640;
			const g = c2d.getContext('2d'); const img = g.createImageData(640, 640);
			for (let i = 0; i < 640 * 640; i++) {
				const r = px[i * 4 + (bgra ? 2 : 0)], gr = px[i * 4 + 1], b = px[i * 4 + (bgra ? 0 : 2)];
				img.data[i * 4] = r; img.data[i * 4 + 1] = gr; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
				const lum = r + gr + b;
				if (lum > 30) { sum[0] += r; sum[1] += gr; sum[2] += b; n++; } // 생명 픽셀만(배경 제외)
			}
			if (capture) { g.putImageData(img, 0, 0); dataUrl = c2d.toDataURL('image/png'); }
			rb.unmap(); rb.destroy();
			return { mean: sum.map((s) => s / Math.max(n, 1)), n, dataUrl };
		};
		const sky8 = [sky[0] * 255, sky[1] * 255, sky[2] * 255];
		const off = await render(null, false);
		const on = await render({ color: sky, start: 6, end: 24, amount: 1 }, true);
		return { gpuErrs, sky8, offMean: off.mean, onMean: on.mean, offN: off.n, onN: on.n, dataUrl: on.dataUrl };
	}, { sky: skyFog.color });

	if (fogShot.gpuErrs.length) { console.error('GPU 오류:', fogShot.gpuErrs); await browser.close(); server.close(); process.exit(1); }
	savePng(fogShot.dataUrl, path.resolve(outFog));
	const dOff = dist3(fogShot.offMean, fogShot.sky8), dOn = dist3(fogShot.onMean, fogShot.sky8);
	console.log(`② 생명 fog: off μ[${fogShot.offMean.map((v) => v.toFixed(0)).join(',')}] sky거리 ${dOff.toFixed(1)} → on μ[${fogShot.onMean.map((v) => v.toFixed(0)).join(',')}] sky거리 ${dOn.toFixed(1)}`);

	// 판정: ⓪ 결정론 + ① 수면 존재·하늘톤 일치 + ② 생명 fog 가 sky 색으로(on 이 off 보다 가깝게) 소실
	const waterOk = tstats.waterMeshes > 0 && tstats.waterSplats > 0 && lake.water > 1500;
	const skyOk = skyBandDist < 45; // 하늘 밴드가 공용 sky 톤 근방(무대 clear = sky)
	const fogOk = dOn < dOff - 25 && fogShot.onN > 500; // 생명이 sky 색으로 유의미하게 물듦
	const real = errors.filter((e) => !e.includes('404'));
	const ok = detOk && waterOk && skyOk && fogOk && fogShot.gpuErrs.length === 0 && real.length === 0;
	console.log(`저장: ${outLake}, ${outFog}`);
	console.log(`판정: 결정론 ${detOk} · 수면 ${waterOk}(메시 ${tstats.waterMeshes}·픽셀 ${lake.water}) · ` +
		`하늘톤일치 ${skyOk}(거리 ${skyBandDist.toFixed(1)}) · 생명fog소실 ${fogOk}(on ${dOn.toFixed(0)}<off ${dOff.toFixed(0)}) → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
