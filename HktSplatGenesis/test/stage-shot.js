// S1 무대 합성 촬영 — 실제 index.html 부트 + 절차 지형 fixture(PLY, 즉석 생성) 로드,
// 무대(WebGL, Spark)와 생명(WebGPU, readback) 을 페이지 안에서 합성해 PNG 로 찍는다.
// 무대는 "로드 대상"이므로 fixture 를 코드로 만드는 것은 절대 원칙 1 위배가 아니다 (생명이 아님).
//
// 사용: node stage-shot.js out.png [frames=30] [count=65536] [world=/assets/worlds/test-terrain.ply] [lod=0]
//   world 에 커밋된 샘플(/assets/worlds/sample-terrain.ply)을 주면 동봉 에셋 + Tiny-LoD(lod=1) 검증
// 함정: swapchain readback 은 마지막 frame 과 같은 태스크여야 한다 (present 함정 — README).
//       app.js 의 window.__hktAfterFrame 훅이 그 태스크 안에서 호출된다.
const { serve, launch, collectErrors, savePng } = require('./_common');
const { genTerrainPly } = require('./_fixture');

(async () => {
	const out = process.argv[2] || 'stage.png';
	const FRAMES = parseInt(process.argv[3] || '30');
	const COUNT = process.argv[4] || '65536';
	const WORLD = process.argv[5] || '/assets/worlds/test-terrain.ply';
	const LOD = process.argv[6] || '0';
	const ply = genTerrainPly();
	const server = await serve(8134, {
		'/assets/worlds/test-terrain.ply': (req, res) => {
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
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a);
			window.__device = d;
			return d;
		};
	});
	await page.goto(`http://localhost:8134/?world=${WORLD}&lod=${LOD}`, { waitUntil: 'load' });
	// Spark 로드는 rAF 와 무관(fetch+parse) — hasWorld 플래그로 대기
	// (#stageStatus DOM 은 app.js tick 이 콜백을 바인딩해야 갱신되는데 rAF 가 스텁이라 안 돈다)
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('무대 로드 대기 초과 — 콘솔 오류:', errors);
		process.exit(1);
	}
	console.log('무대: 월드 로드 완료 (hasWorld)');
	await page.selectOption('#count', COUNT);

	let ts = 1000;
	for (let i = 0; i < FRAMES; i++) {
		ts += 50;
		await page.evaluate(async (t) => {
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			if (window.__device) await window.__device.queue.onSubmittedWorkDone();
		}, ts);
	}

	// 마지막 프레임 + 같은 태스크 readback → 무대 캡처와 2D 캔버스 합성
	const shot = await page.evaluate(async (t) => {
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas, camera }) => {
			const w = canvas.width, h = canvas.height;
			const bpr = w * 4; // 뷰포트 768 → 3072 = 256 배수 (copyTextureToBuffer 요건)
			if (bpr % 256 !== 0) { cap = { badBpr: bpr }; return; }
			const rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [w, h, 1]);
			device.queue.submit([enc.finish()]);
			cap = { device, rb, w, h, camera };
		};
		const cbs = window.__rafCbs; window.__rafCbs = [];
		for (const cb of cbs) cb(t); // 이 안에서 훅이 same-task 로 실행된다
		window.__hktAfterFrame = null;
		if (!cap) return { err: '훅 미실행 — app.js 배선 확인' };
		if (cap.badBpr) return { err: 'bytesPerRow 256 배수 아님: ' + cap.badBpr + ' — 뷰포트 폭을 64px 배수로' };

		const stageUrl = HktGenesisStage.capture(cap.camera, innerWidth, innerHeight);
		await cap.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(cap.rb.getMappedRange());
		const img = new Image();
		await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = stageUrl; });
		const c = document.createElement('canvas');
		c.width = cap.w; c.height = cap.h;
		const g = c.getContext('2d');
		g.drawImage(img, 0, 0, cap.w, cap.h);
		const view = g.getImageData(0, 0, cap.w, cap.h);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		let lifePx = 0, stageSum = 0, stageSq = 0;
		for (let i = 0; i < cap.w * cap.h; i++) {
			const lr = px[i * 4 + (bgra ? 2 : 0)], lg = px[i * 4 + 1], lb = px[i * 4 + (bgra ? 0 : 2)], la = px[i * 4 + 3];
			const lum = view.data[i * 4] * 0.3 + view.data[i * 4 + 1] * 0.5 + view.data[i * 4 + 2] * 0.2;
			stageSum += lum; stageSq += lum * lum;
			if (la > 10) lifePx++;
			const ia = 1 - la / 255; // premultiplied over: out = life + stage·(1−a)
			view.data[i * 4 + 0] = Math.min(255, lr + view.data[i * 4 + 0] * ia);
			view.data[i * 4 + 1] = Math.min(255, lg + view.data[i * 4 + 1] * ia);
			view.data[i * 4 + 2] = Math.min(255, lb + view.data[i * 4 + 2] * ia);
			view.data[i * 4 + 3] = 255;
		}
		g.putImageData(view, 0, 0);
		const n = cap.w * cap.h;
		const mean = stageSum / n, sd = Math.sqrt(Math.max(0, stageSq / n - mean * mean));
		return { dataUrl: c.toDataURL('image/png'), lifePx, stageMean: mean, stageSd: sd };
	}, ts + 50);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	console.log(`저장: ${out} · 생명 픽셀 ${shot.lifePx} · 무대 휘도 μ${shot.stageMean.toFixed(1)} σ${shot.stageSd.toFixed(1)}`);
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: 생명이 실제로 그려졌고(투명 클리어 위 스플랫), 무대가 단색이 아니어야(지형 요철) 한다
	const ok = shot.lifePx > 500 && shot.stageSd > 4 && real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({ lifePx: shot.lifePx, stageSd: shot.stageSd, errors: real }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
