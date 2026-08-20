// FX Lab 페이지 스모크 — 랩이 *페이지로서* 뜨는가.
//
// fx-shot.js / life-shot.js 는 엔진을 직접 구동하는 하니스라 index.html 을 지나가지 않는다.
// 그런데 이 랩에서 실제로 바뀐 것은 그 index.html 의 경로다 — 스플랫 런타임이 기반 자리
// (engine/view-kernel/fx/splat/)로 옮겨갔다. 그래서 "페이지가 그 런타임을 찾아 부팅하고,
// 이펙트를 켜는 배선이 살아 있는가" 를 따로 본다.
//
// 판정
//   ① 부팅한다     — __lifeReady (WebGPU 어댑터 · 셰이더 · 첫 장면까지 통과했다는 뜻)
//   ② 런타임이 있다 — 전역 9종(engine/wgsl/fx/…)이 기반 자리에서 실려 있다
//   ③ 그린다       — 스왑체인에 배경 아닌 픽셀이 있다 (살이 응축돼 있다)
//   ④ 켜진다       — 이펙트를 켜면 앱이 세는 살아 있는 이벤트 수가 는다
//   ⑤ 오류 0       — 페이지 오류 · GPU 오류 없음
//
// 이펙트가 *어떻게 생겼는가*(방사인가 · 링인가 · 꺼지는가)는 여기서 재지 않는다 — 그것은
// fx-shot.js 의 몫이다. 이유는 비용이다: 소프트웨어 래스터라이저(swiftshader)에서 이펙트가
// 화면을 덮으면 GPU 큐가 밀려, 그 프레임의 readback(mapAsync)이 몇 분이 지나도 돌아오지
// 않는다. 그래서 이 스모크는 픽셀을 *정적인 프레임에서만* 읽고, 이펙트는 앱 자신의 계수
// (fx.activeCount → fps 표시줄)로 판정한다.
//
// 사용: node lab-smoke.js [png=lab-smoke.png]
const path = require('path');
const { serve, launch, collectErrors, savePng, LAB } = require('./_common');

const [out = 'lab-smoke.png'] = process.argv.slice(2);

(async () => {
	const server = await serve(8156);
	const browser = await launch();
	// 작은 뷰포트 — 판정에 필요한 것은 해상도가 아니라 픽셀의 유무이고,
	// 소프트웨어 GPU 에서 면적은 그대로 대기 시간이다.
	const page = await browser.newPage({ viewport: { width: 240, height: 180 } });
	const errors = collectErrors(page);
	if (process.env.FXLAB_TRACE) {
		page.on('console', (m) => console.error('[page]', m.text()));
		page.on('pageerror', (e) => console.error('[pageerror]', e.message));
	}
	await page.goto(`http://localhost:8156${LAB}/index.html`);

	// 부팅 — WebGPU(swiftshader)는 느리므로 넉넉히 기다린다
	await page.waitForFunction('window.__lifeReady === true', null, { timeout: 120000 });

	const globals = await page.evaluate(() => [
		'HktMat', 'HktOrbitCamera', 'HktHeightfield', 'HktGenesisGenes', 'HktGenesisGenome',
		'HktGenesisSkeleton', 'HktGenesisWGSL', 'HktGenesisEngine', 'HktGenesisFx',
	].filter((k) => !window[k]));

	// ── ③ 그린다 — 정적인 프레임 한 장.
	// 함정(_common.js 상단과 같다): frame() 과 copyTextureToBuffer 는 같은 태스크에서
	// 인코딩해야 present 전 화면을 잡는다. 그래서 앱 루프 훅 안에서 복사를 건다.
	const quiet = await page.evaluate(async () => {
		const g = await new Promise((resolve) => {
			let left = 3; // 살이 자리를 잡는 몇 프레임을 지나 보낸다
			window.__hktAfterFrame = ({ device, context, canvas }) => {
				if (--left > 0) return;
				window.__hktAfterFrame = null;
				const bpr = Math.ceil(canvas.width * 4 / 256) * 256;
				const rb = device.createBuffer({
					size: bpr * canvas.height,
					usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
				});
				const enc = device.createCommandEncoder();
				enc.copyTextureToBuffer({ texture: context.getCurrentTexture() },
					{ buffer: rb, bytesPerRow: bpr }, [canvas.width, canvas.height, 1]);
				device.queue.submit([enc.finish()]);
				resolve({ rb, bpr, w: canvas.width, h: canvas.height });
			};
		});
		await g.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(g.rb.getMappedRange());
		const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
		const c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
		const ctx2 = c.getContext('2d');
		const img = ctx2.createImageData(g.w, g.h);
		let lit = 0;
		for (let y = 0; y < g.h; y++) {
			for (let x = 0; x < g.w; x++) {
				const i = y * g.bpr + x * 4, o = (y * g.w + x) * 4;
				if (px[i] + px[i + 1] + px[i + 2] > 60) lit++; // 배경(어두운 남색)보다 밝다
				img.data[o] = px[i + (bgra ? 2 : 0)];
				img.data[o + 1] = px[i + 1];
				img.data[o + 2] = px[i + (bgra ? 0 : 2)];
				img.data[o + 3] = 255;
			}
		}
		ctx2.putImageData(img, 0, 0);
		g.rb.unmap();
		return { lit, dataUrl: c.toDataURL('image/png') };
	});
	savePng(quiet.dataUrl, path.resolve(out));

	// ── ④ 켜진다 — 앱이 세는 살아 있는 이벤트 수 (fps 표시줄의 "fx N").
	// 이것은 fx.activeCount(simTime) 그대로다 = 슬롯이 켜졌고 아직 수명 안이라는 뜻.
	const activeFx = () => page.evaluate(() => {
		const m = /fx (\d+)/.exec(document.getElementById('fps').textContent || '');
		return m ? parseInt(m[1], 10) : -1;
	});
	const before = await activeFx();
	await page.evaluate(() => window.__hktFire('타격'));
	let after = 0;
	for (let i = 0; i < 30 && after <= 0; i++) {
		after = await activeFx();
		if (after <= 0) await new Promise((r) => setTimeout(r, 200));
	}

	const gpuErrs = errors.filter((e) => e.includes('GPU 오류'));
	const real = errors.filter((e) => !e.includes('404'));
	console.log(`정적 프레임 픽셀 ${quiet.lit} · 저장: ${path.resolve(out)}`);
	console.log(`살아 있는 이펙트 이벤트: 발생 전 ${before} → 발생 후 ${after}`);

	const gates = [
		['부팅한다 (__lifeReady)', true],
		['런타임 전역 9종이 실린다', globals.length === 0],
		['그린다 (배경 아닌 픽셀 > 500)', quiet.lit > 500],
		['이펙트가 켜진다 (살아 있는 이벤트 ≥ 1)', before === 0 && after >= 1],
		['GPU 오류 0', gpuErrs.length === 0],
		['페이지 오류 0', real.length === 0],
	];
	for (const [label, ok] of gates) console.log(`판정: ${label} → ${ok ? 'OK' : '실패'}`);
	if (globals.length) console.log('없는 전역:', globals);
	if (real.length) console.log('오류:', real);
	const ok = gates.every(([, v]) => v);
	console.log(`판정: 종합 → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
