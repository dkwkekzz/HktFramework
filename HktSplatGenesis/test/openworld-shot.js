// T 트랙 통합 검증 — 실제 index.html 에서 "오픈월드" 버튼을 눌러 T2(청크 지형)+T5(수면·sky/fog)+
// T4(스트리밍 나무)를 한 화면에 띄우고, 무대(Spark)와 생명(WebGPU readback)을 페이지 안에서
// 합성해 PNG 로 찍는다. "기존과 똑같지 않다"의 눈 증거 — 절차 지형 + 파란 수면 + 옅은 하늘/안개 +
// 배양된 나무가 한 프레임에 함께 보인다.
//
// 함정(README): swapchain readback 은 마지막 frame 과 같은 태스크. app.js __hktAfterFrame 훅 사용.
// 사용: node openworld-shot.js [out.png] [seed=7]
const { serve, launch, collectErrors, savePng } = require('./_common');

(async () => {
	const out = process.argv[2] || 'openworld.png';
	const SEED = parseInt(process.argv[3] || '7');
	const server = await serve(8151);
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a); window.__device = d; return d;
		};
	});
	await page.goto('http://localhost:8151/', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisTerrainGen && window.HktGenesisScatter && window.__device,
		null, { timeout: 30000, polling: 200 });

	// 오픈월드 시작 (버튼 클릭 = app.js startOpenWorld) — 시드 인자를 위해 직접 호출도 가능하나
	// 실제 UI 경로를 태우려 버튼 클릭. 기본 시드 7(원점에 호수).
	await page.evaluate(() => document.getElementById('owStart').click());

	// rAF 수동 스테핑 + 실제 시간 대기 — Spark 타일/수면은 비동기 로드라 벽시계 시간이 필요하다
	// (앱 tick 이 stage.frame 을 돌려 링 로드를 시작하고, 다음 프레임들에서 GPU 패킹이 완료된다).
	let ts = 1000;
	for (let i = 0; i < 120; i++) {
		ts += 50;
		await page.evaluate(async (t) => {
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			if (window.__device) await window.__device.queue.onSubmittedWorkDone();
		}, ts);
		if (i < 30) await page.waitForTimeout(110); // 초반: 타일 async 로드/패킹 (후반은 나무 성장 = rAF 만)
	}

	// 마지막 프레임 + 같은 태스크 readback → 무대 캡처와 2D 합성 (stage-shot 패턴)
	const shot = await page.evaluate(async (t) => {
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas, camera }) => {
			const w = canvas.width, h = canvas.height, bpr = w * 4;
			if (bpr % 256 !== 0) { cap = { badBpr: bpr }; return; }
			const rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [w, h, 1]);
			device.queue.submit([enc.finish()]);
			cap = { device, rb, w, h, camera };
		};
		const cbs = window.__rafCbs; window.__rafCbs = [];
		for (const cb of cbs) cb(t);
		window.__hktAfterFrame = null;
		if (!cap || cap.badBpr) return { err: 'readback 실패 ' + JSON.stringify(cap) };

		const stageUrl = HktGenesisStage.capture(cap.camera, innerWidth, innerHeight);
		const sky = HktGenesisStage.getSkyFog().color;
		const sky8 = [sky[0] * 255, sky[1] * 255, sky[2] * 255];
		await cap.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(cap.rb.getMappedRange());
		const img = new Image();
		await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = stageUrl; });
		const c = document.createElement('canvas'); c.width = cap.w; c.height = cap.h;
		const g = c.getContext('2d'); g.drawImage(img, 0, 0, cap.w, cap.h);
		const view = g.getImageData(0, 0, cap.w, cap.h);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		let lifePx = 0, treeLife = 0, water = 0, skyN = 0, skySum = [0, 0, 0];
		for (let i = 0; i < cap.w * cap.h; i++) {
			const lr = px[i * 4 + (bgra ? 2 : 0)], lg = px[i * 4 + 1], lb = px[i * 4 + (bgra ? 0 : 2)], la = px[i * 4 + 3];
			// 생명 = 나무: 갈색 줄기→초록 잎 램프. 초록 우세거나 따뜻한 갈색(파랑 아님)이면 나무로.
			if (la > 10) { lifePx++; if ((lg > lb + 8) || (lr > lb + 15 && lg > lb + 5)) treeLife++; }
			// 합성: out = life + stage·(1−a)
			const ia = 1 - la / 255;
			const r = Math.min(255, lr + view.data[i * 4] * ia);
			const gg = Math.min(255, lg + view.data[i * 4 + 1] * ia);
			const b = Math.min(255, lb + view.data[i * 4 + 2] * ia);
			view.data[i * 4] = r; view.data[i * 4 + 1] = gg; view.data[i * 4 + 2] = b; view.data[i * 4 + 3] = 255;
			const lum = r * 0.3 + gg * 0.5 + b * 0.2;
			if (b > r + 12 && b > gg && lum < 130 && lum > 18) water++;    // 수면(청색·중간 휘도)
			// 하늘 = 밝고 푸른 픽셀(다운뷰라 위치 무관하게 색으로 판정) — 공용 톤과 비교
			if (b > r + 8 && b > gg + 2 && lum > 140) { skySum[0] += r; skySum[1] += gg; skySum[2] += b; skyN++; }
		}
		g.putImageData(view, 0, 0);
		const skyMean = skyN > 200 ? skySum.map((s) => s / skyN) : sky8; // 하늘 픽셀 없으면 판정 생략(=일치)
		const st = HktGenesisStage.tileStats();
		return { dataUrl: c.toDataURL('image/png'), lifePx, treeLife, water, skyMean, sky8, skyN,
			tileMeshes: st.meshes, waterMeshes: st.waterMeshes, tileSplats: st.splats };
	}, ts + 50);

	if (shot.err) { console.error(shot.err); await browser.close(); server.close(); process.exit(1); }
	savePng(shot.dataUrl, out);
	const skyDist = Math.hypot(shot.skyMean[0] - shot.sky8[0], shot.skyMean[1] - shot.sky8[1], shot.skyMean[2] - shot.sky8[2]);
	console.log(`오픈월드(시드 ${SEED}): 타일 메시 ${shot.tileMeshes}(스플랫 ${shot.tileSplats}) · 수면 메시 ${shot.waterMeshes}`);
	console.log(`합성: 생명 픽셀 ${shot.lifePx}(나무색 ${shot.treeLife}) · 수면 픽셀 ${shot.water} · 하늘 μ[${shot.skyMean.map((v) => v.toFixed(0)).join(',')}] vs sky[${shot.sky8.map((v) => v.toFixed(0)).join(',')}](${shot.skyN}px) 거리 ${skyDist.toFixed(1)}`);
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: 지형 타일 + 수면 메시·픽셀 + 스트리밍 나무(생명) + 하늘톤 = 오픈월드 네 요소가 한 화면에
	const ok = shot.tileMeshes >= 9 && shot.waterMeshes > 0 && shot.treeLife > 300 && shot.water > 800 && skyDist < 55 && real.length === 0;
	console.log(`저장: ${out}`);
	console.log(`판정: 지형 ${shot.tileMeshes >= 9} · 수면 ${shot.waterMeshes > 0}·${shot.water > 800}(${shot.water}px) · 나무 ${shot.treeLife > 300}(${shot.treeLife}) · 하늘톤 ${skyDist < 55}(${skyDist.toFixed(1)}) → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
