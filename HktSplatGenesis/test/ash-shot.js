// S5 낙재(흔적 데칼) 검증 — 불×나무 장면(엔진 직접 구동)에서 나무가 타면
// 일부 재가 가지에서 분리(life<0)되어 바닥에 내려앉아 남는지 스플랫 readback 으로 판정.
// 규칙만으로 생기는 흔적: 그을음 색·크기는 기존 fuel 채널 렌더 유도 그대로다.
//
// 사용: node ash-shot.js out.png [frames=600] [n=4096]
const path = require('path');
const { serve, launch, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

(async () => {
	const out = process.argv[2] || 'ash.png';
	const FRAMES = parseInt(process.argv[3] || '600');
	const N = parseInt(process.argv[4] || '4096');
	const server = await serve(8139, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	await page.goto('http://localhost:8139/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		// app.js 불×나무 장면과 같은 배치 — 나무 곁의 작은 모닥불
		const tree = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['나무'], [0, 0.6, 0]);
		const fire = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['불의 정령'], [0.9, 0.35, 0]);
		fire.emitRadius = 0.22; fire.lifeBase = 1.0; fire.updraft = 1.5; fire.size = 0.03;
		const r = await driveAndShoot({
			FRAMES, N, genes: tree, entities: [tree, fire], keepState: true,
			eye: [1.2, 1.6, 3.4], center: [0, 0.9, 0],
		});
		if (!r.dataUrl) return { err: r.gpuErrs };
		// 나무 슬라이스(전반부)에서: 분리(life<0) + 바닥 근접 + 정지 + 재(fuel≈0) = 낙재
		const sp = r.splatState;
		const half = N / 2;
		let detached = 0, grounded = 0, burnt = 0;
		for (let i = 0; i < half; i++) {
			const o = i * 12;
			const life = sp[o + 7], fuel = sp[o + 11];
			if (fuel < 0.05) burnt++;
			if (life < 0.0) {
				detached++;
				const speed = Math.hypot(sp[o + 4], sp[o + 5], sp[o + 6]);
				if (sp[o + 1] < 0.15 && speed < 0.05) grounded++;
			}
		}
		return { dataUrl: r.dataUrl, burnt, detached, grounded };
	}, { FRAMES, N, DRIVE: DRIVE_AND_SHOOT });

	if (result.err) { console.error('GPU 오류:', result.err); process.exit(1); }
	savePng(result.dataUrl, path.resolve(out));
	console.log(`저장: ${out} · 연소 ${result.burnt} · 분리 ${result.detached} · 바닥 정착 ${result.grounded}`);
	// 판정: 나무가 실제로 탔고(연소 다수), 그중 일부가 분리되어 바닥에 정착해 흔적이 남았다
	const ok = result.burnt > 100 && result.detached > 30 && result.grounded > 20;
	if (!ok) console.error('판정 실패:', JSON.stringify(result, (k, v) => (k === 'dataUrl' ? undefined : v)));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
