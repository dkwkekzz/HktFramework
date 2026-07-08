// T4 검증 — 스캐터·개체 스트리밍. 세 가지를 한 커맨드로:
//  ⓪ (순수 Node) 결정론 스폰: 원점 다른 두 창의 겹침 영역 스폰이 위치 diff 0 —
//     스트리밍 연속성(창 무관 = 이음새 없음)의 근거. T2 청크 경계 연속성의 생명 판.
//  ① (브라우저) 직진 팬: 카메라를 +x 로 옮기며 ScatterStream 이 슬롯을 증분 교체한다.
//     본 스폰 key 합집합 > 한 프레임 활성 수(교체 발생) + 활성 슬롯 상한(≤maxActive) 유지 + 사진.
//  ② (브라우저) 불×나무 임의 좌표: 원점에서 먼 좌표에 스트리밍된 나무+모닥불 쌍이 공유 격자에서
//     연소 상호작용(나무 스플랫 가열) — 불 없는 대조군은 가열 ~0. + 사진.
//
// 스폰 위치는 좌표·시드 해시(Math.random 금지), 슬롯 교체는 engine.respawnEntity(부분 업로드).
// 사용: node world-scatter-shot.js [pan.png] [fire.png] [seed=7]
const path = require('path');
const { serve, launch, savePng } = require('./_common');
const TG = require('../js/env/terrain-gen.js');
const SC = require('../js/shared/scatter.js');
// presets.js 는 window 전역 의존(HktGenesisGenes) — Node 순수 단계는 genesFor 를 안 부르므로 불요.

// 엔진 직접 구동 페이지 (heightfield + terrain-gen + presets + scatter 포함, 뼈대 무관)
const ROUTE = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas>'
		+ '<script src="/js/life/math.js"><\/script><script src="/js/life/heightfield.js"><\/script><script src="/js/env/terrain-gen.js"><\/script>'
		+ '<script src="/js/life/presets.js"><\/script><script src="/js/shared/scatter.js"><\/script>'
		+ '<script src="/js/life/wgsl.js"><\/script><script src="/js/life/engine.js"><\/script>');
};

const SEED = parseInt(process.argv[4] || '7');
const N = 16384;                 // 8 슬롯 × 2048 (슬라이스 256 배수 · 2^n)
const RADIUS = 16, CELL = 6.0, TREE_DENSITY = 0.55, CAMPFIRE = 0.2;
const CENTERS = [0, 8, 16, 24, 32]; // +x 직진(5 스텝)
const CFG = { radius: RADIUS, cell: CELL, treeDensity: TREE_DENSITY, campfireRate: CAMPFIRE, maxSlope: 1.3 };

