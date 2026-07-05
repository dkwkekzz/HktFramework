// S5 시뮬 버블 검증 — 기존 격자([−4.8,4.8]) 밖 [7,*,7] 에 슬라임을 심고,
// gridCenter 를 그리로 옮긴 경우(버블)와 기본(구 고정 격자)을 비교한다.
// L2 는 격자 안에서만 산다. 살아 있다는 구조적 시그니처 = 휴지 간격(반발이 만드는
// 최근접 이웃 거리 하한) — 꺼지면 L1 구심이 스플랫을 겹치도록 붕괴시켜 간격이 무너진다.
//
// 사용: node bubble-shot.js bubble.png fixed.png [frames=90] [n=8192]
const path = require('path');
const { serve, launch, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

(async () => {
	const outA = process.argv[2] || 'bubble.png';
	const outB = process.argv[3] || 'bubble-off.png';
	const FRAMES = parseInt(process.argv[4] || '90');
	const N = parseInt(process.argv[5] || '8192');
	const server = await serve(8138, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	await page.goto('http://localhost:8138/harness.html');

	const run = (gridCenter) => page.evaluate(async ({ FRAMES, N, DRIVE, gridCenter }) => {
		eval(DRIVE);
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['슬라임'], [7, 1.0, 7]);
		const r = await driveAndShoot({
			FRAMES, N, genes, gridCenter, keepState: true,
			eye: [7.9, 2.4, 10.1], center: [7, 0.7, 7],
		});
		if (!r.dataUrl) return { err: r.gpuErrs };
		// 휴지 간격 지표: 샘플 스플랫의 최근접 이웃 거리 평균
		const sp = r.splatState;
		const S = 384, step = Math.floor(N / S);
		let nnSum = 0;
		for (let a = 0; a < S; a++) {
			const i = a * step, ox = sp[i * 12], oy = sp[i * 12 + 1], oz = sp[i * 12 + 2];
			let best = 1e9;
			for (let j = 0; j < N; j++) {
				if (j === i) continue;
				const dx = sp[j * 12] - ox, dy = sp[j * 12 + 1] - oy, dz = sp[j * 12 + 2] - oz;
				const d2 = dx * dx + dy * dy + dz * dz;
				if (d2 < best) best = d2;
			}
			nnSum += Math.sqrt(best);
		}
		return { dataUrl: r.dataUrl, nn: nnSum / S };
	}, { FRAMES, N, DRIVE: DRIVE_AND_SHOOT, gridCenter });

	const bubble = await run([7, 0.8, 7]); // 버블이 슬라임 위치를 따라온 상태
	if (bubble.err) { console.error('GPU 오류:', bubble.err); process.exit(1); }
	const fixed = await run(undefined);    // 기본 중심 [0,0.8,0] — 슬라임은 격자 밖
	if (fixed.err) { console.error('GPU 오류:', fixed.err); process.exit(1); }

	savePng(bubble.dataUrl, path.resolve(outA));
	savePng(fixed.dataUrl, path.resolve(outB));
	console.log(`저장: ${outA}/${outB} · 휴지 간격 버블 ${bubble.nn.toFixed(4)} vs 고정격자 ${fixed.nn.toFixed(4)}`);
	// 판정: 버블에선 L2 반발이 살아 간격이 유지된다 (격자 밖에선 binding 이 조용히 꺼져 겹침 붕괴)
	const ok = bubble.nn > 1.5 * fixed.nn;
	if (!ok) console.error('판정 실패:', JSON.stringify({ bubble: bubble.nn, fixed: fixed.nn }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
