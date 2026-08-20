// HktSplatLife 외부 FBX 검증 — Mixamo FBX 클립 위에 살(히키토)이 자라 뼈를 따라가는가.
// 동봉 샘플(assets/anim/samba.fbx)을 기본으로 파싱→FK 구동→촬영하고, 생명 픽셀 임계 +
// GPU 오류 0 으로 판정한다. three(r147) 는 FBX 파싱/FK 입력 전용 — 렌더/시뮬은 자체 WebGPU.
// 사용: node fbx-shot.js [FBX경로] [out.png] [frames=240] [N=16384]
//   기본 FBX 미존재 시 안내 후 종료.
const fs = require('fs');
const path = require('path');
const { serve, launch, collectErrors, savePng, SPLAT, DRIVE_AND_SHOOT } = require('./_common');

const [fbxArg = path.join(__dirname, '..', 'assets', 'anim', 'samba.fbx'), out = 'fbx.png', framesArg = '240', nArg = '16384'] = process.argv.slice(2);
if (!fs.existsSync(fbxArg)) {
	console.error('FBX 없음:', fbxArg, '\n동봉 assets/anim/samba.fbx 를 두거나 Mixamo FBX 경로를 지정하세요.');
	process.exit(1);
}

// 엔진 모듈 + vendor(three/FBXLoader) 를 모두 로드하는 하니스 페이지 (기본 HARNESS_ROUTE 는 vendor 미포함).
const FBX_HARNESS = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas><canvas id="c2d" width="640" height="640"></canvas>'
		+ '<script src="/vendor/three.min.js"><\/script><script src="/vendor/fflate.min.js"><\/script><script src="/vendor/FBXLoader.js"><\/script>'
		+ `<script src="${SPLAT}/math.js"><\/script><script src="${SPLAT}/genome.js"><\/script><script src="${SPLAT}/skeleton.js"><\/script><script src="${SPLAT}/anim.js"><\/script><script src="${SPLAT}/presets.js"><\/script>`
		+ `<script src="${SPLAT}/wgsl.js"><\/script><script src="${SPLAT}/engine.js"><\/script>`);
};

(async () => {
	const server = await serve(8152, {
		'/harness.html': FBX_HARNESS,
		'/test.fbx': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(fs.readFileSync(fbxArg)); },
	});
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8152/harness.html');

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
		r.info = { bones: ext.bones.length, segs: genes.bindBones.length, clip: ext.clipName, clips: ext.clipNames() };
		if (!r.dataUrl) return r;
		// 생명 픽셀 집계 (배경=어두운 클리어 제외)
		r.lit = await new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = 640; c.height = 640;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0);
				const px = g.getImageData(0, 0, 640, 640).data;
				let n = 0;
				for (let i = 0; i < 640 * 640; i++) if (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] > 40) n++;
				resolve(n);
			};
			img.src = r.dataUrl;
		});
		return r;
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	console.log('리그 정보:', JSON.stringify(result.info));
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
