// A 트랙 개체별 애니메이션 (에디터) 검증 — 살(히키토) 2개 중 하나만 입력 상태 머신을 켠다.
//  · 왼쪽  = 애니 OFF → 장면 공용 클립(idle, 정지)
//  · 오른쪽 = 애니 ON  + 이동 강도 1.0 → 상태 머신이 idle→walk→run 전이 (다리 벌림)
// 판정:
//  ① 데이터: flesh 2개가 서로 다른 boneBase(독립 스켈레톤 참조), 오른쪽 anim='run'·왼쪽 anim=null
//     (= 개체별 사용 여부 선택이 실제로 상태 머신을 켜고 끈다)
//  ② 렌더: 두 살이 좌/우로 분리(가운데 골짜기) + 둘 다 렌더 존재
//  ③ (리포트) 하체 가로 퍼짐 — run 쪽이 idle 쪽보다 넓다(다리 스트라이드) — 사진으로도 눈 검증
//
// 사용: node editor-anim-shot.js [out.png] [frames=48] [count=32768]
const { serve, launch, collectErrors, savePng } = require('./_common');

(async () => {
	const out = process.argv[2] || 'editor-anim.png';
	const FRAMES = parseInt(process.argv[3] || '48');
	const COUNT = process.argv[4] || '32768';
	const server = await serve(8145);
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 996, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a); window.__device = d; return d;
		};
	});
	await page.goto('http://localhost:8145/editor.html', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisEditor && window.HktGenesisEditor.ready,
		null, { timeout: 30000, polling: 200 });
	await page.selectOption('#count', COUNT);

	// 히키토 2개 — 좌(정지 idle) / 우(애니 ON, 이동 강도 1 → run). 공용 클립은 idle 로 고정.
	const ids = await page.evaluate(() => {
		const E = window.HktGenesisEditor;
		E.setClip('idle');
		const a = E.addObject('히키토', -1.6, 0.0); // 좌: 애니 OFF (공용 idle)
		const b = E.addObject('히키토', 1.6, 0.0);  // 우: 애니 ON
		E.setObjectAnim(b, true);
		E.setObjectMove(b, 1.0);                    // moveMag 1 → walk 거쳐 run
		return { a, b };
	});

	let ts = 1000;
	for (let i = 0; i < FRAMES; i++) {
		ts += 50;
		await page.evaluate(async (t) => {
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			if (window.__device) await window.__device.queue.onSubmittedWorkDone();
		}, ts);
	}

	const shot = await page.evaluate(async (t) => {
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas }) => {
			const w = canvas.width, h = canvas.height, bpr = w * 4;
			if (bpr % 256 !== 0) { cap = { badBpr: bpr }; return; }
			const rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [w, h, 1]);
			device.queue.submit([enc.finish()]);
			cap = { device, rb, w, h };
		};
		const cbs = window.__rafCbs; window.__rafCbs = [];
		for (const cb of cbs) cb(t);
		window.__hktAfterFrame = null;
		if (!cap) return { err: '훅 미실행' };
		if (cap.badBpr) return { err: 'bpr ' + cap.badBpr };

		await cap.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(cap.rb.getMappedRange());
		const w = cap.w, h = cap.h;
		const lit = (o) => px[o] + px[o + 1] + px[o + 2] > 60;

		// 전체 살 픽셀 x·y 범위 + 세로 히스토그램(좌/우 분리 판정)
		const col = new Array(w).fill(0);
		let lifePx = 0, minX = w, maxX = 0, minY = h, maxY = 0;
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			const o = (y * w + x) * 4;
			if (lit(o)) { col[x]++; lifePx++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
		}
		let leftSum = 0, midSum = 0, rightSum = 0, splitX = (minX + maxX) / 2;
		if (maxX > minX) {
			const a = minX + (maxX - minX) / 3, b = minX + 2 * (maxX - minX) / 3;
			for (let x = minX; x <= maxX; x++) { if (x < a) leftSum += col[x]; else if (x < b) midSum += col[x]; else rightSum += col[x]; }
		}
		// 하체(아래 40%) 가로 퍼짐 — 좌/우 각 반쪽에서 다리 벌림 폭 측정
		const yLo = maxY - (maxY - minY) * 0.4;
		function legSpread(x0, x1) {
			let lo = w, hi = 0;
			for (let y = Math.floor(yLo); y <= maxY; y++) for (let x = x0; x < x1; x++) {
				if (lit((y * w + x) * 4)) { if (x < lo) lo = x; if (x > hi) hi = x; }
			}
			return hi > lo ? hi - lo : 0;
		}
		const idleLeg = legSpread(minX, Math.floor(splitX));       // 좌 = 정지 idle
		const runLeg = legSpread(Math.ceil(splitX), maxX + 1);     // 우 = run

		const c = document.createElement('canvas'); c.width = w; c.height = h;
		const g2 = c.getContext('2d'); const img = g2.createImageData(w, h);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		for (let i = 0; i < w * h; i++) {
			img.data[i * 4] = px[i * 4 + (bgra ? 2 : 0)];
			img.data[i * 4 + 1] = px[i * 4 + 1];
			img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)];
			img.data[i * 4 + 3] = 255;
		}
		g2.putImageData(img, 0, 0);
		return {
			dataUrl: c.toDataURL('image/png'), lifePx, minX, maxX, w,
			leftSum, midSum, rightSum, idleLeg, runLeg,
			debug: window.HktGenesisEditor.debug(),
		};
	}, ts + 50);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	const flesh = shot.debug.flesh || [];
	const byId = Object.fromEntries(flesh.map((f) => [f.id, f]));
	const A = byId[ids.a], B = byId[ids.b];
	const sidesMin = Math.min(shot.leftSum, shot.rightSum);
	const valleyRatio = sidesMin > 0 ? shot.midSum / sidesMin : 99;

	console.log(`저장: ${out} · 살 픽셀 ${shot.lifePx} · x[${shot.minX}..${shot.maxX}]/${shot.w}`);
	console.log(`좌 ${shot.leftSum} 중 ${shot.midSum} 우 ${shot.rightSum} · 골짜기비 ${valleyRatio.toFixed(2)}`);
	console.log(`상태: 좌(애니 ${A && A.anim}) 우(애니 ${B && B.anim}) · 하체폭 idle ${shot.idleLeg} vs run ${shot.runLeg}`);
	console.log('살 인스턴스:', JSON.stringify(flesh));

	const real = errors.filter((e) => !e.includes('404'));
	// ① 개체별 선택: 좌 애니 OFF(null) · 우 애니 ON 이고 이동으로 walk/run 도달
	const perEntity = A && B && A.anim === null && (B.anim === 'run' || B.anim === 'walk')
		&& A.boneBase !== B.boneBase && A.boneCount > 0 && B.boneCount > 0;
	// ② 두 살 분리 렌더
	const separated = shot.lifePx > 800 && shot.leftSum > 200 && shot.rightSum > 200 && valleyRatio < 0.7;
	const ok = perEntity && separated && shot.debug.entities === 2 && real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({ perEntity, separated, A, B, valleyRatio, lifePx: shot.lifePx, errors: real }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
