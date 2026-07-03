// S2 충돌 지형 검증 — 같은 height() 로 만든 무대 PLY + collider GLB 를 로드하고,
// 슬라임을 지형 위에 떨어뜨려 (1) 침투 없음 (2) 지형 표면 정착을 스플랫 readback 지표로
// 판정 + 무대·생명 합성 PNG 촬영. 평면 바닥 회귀면 지표 (2) 가 반드시 깨진다
// (중앙 지형 높이 ≈ 0.6 — 평면 y=0 에 앉으면 |y-ground| ≈ 0.6).
//
// 사용: node terrain-shot.js out.png [frames=110] [count=65536] [preset=슬라임]
const { serve, launch, collectErrors, savePng } = require('./_common');
const { genTerrainPly, genTerrainGlb, HEIGHT_SRC } = require('./_fixture');

(async () => {
	const out = process.argv[2] || 'terrain.png';
	const FRAMES = parseInt(process.argv[3] || '110');
	const COUNT = process.argv[4] || '65536';
	const PRESET = process.argv[5] || '슬라임';
	const ply = genTerrainPly(), glb = genTerrainGlb();
	const server = await serve(8135, {
		'/assets/worlds/test-terrain.ply': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(ply); },
		'/assets/worlds/test-terrain.glb': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(glb); },
	});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a);
			window.__device = d;
			return d;
		};
	});
	await page.goto('http://localhost:8135/?world=/assets/worlds/test-terrain.ply&collider=/assets/worlds/test-terrain.glb', { waitUntil: 'load' });
	// 무대(Spark)와 충돌 지형(heightfield) 양쪽 준비 대기 — stCollide 는 applyCollider 가 켠다
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld
			&& document.getElementById('stCollide').checked,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('무대/collider 준비 초과 — 상태:', await page.evaluate(() => document.getElementById('stageStatus').textContent));
		console.error('콘솔 오류:', errors);
		process.exit(1);
	}
	console.log('무대+collider 준비:', await page.evaluate(() => document.getElementById('stageStatus').textContent));
	await page.selectOption('#count', COUNT);
	// 프리셋 또는 장면(불×나무) 버튼 — 이름으로 탐색
	await page.evaluate((n) => [...document.querySelectorAll('#presets button, #scenes button')]
		.find((b) => b.textContent === n).click(), PRESET);

	let ts = 1000;
	for (let i = 0; i < FRAMES; i++) {
		ts += 50;
		await page.evaluate(async (t) => {
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			if (window.__device) await window.__device.queue.onSubmittedWorkDone();
		}, ts);
	}

	// 마지막 프레임 + 같은 태스크 readback (스왑체인 + 스플랫 버퍼) → 합성/지표
	const shot = await page.evaluate(async ({ t, heightSrc }) => {
		const height = new Function('return ' + heightSrc)();
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas, camera, engine }) => {
			const w = canvas.width, h = canvas.height;
			const bpr = w * 4;
			if (bpr % 256 !== 0) { cap = { err: 'bytesPerRow: ' + bpr }; return; }
			const rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const sb = device.createBuffer({ size: engine.count * 48, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [w, h, 1]);
			enc.copyBufferToBuffer(engine.splatBuf, 0, sb, 0, engine.count * 48);
			device.queue.submit([enc.finish()]);
			cap = { device, rb, sb, w, h, camera, engine };
		};
		const cbs = window.__rafCbs; window.__rafCbs = [];
		for (const cb of cbs) cb(t);
		window.__hktAfterFrame = null;
		if (!cap) return { err: '훅 미실행' };
		if (cap.err) return { err: cap.err };

		// ── 지표: 바닥 포락선 추종 — 덩어리는 두꺼우므로 XZ 빈별 최저 y 가 지형을 따라야 한다.
		// 같은 포락선을 평면(y=0)과도 비교해 지형이 명백히 더 맞는 해임을 판정 (평면 회귀 감지)
		await cap.sb.mapAsync(GPUMapMode.READ);
		const sp = new Float32Array(cap.sb.getMappedRange());
		const n = cap.engine.count;
		const BIN = 0.3, bins = new Map();
		let pen = 0;
		for (let i = 0; i < n; i++) {
			const x = sp[i * 12], y = sp[i * 12 + 1], z = sp[i * 12 + 2];
			if (y - height(x, z) < -0.1) pen++;
			const k = Math.floor(x / BIN) + ':' + Math.floor(z / BIN);
			const b = bins.get(k) || { minY: 1e9, cnt: 0, sx: 0, sz: 0 };
			b.minY = Math.min(b.minY, y); b.cnt++; b.sx += x; b.sz += z;
			bins.set(k, b);
		}
		let nb = 0, devTerrain = 0, devPlane = 0;
		for (const b of bins.values()) {
			if (b.cnt < 30) continue; // 흩어진 방울 제외 — 본체 바닥만
			nb++;
			devTerrain += Math.abs(b.minY - height(b.sx / b.cnt, b.sz / b.cnt));
			devPlane += Math.abs(b.minY);
		}
		devTerrain /= Math.max(nb, 1); devPlane /= Math.max(nb, 1);
		const hfOn = !!cap.engine._hf;

		// ── 합성 사진 (stage-shot 과 동일 절차) ──
		const stageUrl = HktGenesisStage.capture(cap.camera, innerWidth, innerHeight);
		await cap.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(cap.rb.getMappedRange());
		const img = new Image();
		await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = stageUrl; });
		const c = document.createElement('canvas');
		c.width = cap.w; c.height = cap.h;
		const g2 = c.getContext('2d');
		g2.drawImage(img, 0, 0, cap.w, cap.h);
		const view = g2.getImageData(0, 0, cap.w, cap.h);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		for (let i = 0; i < cap.w * cap.h; i++) {
			const lr = px[i * 4 + (bgra ? 2 : 0)], lg = px[i * 4 + 1], lb = px[i * 4 + (bgra ? 0 : 2)], la = px[i * 4 + 3];
			const ia = 1 - la / 255;
			view.data[i * 4 + 0] = Math.min(255, lr + view.data[i * 4 + 0] * ia);
			view.data[i * 4 + 1] = Math.min(255, lg + view.data[i * 4 + 1] * ia);
			view.data[i * 4 + 2] = Math.min(255, lb + view.data[i * 4 + 2] * ia);
			view.data[i * 4 + 3] = 255;
		}
		g2.putImageData(view, 0, 0);
		return {
			dataUrl: c.toDataURL('image/png'), hfOn,
			penFrac: pen / n, bins: nb, devTerrain, devPlane,
		};
	}, { t: ts + 50, heightSrc: HEIGHT_SRC });

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	console.log(`저장: ${out} · hf=${shot.hfOn} · 침투 ${(shot.penFrac * 100).toFixed(1)}% · 빈 ${shot.bins}개` +
		` · 바닥편차 지형 ${shot.devTerrain.toFixed(3)} vs 평면 ${shot.devPlane.toFixed(3)}`);
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: heightfield 설치 + 침투 없음. 바닥 포락선 지표(지형 밀착 <0.2, 평면 가설 대비 +0.15
	// 우위 — 평면 회귀면 devTerrain ≈ 지형고 ≈ 0.6 으로 반드시 깨진다)는 바닥에 앉는 방울
	// 프리셋(슬라임)에만 성립한다 — 나무/불은 스플랫이 공중(가지·플룸)에 있어 눈 검증(사진).
	const envelopeOk = shot.bins >= 5 && shot.devTerrain < 0.2 && shot.devPlane > shot.devTerrain + 0.15;
	const ok = shot.hfOn && shot.penFrac < 0.06 && (PRESET !== '슬라임' || envelopeOk) && real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({ ...shot, dataUrl: undefined, errors: real }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
