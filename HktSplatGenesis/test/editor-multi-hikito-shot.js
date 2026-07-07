// 다중 히키토 검증 — editor.html 에서 히키토 2개를 서로 떨어뜨려 배치하고,
//  ① 데이터 모델: 두 살 인스턴스가 서로 다른 boneBase(전역 뼈 테이블의 제 구간)를 갖는지
//  ② 렌더: 살 픽셀이 좌/우 두 덩어리로 분리되는지(가운데 골짜기) — 하나로 뭉치던 버그의 회귀 가드
// 를 확인한다. 이전 버그: 살(fleshK) 개체 전부가 단일 스켈레톤으로 모여 한 덩어리가 됐다.
//
// 사용: node editor-multi-hikito-shot.js [out.png] [frames=40] [count=32768]
// 함정: swapchain readback 은 마지막 frame 과 같은 태스크여야 한다 (present 함정 — README).
const { serve, launch, collectErrors, savePng } = require('./_common');

(async () => {
	const out = process.argv[2] || 'multi-hikito.png';
	const FRAMES = parseInt(process.argv[3] || '40');
	const COUNT = process.argv[4] || '32768';
	const server = await serve(8137);
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
	await page.goto('http://localhost:8137/editor.html', { waitUntil: 'load' });
	await page.waitForFunction(() => window.HktGenesisEditor && window.HktGenesisEditor.ready,
		null, { timeout: 30000, polling: 200 });
	await page.selectOption('#count', COUNT);

	// 히키토 2개를 x 축으로 크게 벌려 배치 (지형 없음 = 평면 바닥). 슬라이스 2등분.
	await page.evaluate(() => {
		const E = window.HktGenesisEditor;
		E.addObject('히키토', -2.0, 0.0);
		E.addObject('히키토', 2.0, 0.0);
		E.setClip('walk');
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

	// 마지막 프레임 + 같은 태스크 readback → 살 픽셀의 가로 히스토그램으로 분리 판정
	const shot = await page.evaluate(async (t) => {
		let cap = null;
		window.__hktAfterFrame = ({ device, context, canvas }) => {
			const w = canvas.width, h = canvas.height;
			const bpr = w * 4;
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
		if (!cap) return { err: '훅 미실행 — editor.js 배선 확인' };
		if (cap.badBpr) return { err: 'bytesPerRow 256 배수 아님: ' + cap.badBpr };

		await cap.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(cap.rb.getMappedRange());
		const w = cap.w, h = cap.h;
		// 살 판정: 에디터 배경은 불투명 근흑색(≈rgb 3,4,8) 이라 alpha 는 전면 255 — 밝기로 가른다.
		// 히키토 살은 따뜻한 밝은 색(colorA #7a3b2a ~ colorB #ffd9a8)이라 rgb 합이 배경보다 크게 높다.
		const col = new Array(w).fill(0);
		let lifePx = 0, minX = w, maxX = 0;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const o = (y * w + x) * 4;
				if (px[o] + px[o + 1] + px[o + 2] > 60) { col[x]++; lifePx++; if (x < minX) minX = x; if (x > maxX) maxX = x; }
			}
		}
		// 캔버스에 그대로 옮겨 PNG (bgra/rgba 무관 — 분리 판정은 alpha 만 씀)
		const c = document.createElement('canvas');
		c.width = w; c.height = h;
		const g2 = c.getContext('2d');
		const img = g2.createImageData(w, h);
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		for (let i = 0; i < w * h; i++) {
			img.data[i * 4 + 0] = px[i * 4 + (bgra ? 2 : 0)];
			img.data[i * 4 + 1] = px[i * 4 + 1];
			img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)];
			img.data[i * 4 + 3] = 255;
		}
		g2.putImageData(img, 0, 0);

		// 좌/우 피크와 가운데 골짜기: 살 픽셀 x 범위를 3등분해 각 구간 합을 본다.
		// 두 인스턴스가 분리되면 좌·우 구간에 픽셀이 몰리고 가운데는 골짜기가 생긴다.
		let leftSum = 0, midSum = 0, rightSum = 0;
		if (maxX > minX) {
			const a = minX + (maxX - minX) / 3, b = minX + 2 * (maxX - minX) / 3;
			for (let x = minX; x <= maxX; x++) {
				if (x < a) leftSum += col[x]; else if (x < b) midSum += col[x]; else rightSum += col[x];
			}
		}
		return {
			dataUrl: c.toDataURL('image/png'), lifePx, minX, maxX, w,
			leftSum, midSum, rightSum,
			debug: window.HktGenesisEditor.debug(),
		};
	}, ts + 50);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	const dbg = shot.debug;
	const flesh = dbg.flesh || [];
	// 골짜기 비율: 가운데 밀도가 좌·우 최소보다 충분히 낮으면 두 덩어리로 분리된 것.
	const sidesMin = Math.min(shot.leftSum, shot.rightSum);
	const valleyRatio = sidesMin > 0 ? shot.midSum / sidesMin : 99;
	console.log(`저장: ${out} · 살 픽셀 ${shot.lifePx} · x[${shot.minX}..${shot.maxX}]/${shot.w}`);
	console.log(`좌 ${shot.leftSum} 중 ${shot.midSum} 우 ${shot.rightSum} · 골짜기비 ${valleyRatio.toFixed(2)}`);
	console.log('살 인스턴스:', JSON.stringify(flesh));

	const real = errors.filter((e) => !e.includes('404'));
	// 판정:
	//  ① 두 살 인스턴스가 서로 다른 boneBase (= 서로 다른 스켈레톤 참조), boneCount 동일·양수
	//  ② 살 렌더 존재 + 가로로 넓게 퍼짐(단일 덩어리 아님) + 가운데 골짜기(좌우 분리)
	const distinctBase = flesh.length === 2 && flesh[0].boneBase !== flesh[1].boneBase
		&& flesh[0].boneCount > 0 && flesh[1].boneCount === flesh[0].boneCount
		&& flesh[1].boneBase === flesh[0].boneCount;
	const separated = shot.lifePx > 800 && shot.leftSum > 300 && shot.rightSum > 300 && valleyRatio < 0.6;
	const ok = distinctBase && separated && dbg.entities === 2 && real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({
		distinctBase, separated, lifePx: shot.lifePx, valleyRatio,
		leftSum: shot.leftSum, midSum: shot.midSum, rightSum: shot.rightSum, flesh, entities: dbg.entities, errors: real,
	}));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
