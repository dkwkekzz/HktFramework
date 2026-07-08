// HktSplatLife 자립 검증 — 캐릭터(동적) 렌더 스택이 무대 없이 단독 작동하는가.
// 히키토(built-in walk 클립)를 엔진 직접 구동으로 배양·촬영하고, 생명 픽셀이 유의미하게
// 그려지는지(살이 뼈대를 덮음) 판정한다. GPU 오류 0 + 픽셀 임계 통과 → OK.
// 사용: node life-shot.js [out.png] [clip=walk] [frames=180] [N=16384]
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [out = 'life.png', clip = 'walk', framesArg = '180', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8151, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8151/harness.html');

	const result = await page.evaluate(async ({ clip, FRAMES, N, DRIVE }) => {
		eval(DRIVE); // driveAndShoot 주입 (_common.js)
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		const skeleton = new HktGenesisSkeleton.Skeleton();
		genes.bindBones = skeleton.pose('idle', 0, 1, 1);
		const r = await driveAndShoot({
			FRAMES, N, genes,
			makeBones: (simTime) => skeleton.pose(clip, simTime, 1.0, 1.0),
		});
		// 페이지 안에서 생명 픽셀 집계 (배경=어두운 클리어 제외)
		if (!r.dataUrl) return r;
		const lit = await new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = 640; c.height = 640;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0);
				const px = g.getImageData(0, 0, 640, 640).data;
				let n = 0;
				for (let i = 0; i < 640 * 640; i++) {
					const s = px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2];
					if (s > 40) n++; // 배경(≈0) 위로 뜬 픽셀
				}
				resolve(n);
			};
			img.src = r.dataUrl;
		});
		return { dataUrl: r.dataUrl, gpuErrs: r.gpuErrs, lit };
	}, { clip, FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	if (!result.dataUrl) { console.error('GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(out));
	const real = errors.filter((e) => !e.includes('404'));
	const ok = result.lit > 3000 && real.length === 0;
	console.log(`저장: ${out} · 생명 픽셀 ${result.lit} · 페이지 오류 ${real.length ? real : '없음'}`);
	console.log(`판정: 렌더 ${result.lit > 3000}(생명 픽셀 ${result.lit}>3000) · 오류0 ${real.length === 0} → ${ok ? 'OK' : '실패'}`);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
