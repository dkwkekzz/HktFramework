// FBX 드롭 경로 촬영 — 실제 Mixamo FBX 클립 위에 살이 자라는지 눈 검증
// 준비: 이 폴더에 Mixamo FBX 를 samba.fbx 로 두거나 첫 인자로 경로 지정.
//   샘플: curl -sSL -o samba.fbx \
//     "https://raw.githubusercontent.com/mrdoob/three.js/r147/examples/models/fbx/Samba%20Dancing.fbx"
// 사용: node fbx-shot.js [FBX경로] [출력.png] [프레임수] [스플랫수(2^n)]
const fs = require('fs');
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [fbxArg = path.join(__dirname, 'samba.fbx'), out = 'fbx.png', framesArg = '300', nArg = '16384'] = process.argv.slice(2);
if (!fs.existsSync(fbxArg)) {
	console.error('FBX 없음:', fbxArg, '\n상단 주석의 curl 로 샘플을 받거나 Mixamo FBX 경로를 지정하세요.');
	process.exit(1);
}

(async () => {
	const server = await serve(8132, {
		'/harness.html': HARNESS_ROUTE,
		'/test.fbx': (req, res) => {
			res.writeHead(200, { 'content-type': 'application/octet-stream' });
			res.end(fs.readFileSync(fbxArg));
		},
	});
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8132/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const buf = await (await fetch('/test.fbx')).arrayBuffer();
		const ext = HktGenesisSkeleton.parseFBX(buf);
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		genes.bindBones = ext.pose(0, 1, 1);
		const r = await driveAndShoot({
			FRAMES, N, genes,
			makeBones: (simTime, dt) => ext.pose(dt, 1.0, 1.0),
		});
		r.info = { bones: ext.bones.length, segs: genes.bindBones.length, clip: ext.clipName };
		return r;
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	console.log('리그 정보:', JSON.stringify(result.info));
	if (!result.dataUrl) { console.error('GPU 오류:', result.gpuErrs); process.exit(1); }
	savePng(result.dataUrl, path.resolve(out));
	console.log('저장:', out, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');
	await browser.close();
	server.close();
})().catch((e) => { console.error(e); process.exit(1); });
