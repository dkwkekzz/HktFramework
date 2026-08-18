// HktSplatLife F1 이펙트 검증 — 이벤트 구동 이펙트가 "켜지고 · 다르고 · 꺼지는가".
//
// 이펙트는 시간축 현상이라 한 장 촬영으로는 판정할 수 없다. 같은 장면을 굴리며
// 여러 시점을 촬영하고 (사전 / 발생 직후 / 수명 후) 픽셀 지표로 계약을 검증한다:
//   ① 켜진다   — 이벤트 전 0 → 발생 직후 유의미한 픽셀
//   ② 꺼진다   — lifeBase 를 지나면 다시 0 (슬롯 재사용의 전제)
//   ③ 다르다   — 타격(지향성)과 폭발(등방·팽창)이 *게놈만으로* 갈린다:
//                 타격은 축(+x)으로 무게중심이 치우치고, 폭발은 원점 근방에서 더 크게 퍼진다
//   ④ GPU 오류 0
// 사용: node fx-shot.js [outPrefix=fx] [N=16384]
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE } = require('./_common');

const [outPrefix = 'fx', nArg = '16384'] = process.argv.slice(2);

// 페이지 컨텍스트 구동 루프 — 지정 프레임마다 스왑체인을 readback 한다.
// 함정(_common.js 상단): frame() 과 copyTextureToBuffer 는 같은 태스크에서 인코딩해야
// present 전 화면을 잡는다. mapAsync 는 나중에 몰아서 await 해도 사본은 이미 떠 있다.
const DRIVE_FX = `
async function driveFx({ FRAMES, N, entities, shots, events, eye, center, makeBones }) {
	const ad = await navigator.gpu.requestAdapter();
	const device = await ad.requestDevice();
	const gpuErrs = [];
	device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
	const ctx = document.getElementById('gpu').getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat();
	ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
	const engine = new HktGenesisEngine(device, ctx, format);
	engine.setScene(N, entities.ents);
	const view = HktMat.lookAt(eye, center, [0, 1, 0]);
	const proj = HktMat.perspective(0.9, 1.0, 0.05, 100);
	const focalY = 0.5 * 640 / Math.tan(0.45);
	const dt = 1 / 60;
	const bpr = 640 * 4;
	let simTime = 0;
	const grabs = [];
	for (let fr = 0; fr < FRAMES; fr++) {
		simTime += dt;
		for (const ev of events) if (ev.frame === fr) entities.fx.trigger(ev.name, Object.assign({ time: simTime }, ev.at));
		engine.frame({
			dt, time: simTime, entities: entities.ents, genes: entities.ents[0], paused: false,
			pull: [0, 0, 0, 0], bones: makeBones ? makeBones(simTime, dt) : null, showBones: false,
			fxEvents: entities.fx.buffer(),
			view, proj, viewport: [640, 640], focal: [focalY, focalY],
		});
		const shot = shots.find((s) => s.frame === fr);
		if (shot) {
			// 같은 태스크에서 즉시 사본 — 이후 present 가 일어나도 이 버퍼는 그 프레임을 담고 있다
			const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
			const enc = device.createCommandEncoder();
			enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]);
			device.queue.submit([enc.finish()]);
			grabs.push({ name: shot.name, save: !!shot.save, rb });
		}
		if (fr % 20 === 19 && fr !== FRAMES - 1) await device.queue.onSubmittedWorkDone();
	}
	const bgra = format.startsWith('bgra');
	const out = [];
	for (const g of grabs) {
		await g.rb.mapAsync(GPUMapMode.READ);
		const px = new Uint8Array(g.rb.getMappedRange());
		// 지표: 배경 위로 뜬 픽셀 수 · 무게중심 · 퍼짐(rms 반경, px)
		let n = 0, sx = 0, sy = 0, hot = 0;
		const xs = [], ys = [];
		for (let i = 0; i < 640 * 640; i++) {
			const s = px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2];
			if (s > 40) { const x = i % 640, y = (i / 640) | 0; n++; sx += x; sy += y; xs.push(x); ys.push(y); }
			if (s > 620) hot++; // 거의 흰 픽셀 — 살(톤맵된 피부)은 거의 못 만든다 = 이펙트의 서명
		}
		const mx = n ? sx / n : 320, my = n ? sy / n : 320;
		let v = 0;
		for (let k = 0; k < xs.length; k++) v += (xs[k] - mx) * (xs[k] - mx) + (ys[k] - my) * (ys[k] - my);
		const spread = n ? Math.sqrt(v / n) : 0;
		let dataUrl = null;
		if (g.save) {
			const c2d = document.getElementById('c2d').getContext('2d');
			const img = c2d.createImageData(640, 640);
			for (let i = 0; i < 640 * 640; i++) {
				img.data[i * 4 + 0] = px[i * 4 + (bgra ? 2 : 0)];
				img.data[i * 4 + 1] = px[i * 4 + 1];
				img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)];
				img.data[i * 4 + 3] = 255;
			}
			c2d.putImageData(img, 0, 0);
			dataUrl = document.getElementById('c2d').toDataURL('image/png');
		}
		out.push({ name: g.name, lit: n, hot, cx: mx, cy: my, spread, dataUrl });
		g.rb.unmap();
	}
	return { shots: out, gpuErrs };
}
`;

