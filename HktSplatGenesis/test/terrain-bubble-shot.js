// T3 검증 — 시뮬 바닥 가상화 + 버블 y 추종. 두 가지를 한 커맨드로:
//  ① (순수 Node) 실에셋 O(창) 베이크: collider XZ 버킷 인덱스가 나이브 bake 와 창 안에서
//     수치 일치(diff 0)하면서 삼각형을 훨씬 적게 순회.
//  ② (브라우저) 원점에서 먼(≈70u) 좌표의 3m 계곡에 슬라임을 심고 버블 y 를 지형에 추종시킨다:
//     침투 0% + L2 생존(휴지 간격) + 계곡 바닥 정착. 버블 고정(원점) 대조군과 비교 + 사진.
//
// 계곡은 bakeFn(height 함수 직접 베이크, triSoup 경유 없음)으로 굽는다 — T3 절차 월드 경로.
// 사용: node terrain-bubble-shot.js [follow.png] [fixed.png] [frames=160] [n=8192]
const path = require('path');
const { serve, launch, savePng } = require('./_common');
const HF = require('../js/heightfield.js');
const TG = require('../js/terrain-gen.js');

// 엔진 직접 구동 페이지 (heightfield + terrain-gen 포함)
const ROUTE = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas>'
		+ '<script src="/vendor/three.min.js"><\/script><script src="/vendor/fflate.min.js"><\/script><script src="/vendor/FBXLoader.js"><\/script>'
		+ '<script src="/js/math.js"><\/script><script src="/js/heightfield.js"><\/script><script src="/js/terrain-gen.js"><\/script>'
		+ '<script src="/js/skeleton.js"><\/script><script src="/js/presets.js"><\/script>'
		+ '<script src="/js/wgsl.js"><\/script><script src="/js/engine.js"><\/script>');
};

// 계곡: [50,50] 중심의 평바닥 분지 — 반경 RFLAT 까지 바닥 y=0, 그 밖으로 반경 R 에서 벽 y=3.
// 평바닥이라 슬라임이 웅덩이로 퍼져 L2 휴지 간격이 관측된다(점으로 뭉치는 사발은 신호를 가림).
// 벽 고저차 3m + 원점에서 ≈70u. 원점 50u 밖·고저차 3u 두 완료 기준을 함께 만족.
const CX = 50, CZ = 50, RFLAT = 3.4, R = 4.7, DEPTH = 3.0;

