// T4 검증 — 스캐터·개체 스트리밍. 세 가지를 한 커맨드로:
//  ① (순수 Node) 결정론 스폰: 같은 시드=같은 배치 + 바이옴/수위 게이팅(나무는 물속 없음).
//  ② (브라우저) 스트리밍: 카메라 +x 직진 중 슬롯 재활용으로 나무·바위가 등장·소멸하고,
//     setScene 전체 재초기화 없이(splatBuf 동일) 개체 상한 8을 넘겨 월드가 채워진다 + 사진.
//  ③ (브라우저) 불×나무 임의 좌표: 원점에서 먼 곳에 나무+불을 슬롯 교체로 심어 연소가 성립.
//
// 사용: node scatter-shot.js [scatter.png] [fire.png] [seed=7]
const path = require('path');
const { serve, launch, savePng } = require('./_common');
const TG = require('../js/terrain-gen.js');

const ROUTE = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas>'
		+ '<script src="/vendor/three.min.js"><\/script><script src="/vendor/fflate.min.js"><\/script><script src="/vendor/FBXLoader.js"><\/script>'
		+ '<script src="/js/math.js"><\/script><script src="/js/heightfield.js"><\/script><script src="/js/terrain-gen.js"><\/script>'
		+ '<script src="/js/skeleton.js"><\/script><script src="/js/presets.js"><\/script>'
		+ '<script src="/js/wgsl.js"><\/script><script src="/js/engine.js"><\/script><script src="/js/scatter.js"><\/script>');
};

const SEED = parseInt(process.argv[4] || '7');