(async () => {
	const server = await serve(8153, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8153/harness.html');

	const result = await page.evaluate(async ({ N, DRIVE }) => {
		eval(DRIVE);
		// 이펙트만 있는 장면: 기반 개체는 투명(opacity 0) 더미 — 지표가 이펙트 픽셀만 세도록
		const inert = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['물']);
		inert.opacity = 0; inert.binding = 0; inert.form = 0;
		const fx = new HktGenesisFx.FxSystem({ names: ['타격', '파이어볼 폭발'], slices: 4, slots: 1 });
		const ents = fx.compose(inert);
		// 정면 카메라: 월드 +x 가 화면 오른쪽 → 타격 축(+x)의 치우침이 cx 로 읽힌다
		const eye = [0, 1.0, 3.2], center = [0, 1.0, 0];
		const O = [0, 1.0, 0];
		return await driveFx({
			FRAMES: 175, N, entities: { ents, fx }, eye, center,
			events: [
				{ frame: 20, name: '타격', at: { origin: O, dir: [1, 0, 0] } },              // 축 = 화면 오른쪽
				{ frame: 60, name: '파이어볼 폭발', at: { origin: O, dir: [0, 1, 0] } },
			],
			shots: [
				{ name: 'before', frame: 19 },                    // 사전 — 아무 이벤트도 없다
				{ name: 'impact', frame: 26, save: true },        // 타격 발생 +0.1s
				{ name: 'impactGone', frame: 55 },                // 타격 수명(0.34s=20f) 한참 뒤
				{ name: 'blast', frame: 78, save: true },         // 폭발 발생 +0.3s
				{ name: 'blastGone', frame: 174 },                // 폭발 수명(1.5s=90f) 뒤
			],
		});
	}, { N: parseInt(nArg), DRIVE: DRIVE_FX });

	// ── 2장: 합성 장면 — 앱과 같은 구성(히키토 + 이펙트 3종, 슬라이스 8)에서
	//        살이 그대로 살아 있고 그 위에 이펙트가 얹히는가 (F1 이 L6 를 깨뜨리지 않는가).
	const comp = await page.evaluate(async ({ N, DRIVE }) => {
		eval(DRIVE);
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		const skeleton = new HktGenesisSkeleton.Skeleton();
		genes.bindBones = skeleton.pose('idle', 0, 1, 1);
		const fx = new HktGenesisFx.FxSystem(); // 기본 = 앱과 동일 (FX_PRESETS 전부, 슬라이스 8)
		const ents = fx.compose(genes);
		// 함정: 살은 구름에서 응축하며 *수축*한다 — 프레임 40 쯤엔 아직 부풀어 있어 픽셀이 더 많다.
		// 기준선은 응축이 끝난 뒤(≈1.8s)에 잡아야 "이펙트가 픽셀을 더했는가"가 성립한다.
		return await driveFx({
			FRAMES: 190, N, entities: { ents, fx }, eye: [0.9, 1.35, 3.1], center: [0, 0.9, 0],
			// 포즈는 고정(walk 한 시점) — 걷기로 실루엣이 변하면 "이펙트가 얹혔는가" 지표가
			// 포즈 면적 변화에 묻힌다. 살의 지연 추종은 이미 life-shot.js 가 검증한다.
			makeBones: () => skeleton.pose('walk', 0.42, 1.0, 1.0),
			events: [
				{ frame: 111, name: '타격', at: { origin: [0, 1.15, 0], dir: [0.3, 0.1, 1] } },
				{ frame: 140, name: '파이어볼 폭발', at: { origin: [0.75, 1.0, 0], dir: [0, 1, 0] } },
			],
			shots: [
				{ name: 'char', frame: 110, save: true },     // 이펙트 없는 캐릭터 (응축 후 기준선)
				{ name: 'charHit', frame: 117, save: true },  // 타격 얹힘 (+0.1s)
				{ name: 'charBlast', frame: 158, save: true },// 폭발 얹힘 (+0.3s)
			],
		});
	}, { N: parseInt(nArg) * 4, DRIVE: DRIVE_FX });
	for (const s of comp.shots) {
		if (s.dataUrl) savePng(s.dataUrl, path.resolve(`${outPrefix}-${s.name}.png`));
		console.log(`${s.name.padEnd(11)} 픽셀 ${String(s.lit).padStart(6)} · 고휘도 ${String(s.hot).padStart(6)} · 무게중심 (${s.cx.toFixed(0)}, ${s.cy.toFixed(0)}) · 퍼짐 ${s.spread.toFixed(1)}px`);
	}
	const C = {};
	for (const s of comp.shots) C[s.name] = s;
	result.gpuErrs = result.gpuErrs.concat(comp.gpuErrs);

	if (result.gpuErrs.length) { console.error('GPU 오류:', result.gpuErrs); await browser.close(); server.close(); process.exit(1); }
	const S = {};
	for (const s of result.shots) {
		S[s.name] = s;
		if (s.dataUrl) savePng(s.dataUrl, path.resolve(`${outPrefix}-${s.name}.png`));
		console.log(`${s.name.padEnd(11)} 픽셀 ${String(s.lit).padStart(6)} · 고휘도 ${String(s.hot).padStart(6)} · 무게중심 (${s.cx.toFixed(0)}, ${s.cy.toFixed(0)}) · 퍼짐 ${s.spread.toFixed(1)}px`);
	}
	const real = errors.filter((e) => !e.includes('404'));
	// ① 켜진다 ② 꺼진다 ③ 다르다(지향성·퍼짐) ④ 오류 0
	const gates = [
		['사전 정적(이벤트 전 0)', S.before.lit < 50],
		['타격 발생(픽셀>1500)', S.impact.lit > 1500],
		['타격 소멸(수명 후 0)', S.impactGone.lit < 50],
		['폭발 발생(픽셀>3000)', S.blast.lit > 3000],
		['폭발 소멸(수명 후 0)', S.blastGone.lit < 50],
		['타격 지향성(무게중심 +x 치우침)', S.impact.cx > 350],
		['폭발 등방(무게중심 원점 근방)', Math.abs(S.blast.cx - 320) < 60],
		['폭발이 더 크게 퍼짐', S.blast.spread > S.impact.spread * 1.3],
		['합성: 살이 살아 있다(캐릭터 픽셀>3000)', C.char.lit > 3000],
		['합성: 타격이 얹힌다(고휘도 +300)', C.charHit.hot > C.char.hot + 300],
		['합성: 타격이 픽셀을 더한다', C.charHit.lit > C.char.lit],
		['합성: 폭발이 얹힌다(픽셀 +3000)', C.charBlast.lit > C.char.lit + 3000],
		['페이지 오류 0', real.length === 0],
	];
	for (const [label, ok] of gates) console.log(`판정: ${label} → ${ok ? 'OK' : '실패'}`);
	if (real.length) console.log('오류:', real);
	const ok = gates.every(([, v]) => v);
	console.log(`판정: 종합 → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