(async () => {
	const outA = process.argv[2] || 'terrain-follow.png';
	const outB = process.argv[3] || 'terrain-fixed.png';
	const FRAMES = parseInt(process.argv[4] || '160');
	const N = parseInt(process.argv[5] || '8192');

	// ── ① 순수 Node: 버킷 인덱스 O(창) 베이크 == 나이브 bake ──────────────────
	const soup = TG.create({ seed: 7, extent: 40 }).triSoup(200);
	const idx = HF.buildIndex(soup, { bucket: 4.8 });
	const reg = { res: 128, originX: 3 - 4.8, originZ: -2 - 4.8, cell: 9.6 / 127 };
	const naive = HF.bake(soup, reg), indexed = HF.bakeIndexed(idx, reg);
	let maxd = 0; for (let i = 0; i < naive.data.length; i++) maxd = Math.max(maxd, Math.abs(naive.data[i] - indexed.data[i]));
	const totalTris = soup.length / 9;
	const idxOk = maxd === 0 && indexed.touched < totalTris * 0.2;
	console.log(`① 버킷 인덱스: 창 diff ${maxd} · 순회 ${indexed.touched}/${totalTris} (${(100 * indexed.touched / totalTris).toFixed(0)}%) → ${idxOk ? 'OK' : '실패'}`);

	const server = await serve(8142, { '/harness.html': ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	await page.goto('http://localhost:8142/harness.html', { waitUntil: 'load' });

	// 한 시나리오 구동: gridCenter 정책(follow|fixed)에 따라 버블 y 추종 여부를 바꾼다
	const run = (mode) => page.evaluate(async ({ FRAMES, N, mode, CX, CZ, RFLAT, R, DEPTH }) => {
		const bowl = (x, z) => { const r = Math.hypot(x - CX, z - CZ); if (r < RFLAT) return 0; const t = Math.min((r - RFLAT) / (R - RFLAT), 1); return DEPTH * t * t; };
		const ad = await navigator.gpu.requestAdapter();
		const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);

		// 계곡 heightfield 를 bakeFn(직접 함수 베이크)으로 — triSoup 경유 없음
		const cell = 9.6 / 127;
		const hf = HktHeightfield.bakeFn(bowl, { res: 128, originX: CX - 4.8, originZ: CZ - 4.8, cell });
		engine.setHeightfield(hf);

		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['슬라임'], [CX, 1.6, CZ]);
		engine.setScene(N, [genes]);

		// follow: 버블 y 를 지형에 추종(engine.bubbleCenter). fixed: 원점 고정(구 거동, 격자 밖).
		const target = [CX, 1.0, CZ];
		const gc = mode === 'follow' ? engine.bubbleCenter(target) : [0, 0.8, 0];

		const view = HktMat.lookAt([CX, 2.6, CZ + 5], [CX, 0.4, CZ], [0, 1, 0]);
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 200);
		const focalY = 0.5 * 640 / Math.tan(0.45);
		const dt = 1 / 60; let simTime = 0;
		for (let fr = 0; fr < FRAMES; fr++) {
			simTime += dt;
			engine.frame({ dt, time: simTime, genes, entities: [genes], paused: false, gridCenter: gc,
				pull: [0, 0, 0, 0], bones: null, showBones: false,
				view, proj, viewport: [640, 640], focal: [focalY, focalY] });
			if (fr % 20 === 19 && fr !== FRAMES - 1) await device.queue.onSubmittedWorkDone();
		}
		const bpr = 640 * 4;
		const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
		const sb = device.createBuffer({ size: N * 48, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
		const enc = device.createCommandEncoder();
		enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]);
		enc.copyBufferToBuffer(engine.splatBuf, 0, sb, 0, N * 48);
		device.queue.submit([enc.finish()]);
		await rb.mapAsync(GPUMapMode.READ); await sb.mapAsync(GPUMapMode.READ);
		const sp = new Float32Array(sb.getMappedRange()).slice();
		const px = new Uint8Array(rb.getMappedRange());
		const c2d = document.createElement('canvas'); c2d.width = 640; c2d.height = 640;
		const g = c2d.getContext('2d'); const img = g.createImageData(640, 640);
		const bgra = format.startsWith('bgra');
		for (let i = 0; i < 640 * 640; i++) {
			img.data[i * 4] = px[i * 4 + (bgra ? 2 : 0)]; img.data[i * 4 + 1] = px[i * 4 + 1];
			img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)]; img.data[i * 4 + 3] = 255;
		}
		g.putImageData(img, 0, 0);

		// 지표: 침투(지형 아래) · 정착(중앙값 y·사발 내) · 확산(무게중심 RMS 반경).
		// L2 생존 시그니처 = 확산: 분리력이 부피를 유지한다. 격자 밖(L2 꺼짐)이면 응집만 남아
		// 한 점으로 붕괴(작은 RMS) — 살아 있으면 웅덩이로 퍼진다(큰 RMS). (nn 은 밀집 코어에
		// 가려 신호가 안 나온다 — 스프레드가 정답.)
		let pen = 0, inBowl = 0, cx = 0, cy = 0, cz = 0; const ys = [];
		for (let i = 0; i < N; i++) {
			const x = sp[i * 12], y = sp[i * 12 + 1], z = sp[i * 12 + 2];
			ys.push(y); cx += x; cy += y; cz += z;
			if (y < bowl(x, z) - 0.05) pen++;
			if (Math.hypot(x - CX, z - CZ) < R) inBowl++;
		}
		cx /= N; cy /= N; cz /= N;
		let sq = 0;
		for (let i = 0; i < N; i++) { const dx = sp[i * 12] - cx, dy = sp[i * 12 + 1] - cy, dz = sp[i * 12 + 2] - cz; sq += dx * dx + dy * dy + dz * dz; }
		const spread = Math.sqrt(sq / N);
		ys.sort((a, b) => a - b); const medY = ys[N >> 1];
		return { dataUrl: gpuErrs.length ? null : c2d.toDataURL('image/png'), gpuErrs,
			penFrac: pen / N, medY, inBowlFrac: inBowl / N, spread, gc };
	}, { FRAMES, N, mode, CX, CZ, RFLAT, R, DEPTH });

	const follow = await run('follow');
	if (!follow.dataUrl) { console.error('GPU 오류:', follow.gpuErrs); process.exit(1); }
	const fixed = await run('fixed');
	if (!fixed.dataUrl) { console.error('GPU 오류:', fixed.gpuErrs); process.exit(1); }

	savePng(follow.dataUrl, path.resolve(outA));
	savePng(fixed.dataUrl, path.resolve(outB));
	console.log(`② 버블 y=${follow.gc[1].toFixed(2)} (지형추종) — 침투 ${(follow.penFrac * 100).toFixed(1)}% · 중앙값 y ${follow.medY.toFixed(2)} · 사발내 ${(follow.inBowlFrac * 100).toFixed(0)}% · 확산 ${follow.spread.toFixed(3)}`);
	console.log(`   대조군(버블 원점 고정) — 침투 ${(fixed.penFrac * 100).toFixed(1)}% · 확산 ${fixed.spread.toFixed(3)}`);

	// 판정: 추종 시 ① 침투 ~0 ② 계곡 바닥 정착(중앙값 y 낮고 사발 안) ③ L2 생존(확산 > 1.8× 대조군)
	const penOk = follow.penFrac < 0.02;
	const settleOk = follow.medY < 1.2 && follow.inBowlFrac > 0.6;
	const l2Ok = follow.spread > 1.8 * fixed.spread;
	const ok = idxOk && penOk && settleOk && l2Ok && follow.gpuErrs.length === 0;
	console.log(`판정: 인덱스 ${idxOk} · 침투0 ${penOk} · 계곡정착 ${settleOk}(medY ${follow.medY.toFixed(2)}, 사발 ${(follow.inBowlFrac * 100).toFixed(0)}%) · L2생존 ${l2Ok}(확산 ${follow.spread.toFixed(3)} vs ${fixed.spread.toFixed(3)}) → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
