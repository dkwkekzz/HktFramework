// C4 부속 리그(게놈 ④) 촬영 — 가상 뼈 스프링 체인(꼬리)이 클립 무수정으로 지연 추종하는가.
// 사용: node genome-append-shot.js [tail.png] [프레임수] [스플랫수(2^n)]
//
// 판정:
//  · 실뼈 회귀 0 — 꼬리 게놈 pose 의 실뼈 세그먼트가 부속 없는 pose 와 bit-exact 동일
//    (부속은 실뼈 *뒤에* append 만 하고 클립·FK 를 건드리지 않는다 = 클립 데이터 무수정).
//  · 지연 추종 — walk 중 꼬리 끝이 강체 목표(부착 관절 변환의 고정 연장)에서 벗어나고(lag),
//    체인이 직선이 아니라 굽는다(잔상 곡선). 이게 부속 생동감의 원천 — 클립 트랙이 아니라 물리.
//  · 사진 — 꼬리 부위(appendix 그룹)를 초록 램프로 채색해 몸(갈색)과 구분되는 스플랫 살이
//    꼬리 위치에 자랐는지 픽셀로 확인 (친화가 부속 세그먼트에도 배정됨의 증명).
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [outPng = 'genome-tail.png', framesArg = '200', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8141, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8141/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const TAIL = { morph: {}, appendix: JSON.parse(JSON.stringify(HktGenesisGenome.APPENDIX_PRESETS['꼬리'])),
			palette: { appendix: { a: '#1f9a3a', b: '#6fe07a' } } }; // 꼬리만 초록 — 픽셀 판정용
		const def = HktGenesisGenome.chains(TAIL)[0];

		// ── CPU 판정: 실뼈 bit-exact + 지연 추종 ──────────────────────────────
		const plainSk = new HktGenesisSkeleton.Skeleton();
		const tailSk = new HktGenesisSkeleton.Skeleton();
		const dt = 1 / 60;
		let realDiff = 0, realCount = 0;
		let lagMin = 1e9, lagMax = -1e9, bendMax = 0;
		for (let fr = 1; fr <= 300; fr++) {
			const t = fr * dt;
			const a = plainSk.pose('walk', t, 1, 1, { morph: TAIL.morph, palette: TAIL.palette }); // 부속만 뺀 동일 게놈
			const b = tailSk.pose('walk', t, 1, 1, TAIL);
			realCount = a.length;
			if (b.length !== a.length + def.links) return { err: `세그먼트 수 불일치: ${b.length} ≠ ${a.length}+${def.links}` };
			for (let i = 0; i < a.length; i++) {
				realDiff = Math.max(realDiff, Math.abs(a[i].ra - b[i].ra), Math.abs(a[i].rb - b[i].rb));
				for (const k of ['a', 'b'])
					for (let c = 0; c < 3; c++)
						realDiff = Math.max(realDiff, Math.abs(a[i][k][c] - b[i][k][c]));
			}
			// 꼬리 통계: 부착점→끝 벡터가 rest 방향(def.dir)에서 벗어난 각.
			// built-in walk 은 힙이 회전하지 않으므로 강체 목표 방향 = def.dir 그대로 —
			// 이 각의 *시간 변동(범위)* 이 곧 물리 지연 추종의 증거다 (정적 처짐은 상수라 배제).
			const segs = b.slice(a.length);
			const anchor = segs[0].a, tip = segs[segs.length - 1].b;
			const ax = tip[0] - anchor[0], ay = tip[1] - anchor[1], az = tip[2] - anchor[2];
			const al = Math.hypot(ax, ay, az);
			const dotv = (ax * def.dir[0] + ay * def.dir[1] + az * def.dir[2]) / (al || 1);
			const ang = Math.acos(Math.min(1, Math.max(-1, dotv)));
			if (fr > 60) { lagMin = Math.min(lagMin, ang); lagMax = Math.max(lagMax, ang); } // 초기 정착 제외
			bendMax = Math.max(bendMax, 1 - al / def.len); // 직선이면 0, 굽으면 >0 (길이 구속이라 안전)
		}

		// ── GPU 사진: 꼬리 살 성장 (친화가 부속 세그먼트에 배정) ────────────────
		const skeleton = new HktGenesisSkeleton.Skeleton();
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		genes.genome = TAIL;
		genes.bindBones = skeleton.pose('idle', 0, 1, 1, TAIL);
		const shot = await driveAndShoot({
			FRAMES, N, genes,
			makeBones: (simTime) => skeleton.pose('walk', simTime, 1.0, 1.0, TAIL),
			eye: [3.1, 1.25, 0.6], center: [0, 0.9, 0], // 측면 — 꼬리(-z 후방)가 옆으로 보인다
		});
		// 초록(꼬리) 픽셀: 색상 0.25~0.45 — 몸(갈색 h≈0.05)과 구분. 몸 밝은 픽셀과 중심 비교.
		const c2d = document.getElementById('c2d').getContext('2d');
		const img = c2d.getImageData(0, 0, 640, 640).data;
		let gn = 0, gx = 0, gy = 0, bn = 0, bx = 0, by = 0;
		for (let y = 0; y < 640; y++) for (let x = 0; x < 640; x++) {
			const i = (y * 640 + x) * 4, r = img[i], g = img[i + 1], b = img[i + 2];
			if (r + g + b < 70) continue;
			const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
			let h = -1;
			if (d > 12) {
				if (mx === r) h = (((g - b) / d) % 6) / 6; else if (mx === g) h = ((b - r) / d + 2) / 6; else h = ((r - g) / d + 4) / 6;
				if (h < 0) h += 1;
			}
			if (h >= 0.25 && h <= 0.45) { gn++; gx += x; gy += y; }
			else { bn++; bx += x; by += y; }
		}
		const centroidDx = (gn && bn) ? Math.hypot(gx / gn - bx / bn, gy / gn - by / bn) : 0;
		return {
			realDiff, realCount, lagRange: lagMax - lagMin, bendMax,
			greenPx: gn, centroidDx,
			dataUrl: shot.dataUrl, gpuErrs: shot.gpuErrs,
		};
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	if (result.err) { console.error(result.err); process.exit(1); }
	if (!result.dataUrl) { console.error('GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(outPng));

	const regOk = result.realDiff === 0;                    // 실뼈 bit-exact (클립·FK 무수정)
	const lagOk = result.lagRange > 0.02 && result.bendMax > 0.002; // 지연 추종: 이탈각 요동 + 굽힘
	const pxOk = result.greenPx > 150 && result.centroidDx > 30;  // 꼬리 살이 몸과 다른 위치에 자람
	console.log(`실뼈 회귀: 세그 ${result.realCount}개 최대 차이 ${result.realDiff} ${regOk ? '✅ (bit-exact)' : '❌'}`);
	console.log(`지연 추종: 이탈각 요동 ${result.lagRange.toFixed(4)}rad · 굽힘 최대 ${result.bendMax.toFixed(4)} ${lagOk ? '✅' : '❌'}`);
	console.log(`꼬리 살: 초록 픽셀 ${result.greenPx} · 몸 중심과 거리 ${result.centroidDx.toFixed(0)}px ${pxOk ? '✅' : '❌'}`);
	console.log('저장:', outPng, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(regOk && lagOk && pxOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