(async () => {
	const outA = process.argv[2] || 'scatter.png';
	const outB = process.argv[3] || 'scatter-fire.png';

	// ── ① 순수 Node: 결정론 + 게이팅 ────────────────────────────────────────
	const W = TG.world({ seed: SEED });
	const a = W.scatter(0, 0, 60, {}), b = W.scatter(0, 0, 60, {});
	const detOk = JSON.stringify(a) === JSON.stringify(b);
	const treesInWater = a.filter((s) => s.kind === 'tree' && s.y < W.waterY).length;
	console.log(`① 스폰 결정론 ${detOk} · 스폰 ${a.length}개 · 나무 물속 ${treesInWater} → ${detOk && treesInWater === 0 ? 'OK' : '실패'}`);

	const server = await serve(8143, { '/harness.html': ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	await page.goto('http://localhost:8143/harness.html', { waitUntil: 'load' });

	// ── ② 스트리밍 팬 ───────────────────────────────────────────────────────
	const pan = await page.evaluate(async ({ SEED }) => {
		const ad = await navigator.gpu.requestAdapter(); const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);
		const world = HktGenesisTerrainGen.world({ seed: SEED });
		const N = 16384;
		engine.setScene(N, Array.from({ length: 8 }, () => HktGenesisScatter.voidGenes()));
		HktGenesisScatter.configure(engine, world, { radius: 20, slotStart: 0, slotCount: 8, cell: 6, density: 0.6 });
		const buf0 = engine.splatBuf; // setScene 재초기화 감시 (스트리밍은 부분 업로드만)

		const proj = HktMat.perspective(0.9, 1.0, 0.05, 200);
		const focalY = 0.5 * 640 / Math.tan(0.45);
		const dt = 1 / 60; let simTime = 0, lastPx = null;
		const union = new Set(); const stepSets = [];
		for (let step = 0; step < 6; step++) {
			const cx = step * 8; // +x 직진 (8m 씩 = 스폰 셀 이상)
			const hf = HktHeightfield.bakeFn((x, z) => world.height(x, z), { res: 128, originX: cx - 4.8, originZ: -4.8, cell: 9.6 / 127 });
			engine.setHeightfield(hf);
			HktGenesisScatter.update(cx, 0, { force: true });
			const act = HktGenesisScatter.active();
			act.forEach((s) => union.add(s.key)); stepSets.push(act.map((s) => s.key).sort().join('|'));
			const gc = engine.bubbleCenter([cx, 0.5, 0]);
			const view = HktMat.lookAt([cx, 6, 13], [cx, 0.5, 0], [0, 1, 0]);
			for (let fr = 0; fr < 24; fr++) { simTime += dt; engine.frame({ dt, time: simTime, genes: engine.entities[0], entities: engine.entities, paused: false, gridCenter: gc, pull: [0, 0, 0, 0], bones: null, showBones: false, view, proj, viewport: [640, 640], focal: [focalY, focalY] }); if (fr % 12 === 11 && fr !== 23) await device.queue.onSubmittedWorkDone(); }
			if (step === 3) { // 중간 사진
				const bpr = 640 * 4; const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
				const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]); device.queue.submit([enc.finish()]);
				await rb.mapAsync(GPUMapMode.READ); lastPx = new Uint8Array(rb.getMappedRange()).slice();
			}
		}
		const noReinit = engine.splatBuf === buf0;
		const distinctSets = new Set(stepSets).size;
		let dataUrl = null;
		if (lastPx) {
			const c2d = document.createElement('canvas'); c2d.width = 640; c2d.height = 640; const g = c2d.getContext('2d'); const img = g.createImageData(640, 640);
			const bgra = format.startsWith('bgra');
			for (let i = 0; i < 640 * 640; i++) { img.data[i * 4] = lastPx[i * 4 + (bgra ? 2 : 0)]; img.data[i * 4 + 1] = lastPx[i * 4 + 1]; img.data[i * 4 + 2] = lastPx[i * 4 + (bgra ? 0 : 2)]; img.data[i * 4 + 3] = 255; }
			g.putImageData(img, 0, 0); dataUrl = c2d.toDataURL('image/png');
		}
		return { gpuErrs, unionSize: union.size, distinctSets, noReinit, dataUrl };
	}, { SEED });

	if (pan.gpuErrs.length) { console.error('GPU 오류:', pan.gpuErrs); process.exit(1); }
	if (pan.dataUrl) savePng(pan.dataUrl, path.resolve(outA));
	console.log(`② 스트리밍 — 본 스폰 합집합 ${pan.unionSize} · 서로 다른 슬롯 구성 ${pan.distinctSets}/6 · setScene 무재초기화 ${pan.noReinit}`);

	// ── ③ 불×나무 임의 좌표 (원점에서 ≈70u) ────────────────────────────────
	const fire = await page.evaluate(async ({ SEED }) => {
		const ad = await navigator.gpu.requestAdapter(); const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);
		const N = 8192; // 슬라이스 4096 (2 슬롯만 써도 8슬롯 레이아웃)
		engine.setScene(N, Array.from({ length: 8 }, () => HktGenesisScatter.voidGenes()));
		const slice = N / 8;
		const CX = 50, CZ = 50;
		const hf = HktHeightfield.bakeFn(() => 0, { res: 128, originX: CX - 4.8, originZ: CZ - 4.8, cell: 9.6 / 127 });
		engine.setHeightfield(hf);
		// 슬롯 0 = 나무, 슬롯 1 = 불(나무 근처) — 슬롯 증분 교체로 심는다
		engine.setEntitySlot(0, HktGenesisScatter.genesFor({ x: CX, z: CZ, kind: 'tree' }));
		engine.setEntitySlot(1, HktGenesisScatter.genesFor({ x: CX + 0.5, z: CZ + 0.3, kind: 'fire' }));
		const gc = engine.bubbleCenter([CX, 0.6, CZ]);
		const view = HktMat.lookAt([CX, 3, CZ + 6], [CX, 0.8, CZ], [0, 1, 0]);
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 200); const focalY = 0.5 * 640 / Math.tan(0.45);
		const dt = 1 / 60; let simTime = 0;
		for (let fr = 0; fr < 200; fr++) { simTime += dt; engine.frame({ dt, time: simTime, genes: engine.entities[0], entities: engine.entities, paused: false, gridCenter: gc, pull: [0, 0, 0, 0], bones: null, showBones: false, view, proj, viewport: [640, 640], focal: [focalY, focalY] }); if (fr % 20 === 19 && fr !== 199) await device.queue.onSubmittedWorkDone(); }
		const bpr = 640 * 4; const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
		const sb = device.createBuffer({ size: N * 48, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
		const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]); enc.copyBufferToBuffer(engine.splatBuf, 0, sb, 0, N * 48); device.queue.submit([enc.finish()]);
		await rb.mapAsync(GPUMapMode.READ); await sb.mapAsync(GPUMapMode.READ);
		const sp = new Float32Array(sb.getMappedRange()).slice();
		// 나무 슬라이스(슬롯 0 = [0,slice)) 연소: heat(misc.z=+10) 평균. 불이 옮겨붙으면 오른다.
		let heat = 0; for (let i = 0; i < slice; i++) heat += sp[i * 12 + 10];
		heat /= slice;
		const px = new Uint8Array(rb.getMappedRange());
		const c2d = document.createElement('canvas'); c2d.width = 640; c2d.height = 640; const g = c2d.getContext('2d'); const img = g.createImageData(640, 640);
		const bgra = format.startsWith('bgra');
		for (let i = 0; i < 640 * 640; i++) { img.data[i * 4] = px[i * 4 + (bgra ? 2 : 0)]; img.data[i * 4 + 1] = px[i * 4 + 1]; img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)]; img.data[i * 4 + 3] = 255; }
		g.putImageData(img, 0, 0);
		return { gpuErrs, treeHeat: heat, dataUrl: c2d.toDataURL('image/png') };
	}, { SEED });

	if (fire.gpuErrs.length) { console.error('GPU 오류:', fire.gpuErrs); process.exit(1); }
	savePng(fire.dataUrl, path.resolve(outB));
	console.log(`③ 불×나무 @[50,50] — 나무 슬라이스 평균 heat ${fire.treeHeat.toFixed(4)} (연소 시 상승)`);

	// 판정
	const streamOk = pan.unionSize > 8 && pan.distinctSets >= 4 && pan.noReinit;
	const fireOk = fire.treeHeat > 0.02;
	const ok = detOk && treesInWater === 0 && streamOk && fireOk;
	console.log(`판정: 결정론 ${detOk && treesInWater === 0} · 스트리밍 ${streamOk}(합집합 ${pan.unionSize}>8, 구성 ${pan.distinctSets}, 무재초기화 ${pan.noReinit}) · 불×나무 ${fireOk} → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