(async () => {
	const outPan = process.argv[2] || 'world-scatter-pan.png';
	const outFire = process.argv[3] || 'world-scatter-fire.png';

	// ── ⓪ 순수 Node: 결정론 스폰 (창 무관 연속성) ─────────────────────────────
	const world = TG.world({ seed: SEED });
	const A = SC.candidates(world, 0, 0, 26, CFG);
	const B = SC.candidates(world, 10, 0, 26, CFG); // 원점 다른 창(겹침 존재)
	const bmap = new Map(B.map((c) => [c.key, c]));
	let overlap = 0, maxPosDiff = 0;
	for (const a of A) {
		const b = bmap.get(a.key);
		if (!b) continue;
		overlap++;
		maxPosDiff = Math.max(maxPosDiff, Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
	}
	const detOk = overlap >= 3 && maxPosDiff === 0;
	const trees = A.filter((c) => c.kind === 'tree').length, fires = A.filter((c) => c.kind === 'campfire').length;
	console.log(`⓪ 결정론 스폰: 후보 ${A.length}(나무 ${trees}·모닥불 ${fires}) · 겹침 ${overlap}개 위치 diff ${maxPosDiff} → ${detOk ? 'OK' : '실패'}`);

	// ── 불×나무 쌍 선정 (원점에서 먼 임의 좌표) — 결정론이라 브라우저와 동일 ──
	const BX = 120, BZ = 40;
	const around = SC.candidates(world, BX, BZ, 40, CFG);
	const fireCands = around.filter((c) => c.kind === 'campfire')
		.sort((f, g) => ((f.x - BX) ** 2 + (f.z - BZ) ** 2) - ((g.x - BX) ** 2 + (g.z - BZ) ** 2));
	let pair = null;
	for (const f of fireCands) { const host = around.find((c) => c.key === f.host); if (host) { pair = { fire: f, tree: host }; break; } }
	if (!pair) { console.error('불×나무 쌍을 임의 좌표 근방에서 못 찾음 — CAMPFIRE 상향 필요'); process.exit(1); }
	const target = [(pair.fire.x + pair.tree.x) / 2, 0, (pair.fire.z + pair.tree.z) / 2];
	console.log(`② 불×나무 쌍 @ (${pair.tree.x.toFixed(1)}, ${pair.tree.z.toFixed(1)}) 임의 좌표 (원점 ${Math.hypot(target[0], target[2]).toFixed(0)}u)`);

	const server = await serve(8147, { '/harness.html': ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
	page.on('pageerror', (e) => console.error('[pageerror]', e.message));
	await page.goto('http://localhost:8147/harness.html', { waitUntil: 'load' });

	const result = await page.evaluate(async (P) => {
		const { SEED, N, CENTERS, CFG, target, treeKey, fireKey } = P;
		const HFR = P.CFG.radius + 4; // heightfield 창 반폭 — 스캐터 반경을 덮어 먼 나무 뿌리도 정확
		const ad = await navigator.gpu.requestAdapter();
		const device = await ad.requestDevice();
		const gpuErrs = []; device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
		const ctx = document.getElementById('gpu').getContext('webgpu');
		const format = navigator.gpu.getPreferredCanvasFormat();
		ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
		const engine = new HktGenesisEngine(device, ctx, format);
		const world = HktGenesisTerrainGen.world({ seed: SEED });

		// 8 슬롯 void 로 장면 구성 → 스트림이 슬롯을 증분 교체
		const voids = []; for (let i = 0; i < 8; i++) voids.push(HktGenesisScatter.voidEntity());
		engine.setScene(N, voids);
		const stream = new HktGenesisScatter.ScatterStream(engine, world, Object.assign({ maxActive: 8 }, CFG));

		const bakeAt = (cx, cz) => {
			const cell = 2 * HFR / 127;
			const hf = HktHeightfield.bakeFn((x, z) => world.height(x, z), { res: 128, originX: cx - HFR, originZ: cz - HFR, cell });
			engine.setHeightfield(hf);
		};
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 300);
		const focalY = 0.5 * 640 / Math.tan(0.45);
		const dt = 1 / 60;
		const c2d = document.createElement('canvas'); c2d.width = 640; c2d.height = 640;
		const g2 = c2d.getContext('2d');
		const bgra = format.startsWith('bgra');
		async function grab() {
			const bpr = 640 * 4;
			const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]);
			device.queue.submit([enc.finish()]);
			await rb.mapAsync(GPUMapMode.READ);
			const px = new Uint8Array(rb.getMappedRange());
			const img = g2.createImageData(640, 640);
			for (let i = 0; i < 640 * 640; i++) {
				img.data[i * 4] = px[i * 4 + (bgra ? 2 : 0)]; img.data[i * 4 + 1] = px[i * 4 + 1];
				img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)]; img.data[i * 4 + 3] = 255;
			}
			g2.putImageData(img, 0, 0);
			rb.unmap(); rb.destroy();
			return c2d.toDataURL('image/png');
		}

		// ── ① 직진 팬: 스폰 슬롯 교체 관찰 ───────────────────────────────────
		const seen = new Set();
		let maxActive = 0, panDataUrl = null, simTime = 0;
		const perStep = [];
		for (let s = 0; s < CENTERS.length; s++) {
			const cx = CENTERS[s];
			bakeAt(cx, 0);
			const st = stream.update(cx, 0);
			stream.activeKeys().forEach((k) => seen.add(k));
			maxActive = Math.max(maxActive, st.active);
			perStep.push({ cx, active: st.active, spawned: st.spawned, removed: st.removed, cands: st.candidates });
			const gc = engine.bubbleCenter([cx, 1, 0]);
			const view = HktMat.lookAt([cx - 2, 6, 13], [cx, 1, 0], [0, 1, 0]);
			for (let fr = 0; fr < 40; fr++) {
				simTime += dt;
				engine.frame({ dt, time: simTime, genes: engine.entities[0], entities: engine.entities, paused: false,
					gridCenter: gc, pull: [0, 0, 0, 0], bones: null, showBones: false,
					view, proj, viewport: [640, 640], focal: [focalY, focalY] });
				if (fr % 20 === 19) await device.queue.onSubmittedWorkDone();
			}
		}
		// 마지막 중심에서 정지(추가 스폰 없음)한 채 나무가 자라도록 더 돌린 뒤 저지연 근접 촬영.
		// 카메라는 활성 스폰 무게중심을 겨눠 나무들이 화면 중앙에 오게 한다(무대 비주얼 없이 실루엣만).
		{
			const cx = CENTERS[CENTERS.length - 1];
			const active = HktGenesisScatter.candidates(world, cx, 0, CFG.radius, CFG)
				.filter((c) => c.kind === 'tree' && stream.slotForKey(c.key) != null);
			let mx = cx, mz = 0;
			if (active.length) { mx = 0; mz = 0; for (const c of active) { mx += c.x; mz += c.z; } mx /= active.length; mz /= active.length; }
			const gc = engine.bubbleCenter([mx, 1, mz]);
			const view = HktMat.lookAt([mx, 5.5, mz + 13], [mx, 1.3, mz], [0, 1, 0]);
			for (let fr = 0; fr < 220; fr++) {
				simTime += dt;
				engine.frame({ dt, time: simTime, genes: engine.entities[0], entities: engine.entities, paused: false,
					gridCenter: gc, pull: [0, 0, 0, 0], bones: null, showBones: false,
					view, proj, viewport: [640, 640], focal: [focalY, focalY] });
				if (fr % 20 === 19 && fr !== 219) await device.queue.onSubmittedWorkDone();
			}
			panDataUrl = await grab();
		}

		// ── ② 불×나무 임의 좌표: 스트리밍된 쌍의 연소 상호작용 vs 대조군 ────────
		// 팬으로 오염된 슬롯을 전부 void 로 리셋한 뒤, 임의 좌표로 스트림을 이동시킨다.
		bakeAt(target[0], target[2]);
		// 스트림 상태 초기화 — 모든 슬롯 void 로
		for (let s = 0; s < 8; s++) { engine.respawnEntity(s, HktGenesisScatter.voidEntity()); }
		stream.keyAt = new Array(8).fill(null); stream.slotOf = {};
		const fst = stream.update(target[0], target[2]);
		const treeSlot = stream.slotForKey(treeKey), fireSlot = stream.slotForKey(fireKey);
		const pairActive = treeSlot != null && fireSlot != null;

		const slice = N / 8;
		const gcB = engine.bubbleCenter(target);
		const viewB = HktMat.lookAt([target[0] + 2.6, target[1] + 2.0, target[2] + 4.2], [target[0], target[1] + 1.0, target[2]], [0, 1, 0]);
		// 나무 슬롯 스플랫의 가열 비율(misc.z=heat, idx 10) — 불×나무 상호작용 지표
		async function readTreeHeat() {
			const sb = device.createBuffer({ size: N * 48, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyBufferToBuffer(engine.splatBuf, 0, sb, 0, N * 48);
			device.queue.submit([enc.finish()]);
			await sb.mapAsync(GPUMapMode.READ);
			const sp = new Float32Array(sb.getMappedRange());
			let heated = 0, burned = 0;
			const o0 = treeSlot * slice;
			for (let i = 0; i < slice; i++) {
				const heat = sp[(o0 + i) * 12 + 10], fuel = sp[(o0 + i) * 12 + 11];
				if (heat > 0.2) heated++;
				if (fuel < 0.9) burned++;
			}
			const r = { heated: heated / slice, burned: burned / slice };
			sb.unmap(); sb.destroy();
			return r;
		}
		const runFrames = async (F, capture) => {
			let url = null;
			for (let fr = 0; fr < F; fr++) {
				simTime += dt;
				engine.frame({ dt, time: simTime, genes: engine.entities[0], entities: engine.entities, paused: false,
					gridCenter: gcB, pull: [0, 0, 0, 0], bones: null, showBones: false,
					view: viewB, proj, viewport: [640, 640], focal: [focalY, focalY] });
				if (fr % 20 === 19 && !(capture && fr === F - 1)) await device.queue.onSubmittedWorkDone();
			}
			if (capture) url = await grab();
			return url;
		};
		const FIRE_FRAMES = 240;
		const fireDataUrl = await runFrames(FIRE_FRAMES, true);
		const withFire = await readTreeHeat();

		// 대조군: 같은 위치에 나무를 새로 심고(fuel/heat 리셋) 불 슬롯은 void — 같은 프레임 수 후 가열 ~0
		engine.respawnEntity(fireSlot, HktGenesisScatter.voidEntity());
		engine.respawnEntity(treeSlot, HktGenesisScatter.genesFor({ kind: 'tree', x: P.treeX, z: P.treeZ }));
		await runFrames(FIRE_FRAMES, false);
		const noFire = await readTreeHeat();

		return {
			gpuErrs, panDataUrl, fireDataUrl,
			seenCount: seen.size, maxActive, perStep,
			pairActive, treeSlot, fireSlot, fireCands: fst.candidates,
			withFire, noFire,
		};
	}, { SEED, N, CENTERS, CFG, target, treeKey: pair.tree.key, fireKey: pair.fire.key, treeX: pair.tree.x, treeZ: pair.tree.z });

	if (result.gpuErrs.length) { console.error('GPU 오류:', result.gpuErrs); await browser.close(); server.close(); process.exit(1); }
	savePng(result.panDataUrl, path.resolve(outPan));
	savePng(result.fireDataUrl, path.resolve(outFire));

	console.log('① 팬 스텝:', result.perStep.map((s) => `cx${s.cx}:활성${s.active}(+${s.spawned}/-${s.removed})`).join(' '));
	console.log(`   합집합 ${result.seenCount} · 최대 활성 ${result.maxActive}`);
	console.log(`② 불×나무: 쌍 활성 ${result.pairActive}(나무 슬롯 ${result.treeSlot}·불 슬롯 ${result.fireSlot}) · ` +
		`가열(불) ${(result.withFire.heated * 100).toFixed(1)}% 연소 ${(result.withFire.burned * 100).toFixed(1)}% vs 대조군 가열 ${(result.noFire.heated * 100).toFixed(1)}%`);

	// 판정: ① 결정론 + ② 슬롯 교체(합집합 > 최대활성) + 상한 유지 + ③ 불×나무 성립(가열 대비)
	const rotated = result.seenCount > result.maxActive;
	const bounded = result.maxActive <= 8 && result.maxActive > 0;
	const interact = result.pairActive && result.withFire.heated > 0.02 && result.noFire.heated < 0.005;
	const ok = detOk && rotated && bounded && interact && result.gpuErrs.length === 0;
	console.log(`저장: ${outPan}, ${outFire}`);
	console.log(`판정: 결정론 ${detOk} · 슬롯교체 ${rotated}(합집합 ${result.seenCount}>최대활성 ${result.maxActive}) · ` +
		`상한 ${bounded} · 불×나무 ${interact}(가열 ${(result.withFire.heated * 100).toFixed(1)}% vs ${(result.noFire.heated * 100).toFixed(1)}%) → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
