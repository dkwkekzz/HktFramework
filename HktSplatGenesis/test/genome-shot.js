// C1 게놈(형태 ①) 촬영 — ① 항등 게놈 회귀 0 + ② 배율 게놈 실루엣 차이의 재현 하니스.
// 사용: node genome-shot.js [ident.png] [head.png] [프레임수] [스플랫수(2^n)]
//
// 판정:
//  · 회귀 0 (데이터 레벨, 결정론) — pose(게놈 없음) 과 pose(항등 게놈)의 세그먼트(ra/rb/a/b)가
//    모든 클립·프레임에서 bit-exact 동일. radiusScale(IDENTITY) ≡ 1 이라 기본 문법 그대로다.
//    (GPU 사진 대신 CPU 세그먼트로 판정 — swiftshader 는 device 인스턴스마다 미세 변동이 있어
//     사진 픽셀 동일성으로는 "회귀 0" 을 증명할 수 없다.)
//  · 실루엣 차이 (GPU 사진) — head 1.6× 게놈의 머리밴드 수평 확산 RMS 가 항등보다 유의하게 크다.
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [identOut = 'genome-ident.png', headOut = 'genome-head.png', framesArg = '240', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8137, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8137/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const G = HktGenesisGenome;
		const skeleton = new HktGenesisSkeleton.Skeleton();

		// ── ① 회귀 0: pose(undefined) ≡ pose(IDENTITY) 세그먼트 bit-exact ──
		let segMaxDiff = 0, segCount = 0;
		for (const clip of ['walk', 'idle', 'wave']) {
			for (const t of [0, 0.37, 1.02, 2.5]) {
				const a = skeleton.pose(clip, t, 1, 1, undefined);
				const b = skeleton.pose(clip, t, 1, 1, G.IDENTITY);
				for (let i = 0; i < a.length; i++) {
					segCount++;
					const d = Math.max(
						Math.abs(a[i].ra - b[i].ra), Math.abs(a[i].rb - b[i].rb),
						Math.abs(a[i].a[0] - b[i].a[0]), Math.abs(a[i].b[1] - b[i].b[1]),
					);
					if (d > segMaxDiff) segMaxDiff = d;
				}
			}
		}

		// 머리밴드(위쪽) 스플랫의 수평(XZ) 확산 RMS — 머리 반지름이 커지면 넓어진다.
		// Splat stride 12 floats, pos = [0,1,2] (48B = SPLAT_STRIDE).
		function headRms(state, n) {
			let sx = 0, sz = 0, m = 0;
			for (let i = 0; i < n; i++) { const y = state[i * 12 + 1]; if (y > 1.45) { sx += state[i * 12]; sz += state[i * 12 + 2]; m++; } }
			if (m < 20) return { rms: 0, count: m };
			const cx = sx / m, cz = sz / m; let s = 0;
			for (let i = 0; i < n; i++) { const y = state[i * 12 + 1]; if (y > 1.45) { const dx = state[i * 12] - cx, dz = state[i * 12 + 2] - cz; s += dx * dx + dz * dz; } }
			return { rms: Math.sqrt(s / m), count: m };
		}

		async function shoot(genome) {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome);
			const r = await driveAndShoot({
				FRAMES, N, genes, keepState: true,
				makeBones: (simTime) => skeleton.pose('walk', simTime, 1.0, 1.0, genome),
			});
			const h = r.gpuErrs.length ? { rms: 0, count: 0 } : headRms(r.splatState, N);
			return { dataUrl: r.dataUrl, gpuErrs: r.gpuErrs, rms: h.rms, count: h.count };
		}

		const ident = await shoot(G.IDENTITY);            // 항등 — 기준 실루엣
		const head = await shoot(G.create({ head: 1.6 })); // 머리 1.6× — 실루엣 차이 기대
		return { segMaxDiff, segCount, ident, head };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	const { segMaxDiff, segCount, ident, head } = result;
	if (!ident.dataUrl || !head.dataUrl) { console.error('GPU 오류:', ident.gpuErrs, head.gpuErrs); process.exit(1); }

	savePng(ident.dataUrl, path.resolve(identOut));
	savePng(head.dataUrl, path.resolve(headOut));

	const regressOk = segMaxDiff === 0;                       // ① bit-exact
	const ratio = ident.rms > 0 ? head.rms / ident.rms : 0;   // ② 실루엣 확산 비
	const silhouetteOk = ratio > 1.15;

	console.log(`회귀 0 (데이터)  세그먼트 ${segCount}개 최대 차이 ${segMaxDiff} — ${regressOk ? '항등 게놈 = 기본 문법 ✅' : '차이 발생 ❌'}`);
	console.log(`항등   머리밴드 RMS ${ident.rms.toFixed(4)} (스플랫 ${ident.count})`);
	console.log(`머리1.6 머리밴드 RMS ${head.rms.toFixed(4)} (스플랫 ${head.count}) — 항등比 ${ratio.toFixed(2)}× ${silhouetteOk ? '✅' : '❌'}`);
	console.log('저장:', identOut, headOut, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(regressOk && silhouetteOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
