// HktSplatLife R 트랙 검증 — 별지기 게놈(이미지 정합 1호)이 조명·형상·채색을 갖추는가.
//  1) idle 촬영: 음영 지표(신체 픽셀 휘도 표준편차 — 찰흙이면 평평) + 부위색 존재
//     (보라 머리카락 / 흰 상의 / 피부) 판정 — 레퍼런스 이미지의 색 인상 재현 게이트.
//  2) walk 반 주기 차이 두 샷: 실루엣 diff > 임계 — 게놈 위에서도 애니메이션이 살아있는가.
// 사용: node fit-shot.js [out.png] [frames=240] [N=16384]
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [out = 'fit.png', framesArg = '240', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8152, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8152/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE); // driveAndShoot 주입 (_common.js)
		const G = HktGenesisGenome;
		const genome = G.GENOMES['별지기'];
		// 촬영 한 번 = 새 엔진·새 스켈레톤 (부속 체인 상태가 클립 간에 새지 않게)
		const shoot = async (clip, frames) => {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			genes.genome = genome;
			G.applyMatter(genes, genome);
			const skeleton = new HktGenesisSkeleton.Skeleton();
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome);
			return await driveAndShoot({
				FRAMES: frames, N, genes,
				makeBones: (t) => skeleton.pose(clip, t, 1.0, 1.0, genome),
				eye: [1.05, 1.0, 3.15], center: [0, 0.85, 0], // 3/4 뷰 — 포니테일·다리 스윙이 보이는 각
				showBones: false, // 정합 판정은 순수 살 픽셀로 (오버레이 흰 점이 상의 지표를 오염)
			});
		};
		const r1 = await shoot('idle', FRAMES);
		if (!r1.dataUrl) return { gpuErrs: r1.gpuErrs };
		// walk 위상 반대 두 샷 (ph = t·4 → 반 주기 π/4 s ≈ 47프레임)
		const rA = await shoot('walk', 150);
		const rB = await shoot('walk', 197);
		if (!rA.dataUrl || !rB.dataUrl) return { gpuErrs: rA.gpuErrs.concat(rB.gpuErrs) };

		const pixels = (durl) => new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = 640; c.height = 640;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0);
				resolve(g.getImageData(0, 0, 640, 640).data);
			};
			img.src = durl;
		});

		// idle 샷: 신체(배경 위) 픽셀의 휘도 통계 + 레퍼런스 부위색 분류
		const px = await pixels(r1.dataUrl);
		let body = 0, lumSum = 0, lum2 = 0, purple = 0, white = 0, skin = 0;
		for (let i = 0; i < 640 * 640; i++) {
			const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
			if (r + g + b <= 40) continue;
			body++;
			const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			lumSum += lum; lum2 += lum * lum;
			if (b > 60 && b > r && r > g * 1.15) purple++;                                  // 보라 머리
			else if (r > 150 && g > 145 && b > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 40) white++; // 흰 상의
			else if (r > 175 && g > r * 0.68 && g < r * 0.95 && b > r * 0.4 && b < r * 0.88) skin++; // 피부(따뜻한 밝음)
		}
		const mean = lumSum / Math.max(body, 1);
		const std = Math.sqrt(Math.max(lum2 / Math.max(body, 1) - mean * mean, 0));

		// walk 두 위상: 실루엣 XOR — 뼈가 움직이면 살이 따라와 실루엣이 달라야 한다
		const pa = await pixels(rA.dataUrl), pb = await pixels(rB.dataUrl);
		let diff = 0;
		for (let i = 0; i < 640 * 640; i++) {
			const sa = pa[i * 4] + pa[i * 4 + 1] + pa[i * 4 + 2] > 40;
			const sb = pb[i * 4] + pb[i * 4 + 1] + pb[i * 4 + 2] > 40;
			if (sa !== sb) diff++;
		}
		return {
			dataUrl: r1.dataUrl, gpuErrs: r1.gpuErrs, body, std: Math.round(std * 10) / 10,
			purple: purple / body, white: white / body, skin: skin / body, animDiff: diff,
		};
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	if (!result.dataUrl) { console.error('GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(out));
	const real = errors.filter((e) => !e.includes('404'));
	const pct = (v) => (v * 100).toFixed(1) + '%';
	const gates = [
		['신체 픽셀 > 5000', result.body > 5000, result.body],
		['음영 σ > 14 (찰흙 아님)', result.std > 14, result.std],
		['보라 머리 > 5%', result.purple > 0.05, pct(result.purple)],
		['흰 상의 > 5%', result.white > 0.05, pct(result.white)],
		['피부 > 8%', result.skin > 0.08, pct(result.skin)],
		['walk 위상 실루엣 diff > 1500', result.animDiff > 1500, result.animDiff],
		['페이지 오류 0', real.length === 0, real.length ? real : '없음'],
	];
	console.log(`저장: ${out}`);
	for (const [name, ok, val] of gates) console.log(`  ${ok ? '✓' : '✗'} ${name} — ${val}`);
	const ok = gates.every((g) => g[1]);
	console.log(`판정: ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
