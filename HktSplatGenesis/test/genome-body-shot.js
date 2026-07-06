// C2 수동 게놈(비율 실증) 촬영 — "덩치" vs "호리호리" 가 같은 표준 클립을 무수정 재생하는가.
// 사용: node genome-body-shot.js [stocky.png] [slim.png] [프레임수] [스플랫수(2^n)]
//
// 판정:
//  · 애니메이션 보존 + 힙 보정 (CPU, 결정론) — 항등/덩치/호리호리 모두 walk·idle·wave 에서
//    발 최저 y 가 지면 근방(≈0)에 머문다. 다리 길이 배율(0.72 vs 1.32)이 크게 달라도 힙 보정이
//    발을 지면에 붙여, 같은 클립이 두 체형에서 뚫림/공중부양 없이 재생된다.
//  · 비율 대비 (GPU 사진) — 같은 walk 클립인데 덩치는 낮고 넓게, 호리호리는 높고 가늘게 선다.
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [stockyOut = 'genome-stocky.png', slimOut = 'genome-slim.png', framesArg = '240', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8138, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8138/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const G = HktGenesisGenome;
		const skeleton = new HktGenesisSkeleton.Skeleton();
		const CLIPS = ['walk', 'idle', 'wave'];
		const BODIES = { '항등': G.IDENTITY, '덩치': G.GENOMES['덩치'], '호리호리': G.GENOMES['호리호리'] };

		// ── CPU: 각 체형 × 클립에서 시간에 걸친 발 최저 y + 서 있는 키 ──
		const foot = {};
		for (const [name, genome] of Object.entries(BODIES)) {
			foot[name] = {};
			for (const clip of CLIPS) {
				let minY = Infinity, maxY = -Infinity;
				for (let k = 0; k < 60; k++) {
					const t = k * (2.0 / 60); // ~2s, 한 걸음 주기 이상
					const segs = skeleton.pose(clip, t, 1, 1, genome);
					for (const s of segs) {
						minY = Math.min(minY, s.a[1], s.b[1]);
						maxY = Math.max(maxY, s.a[1], s.b[1]);
					}
				}
				foot[name][clip] = { minY, height: maxY - minY };
			}
		}

		// ── GPU: 덩치/호리호리 walk 사진 + 스플랫 y 범위(체형 비율) ──
		function yRange(state, n) {
			const ys = [];
			for (let i = 0; i < n; i++) ys.push(state[i * 12 + 1]);
			ys.sort((a, b) => a - b);
			const p = (q) => ys[Math.max(0, Math.min(ys.length - 1, Math.floor(q * ys.length)))];
			return { lo: p(0.02), hi: p(0.98) }; // 2~98퍼센타일로 아웃라이어 제거
		}
		async function shoot(genome) {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome);
			const r = await driveAndShoot({
				FRAMES, N, genes, keepState: true,
				makeBones: (simTime) => skeleton.pose('walk', simTime, 1.0, 1.0, genome),
			});
			const y = r.gpuErrs.length ? { lo: 0, hi: 0 } : yRange(r.splatState, N);
			return { dataUrl: r.dataUrl, gpuErrs: r.gpuErrs, lo: y.lo, hi: y.hi };
		}
		const stocky = await shoot(G.GENOMES['덩치']);
		const slim = await shoot(G.GENOMES['호리호리']);
		return { foot, stocky, slim };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	const { foot, stocky, slim } = result;
	if (!stocky.dataUrl || !slim.dataUrl) { console.error('GPU 오류:', stocky.gpuErrs, slim.gpuErrs); process.exit(1); }

	savePng(stocky.dataUrl, path.resolve(stockyOut));
	savePng(slim.dataUrl, path.resolve(slimOut));

	// ① 발 지면 접지: 모든 체형·클립에서 발 최저 y ∈ [-0.22, 0.18] (힙 보정 → 무수정 재생)
	let plantOk = true;
	console.log('발 최저 y (지면 접지 — 힙 보정):');
	for (const name of Object.keys(foot)) {
		const row = Object.entries(foot[name]).map(([c, v]) => `${c} ${v.minY.toFixed(3)}`).join(' · ');
		const ok = Object.values(foot[name]).every((v) => v.minY >= -0.22 && v.minY <= 0.18);
		plantOk = plantOk && ok;
		console.log(`  ${name}: ${row} ${ok ? '✅' : '❌'}`);
	}
	// ② 비율 대비: 호리호리가 덩치보다 확연히 크다 (CPU 키 + GPU 스플랫 상단 y)
	const cpuTall = foot['호리호리'].walk.height > foot['덩치'].walk.height * 1.15;
	const gpuTall = slim.hi > stocky.hi + 0.15;
	console.log(`서 있는 키(walk): 덩치 ${foot['덩치'].walk.height.toFixed(2)} · 호리호리 ${foot['호리호리'].walk.height.toFixed(2)} — CPU ${cpuTall ? '✅' : '❌'}`);
	console.log(`스플랫 상단 y(walk): 덩치 ${stocky.hi.toFixed(2)} · 호리호리 ${slim.hi.toFixed(2)} — GPU ${gpuTall ? '✅' : '❌'}`);
	console.log('저장:', stockyOut, slimOut, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(plantOk && cpuTall && gpuTall ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
