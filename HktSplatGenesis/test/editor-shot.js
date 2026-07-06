// 에디터 촬영 검증 — editor.html 부트 후 세 기둥을 API 로 구동:
//  ① 지형 생성 (시드 fBm → Spark 무대 + collider heightfield)
//  ② 오브젝트 배치 (프리셋 5개 → void 패딩으로 개체 8 슬라이스)
//  ③ 애니메이션 (히키토 배치 + walk 클립 + 타임라인 스크럽)
// 무대(WebGL)와 생명(WebGPU readback)을 페이지 안에서 합성해 PNG 로 찍고 판정한다.
//
// 사용: node editor-shot.js out.png [frames=50] [count=65536]
// 함정: swapchain readback 은 마지막 frame 과 같은 태스크여야 한다 (present 함정 — README).
//       뷰포트 폭은 (창폭 - 216 - 268) * 4 가 256 배수가 되게 — 창폭 996 → 캔버스 512.
const { serve, launch, collectErrors, savePng } = require('./_common');

(async () => {
	const out = process.argv[2] || 'editor.png';
	const FRAMES = parseInt(process.argv[3] || '50');
	const COUNT = process.argv[4] || '65536';
	const server = await serve(8136);
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 996, height: 640 } });
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
	await page.goto('http://localhost:8136/editor.html', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisEditor && window.HktGenesisEditor.ready,
		null, { timeout: 30000, polling: 200 });
	await page.selectOption('#count', COUNT);

	// ① 지형 생성 → 무대 로드 대기 (Spark 로드는 rAF 무관 — hasWorld 플래그)
	await page.evaluate(() => window.HktGenesisEditor.generateTerrain({ seed: 8, amp: 0.9, scale: 3.2, octaves: 4, extent: 4.8 }));
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('무대 로드 대기 초과 — 콘솔 오류:', errors);
		process.exit(1);
	}
	console.log('지형: 생성 + 무대 로드 완료');

	// ② 배치: 프리셋 5개 → 개체 슬라이스 8 (void 3 패딩 — 2^k 제약 검증)
	// ③ 히키토 = 살(fleshK) — 스켈레톤이 배치 지점으로 이동, walk 클립
	await page.evaluate(() => {
		const E = window.HktGenesisEditor;
		E.addObject('나무', -1.0, 0.4);
		E.addObject('불의 정령', 0.2, -0.8);
		E.addObject('슬라임', 1.4, 1.0);
		E.addObject('물', -2.0, -1.6);
		E.addObject('히키토', 1.2, -1.8);
		E.setClip('walk');
		E.setTime(2.5); // 타임라인 스크럽 경로
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

	// 마지막 프레임 + 같은 태스크 readback → 무대 캡처와 2D 캔버스 합성 (stage-shot 과 동일 정식)
	const shot = await page.evaluate(async (t) => {
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas, camera }) => {
			const w = canvas.width, h = canvas.height;
			const bpr = w * 4;
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
		if (!cap) return { err: '훅 미실행 — editor.js 배선 확인' };
		if (cap.badBpr) return { err: 'bytesPerRow 256 배수 아님: ' + cap.badBpr + ' — 창폭을 조정할 것' };

		const gpuCanvas = document.getElementById('gpu');
		const stageUrl = HktGenesisStage.capture(cap.camera, gpuCanvas.clientWidth, gpuCanvas.clientHeight);
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
			const ia = 1 - la / 255; // premultiplied over
			view.data[i * 4 + 0] = Math.min(255, lr + view.data[i * 4 + 0] * ia);
			view.data[i * 4 + 1] = Math.min(255, lg + view.data[i * 4 + 1] * ia);
			view.data[i * 4 + 2] = Math.min(255, lb + view.data[i * 4 + 2] * ia);
			view.data[i * 4 + 3] = 255;
		}
		g.putImageData(view, 0, 0);
		const n = cap.w * cap.h;
		const mean = stageSum / n, sd = Math.sqrt(Math.max(0, stageSq / n - mean * mean));
		return {
			dataUrl: c.toDataURL('image/png'), lifePx, stageMean: mean, stageSd: sd,
			debug: window.HktGenesisEditor.debug(),
		};
	}, ts + 50);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	const dbg = shot.debug;
	console.log(`저장: ${out} · 생명 픽셀 ${shot.lifePx} · 무대 휘도 μ${shot.stageMean.toFixed(1)} σ${shot.stageSd.toFixed(1)}`);
	console.log('에디터 상태:', JSON.stringify(dbg));
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: 생명 렌더 + 무대 요철 + 배치 5/슬라이스 8(void 패딩) + heightfield 커버리지 + 스켈레톤 walk
	const ok = shot.lifePx > 500 && shot.stageSd > 4
		&& dbg.objects.length === 5 && dbg.entities === 8
		&& dbg.coverage > 0.5 && dbg.terrain && dbg.terrain.seed === 8
		&& dbg.skeleton.clip === 'walk'
		&& real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({ lifePx: shot.lifePx, stageSd: shot.stageSd, dbg, errors: real }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
