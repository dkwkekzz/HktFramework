// T5 검증 — 물 수면 + 무대·생명 공용 fog. 두 부분:
//  ① (무대) 호수 파노라마: 타일 스트리밍에 반투명 수면 타일이 얹히고, three fog + 스카이 톤으로
//     원거리가 소실 — 물 픽셀(청색)이 있고, 하늘/원거리 톤이 fog 색과 일치 + 사진.
//  ② (생명) 렌더 fog: 원거리 개체가 무대와 *같은* fog 색으로 소실 — fog on 시 먼 스플랫이
//     fog 색으로 물들고, fog off 와 뚜렷이 다르다. → 두 층이 같은 파라미터를 공유.
//
// 사용: node water-shot.js [water.png] [seed=7]
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE } = require('./_common');

const SEED = parseInt(process.argv[3] || '7');
const LAKE = [56, -80];                 // terrain-gen 스캔으로 찾은 최다 수역 중심
const FOG = { hex: 0x93b4d6, rgb: [147, 180, 214], color: [0.576, 0.706, 0.839], near: 16, far: 50 };

(async () => {
	const out = process.argv[2] || 'water.png';
	const server = await serve(8145, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();

	// ── ① 무대: 호수 파노라마 (타일+수면+fog) ───────────────────────────────
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => { window.__rafCbs = []; window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; }; });
	await page.goto('http://localhost:8145/', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisTerrainGen, null, { timeout: 30000, polling: 200 });

	await page.evaluate(({ seed, fog }) => {
		HktGenesisStage.startTileWorld({ seed, tile: { tileSize: 19.2, nearR: 1, farR: 2, nearG: 64, farG: 32 } });
		HktGenesisStage.setFog(fog);
	}, { seed: SEED, fog: { hex: FOG.hex, near: FOG.near, far: FOG.far } });

	const CAM = { fov: 0.85, up: [0, 1, 0], target: [LAKE[0], -0.5, LAKE[1]], eye: [LAKE[0], 24, LAKE[1] + 40] };
	for (let k = 0; k < 8; k++) {
		await page.evaluate((cm) => { HktGenesisStage.updateTileCenter(cm.target[0], cm.target[2]); return HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, 768, 640); }, CAM);
		await page.waitForTimeout(120);
	}
	const stage = await page.evaluate((cm) => {
		const url = HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, 768, 640);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const W = 768, H = 640; const c = document.createElement('canvas'); c.width = W; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, W, H).data;
				let water = 0; let skyR = 0, skyG = 0, skyB = 0, skyN = 0;
				for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
					const i = (y * W + x) * 4, r = px[i], gr = px[i + 1], b = px[i + 2];
					if (b > r + 12 && b > gr + 4 && b > 55 && r < 120) water++;    // 청색 수면
					if (y < 60) { skyR += r; skyG += gr; skyB += b; skyN++; }        // 상단 = 하늘(=fog 톤)
				}
				resolve({ dataUrl: c.toDataURL('image/png'), water, sky: [skyR / skyN, skyG / skyN, skyB / skyN] });
			};
			img.onerror = () => resolve({ err: 1 }); img.src = url;
		});
	}, CAM);
	if (stage.err) { console.error('무대 캡처 실패'); process.exit(1); }
	savePng(stage.dataUrl, out);
	const skyDelta = Math.abs(stage.sky[0] - FOG.rgb[0]) + Math.abs(stage.sky[1] - FOG.rgb[1]) + Math.abs(stage.sky[2] - FOG.rgb[2]);
	console.log(`① 무대 — 수면 픽셀 ${stage.water} · 하늘 톤 [${stage.sky.map((v) => v.toFixed(0)).join(',')}] vs fog [${FOG.rgb}] Δ${skyDelta.toFixed(0)}`);

	// ── ② 생명: 렌더 fog (원거리 개체가 fog 색으로) ─────────────────────────
	const page2 = await browser.newPage();
	await page2.goto('http://localhost:8145/harness.html', { waitUntil: 'load' });
	const life = await page2.evaluate(async ({ fog }) => {
		const ad = await navigator.gpu.requestAdapter(); const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);
		const N = 8192;
		// 붉은 구름을 원거리(z=-14)에 — fog far=10 이라 완전히 안개에 잠긴다
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['불의 정령'], [0, 0.5, -14]);
		engine.setScene(N, [genes]);
		const view = HktMat.lookAt([0, 0.5, 0], [0, 0.5, -14], [0, 1, 0]);
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 100); const focalY = 0.5 * 640 / Math.tan(0.45);
		async function run(useFog) {
			engine.setFog(useFog ? { color: fog.color, near: 4, far: 10 } : null);
			let simTime = 0; const dt = 1 / 60;
			for (let fr = 0; fr < 40; fr++) { simTime += dt; engine.frame({ dt, time: simTime, genes, entities: [genes], paused: false, gridCenter: [0, 0.5, -14], pull: [0, 0, 0, 0], bones: null, showBones: false, view, proj, viewport: [640, 640], focal: [focalY, focalY] }); if (fr % 20 === 19 && fr !== 39) await device.queue.onSubmittedWorkDone(); }
			const bpr = 640 * 4; const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]); device.queue.submit([enc.finish()]);
			await rb.mapAsync(GPUMapMode.READ); const px = new Uint8Array(rb.getMappedRange());
			const bgra = format.startsWith('bgra'); let r = 0, g = 0, b = 0, n = 0;
			for (let i = 0; i < 640 * 640; i++) { const R = px[i * 4 + (bgra ? 2 : 0)], G = px[i * 4 + 1], B = px[i * 4 + (bgra ? 0 : 2)]; if (R + G + B < 30) continue; r += R; g += G; b += B; n++; }
			rb.unmap();
			return n ? [r / n, g / n, b / n] : [0, 0, 0];
		}
		const off = await run(false); const on = await run(true);
		return { gpuErrs, off, on };
	}, { fog: FOG });
	if (life.gpuErrs.length) { console.error('GPU 오류:', life.gpuErrs); process.exit(1); }
	// fog on 이면 먼 구름이 fog 색(청회색)으로 → 파랑 우세. off 는 불 색(주황) → 빨강 우세.
	const fogTint = life.on[2] - life.on[0]; // B-R: fog 색은 +, 불 색은 −
	const noFogTint = life.off[2] - life.off[0];
	console.log(`② 생명 — fog off 평균 [${life.off.map((v) => v.toFixed(0))}] (B−R ${noFogTint.toFixed(0)}) · fog on [${life.on.map((v) => v.toFixed(0))}] (B−R ${fogTint.toFixed(0)})`);

	const real = errors.filter((e) => !e.includes('404'));
	const waterOk = stage.water > 1500;
	const skyOk = skyDelta < 60;                 // 하늘 톤 ≈ fog 색
	const lifeFogOk = fogTint > 30 && fogTint > noFogTint + 40; // fog on 이 확연히 청색으로
	const ok = waterOk && skyOk && lifeFogOk && real.length === 0;
	console.log(`판정: 수면 ${waterOk}(${stage.water}) · 하늘톤일치 ${skyOk}(Δ${skyDelta.toFixed(0)}) · 생명fog ${lifeFogOk} → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
