// 히키토(built-in 클립) 촬영 — 살이 뼈대를 덮는지 눈 검증의 재현 하니스
// 사용: node render-shot.js <출력.png> [클립 walk|idle|wave] [프레임수] [스플랫수(2^n)]
// 예:   node render-shot.js walk.png walk 300 16384
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [out = 'render.png', clip = 'walk', framesArg = '300', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8131, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8131/harness.html');

	const result = await page.evaluate(async ({ clip, FRAMES, N, DRIVE }) => {
		eval(DRIVE); // driveAndShoot 주입 (_common.js DRIVE_AND_SHOOT)
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		const skeleton = new HktGenesisSkeleton.Skeleton();
		genes.bindBones = skeleton.pose('idle', 0, 1, 1);
		return driveAndShoot({
			FRAMES, N, genes,
			makeBones: (simTime) => skeleton.pose(clip, simTime, 1.0, 1.0),
		});
	}, { clip, FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	if (!result.dataUrl) { console.error('GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(out));
	console.log('저장:', out, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');
	await browser.close();
	server.close();
})().catch((e) => { console.error(e); process.exit(1); });
