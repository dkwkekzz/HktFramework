// C5 이미지 → 게놈 추출 파이프라인 촬영 — 컨셉 이미지에서 뽑은 게놈이 캐릭터로 성립하는가.
// 사용: node genome-extract-shot.js [출력디렉토리] [프레임수] [스플랫수(2^n)]
//
// 흐름: ① 합성 컨셉 이미지 2장(정면·측면) 생성 → ② tools/genome-extract 로 추출
//       (ANTHROPIC_API_KEY 있으면 실호출, 없으면 mock 고정본 — 검증·저장 경로 동일)
//       → ③ 프로파일 검증 통과 확인(+반려 경로 확인) → ④ 게놈을 배양해 walk/idle/wave 사진.
// 판정:
//  · 추출 exit 0 + 게놈 JSON 존재 (프로파일 통과) · 울타리 밖 게놈은 반려(exit 2)
//  · 부속 세그먼트: pose 세그 수 = 실뼈 + 체인 마디 수 (클립 무수정 append)
//  · 3클립 전부 살 픽셀 렌더 + walk 사진의 유채색 픽셀 다수가 게놈 팔레트 색상(초록 밴드)
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { serve, launch, collectErrors, savePng, ROOT, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [outDir = '.', framesArg = '160', nArg = '8192'] = process.argv.slice(2);
const out = (f) => path.resolve(outDir, f);

(async () => {
	const server = await serve(8142, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();

	// ── ① 합성 컨셉 이미지: 초록 양서류형(큰 머리·짧은 다리·긴 꼬리) 정면+측면 ──
	// 컨셉 아트는 외부 입력의 대역이라 절대 원칙 1 과 무관 (생명 렌더가 아니다).
	const cpage = await browser.newPage();
	await cpage.goto('http://localhost:8142/harness.html');
	const concepts = await cpage.evaluate(() => {
		const c = document.getElementById('c2d'), x = c.getContext('2d');
		const blob = (cx, cy, rx, ry, fill) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
		const shots = [];
		for (const view of ['front', 'side']) {
			x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, 640, 640); // 단색 배경 (입력 규약)
			const G1 = '#357a49', G2 = '#9fe6a8';
			if (view === 'front') {
				blob(320, 350, 96, 110, G1);            // 둥근 몸통
				blob(320, 385, 62, 66, G2);             // 밝은 배
				blob(320, 185, 92, 86, G1);             // 큰 머리
				blob(285, 175, 16, 20, '#1c1c1c'); blob(355, 175, 16, 20, '#1c1c1c'); // 눈
				blob(215, 330, 26, 62, G1); blob(425, 330, 26, 62, G1); // 짧은 팔
				blob(275, 505, 32, 52, G1); blob(365, 505, 32, 52, G1); // 짧고 굵은 다리
			} else {
				blob(300, 350, 88, 108, G1);
				blob(325, 390, 52, 60, G2);
				blob(310, 185, 88, 84, G1);
				blob(365, 175, 15, 19, '#1c1c1c');
				blob(300, 505, 34, 52, G1);
				// 긴 꼬리 — 힙에서 뒤로 처지는 테이퍼 곡선
				x.fillStyle = G1; x.beginPath();
				x.moveTo(250, 330);
				x.quadraticCurveTo(120, 380, 60, 520);
				x.quadraticCurveTo(130, 430, 255, 415);
				x.closePath(); x.fill();
			}
			shots.push(c.toDataURL('image/png'));
		}
		return shots;
	});
	savePng(concepts[0], out('concept-front.png'));
	savePng(concepts[1], out('concept-side.png'));
	await cpage.close();

	// ── ② 추출 (실호출 또는 mock) + ③ 검증·반려 경로 ─────────────────────────
	const genomePath = out('extracted.genome.json');
	const extractArgs = [
		path.join(ROOT, 'tools/genome-extract/extract.js'),
		out('concept-front.png'), out('concept-side.png'),
		'--out', genomePath,
	];
	const live = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
	if (!live) extractArgs.push('--mock', path.join(ROOT, 'tools/genome-extract/fixtures/mock-newt.json'));
	const ex = spawnSync(process.execPath, extractArgs, { encoding: 'utf8' });
	process.stdout.write(ex.stdout || '');
	if (ex.status !== 0) { console.error(`추출 실패 (exit ${ex.status}):\n${ex.stderr}`); process.exit(1); }
	const genome = JSON.parse(fs.readFileSync(genomePath, 'utf8'));

	// 반려 경로: 울타리 밖 게놈은 저장되지 않고 exit 2
	const badPath = out('bad.genome.json');
	fs.writeFileSync(badPath, JSON.stringify({ name: 'bad', morph: { head: { r: 9 } }, palette: {} }));
	const rejected = spawnSync(process.execPath, [
		path.join(ROOT, 'tools/genome-extract/extract.js'), out('concept-front.png'),
		'--mock', badPath, '--out', out('never.genome.json'),
	], { encoding: 'utf8' }).status === 2 && !fs.existsSync(out('never.genome.json'));

	// ── ④ 게놈 배양: 3클립 사진 + 부속 세그 수(CPU) + 팔레트 색상 판정 ─────────
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8142/harness.html');
	const result = await page.evaluate(async ({ FRAMES, N, DRIVE, GENOME }) => {
		eval(DRIVE);
		const skeleton = new HktGenesisSkeleton.Skeleton();
		// 부속 세그 검증: 실뼈 수 + 체인 마디 합 (클립 무수정 append)
		const plain = new HktGenesisSkeleton.Skeleton().pose('walk', 0.5, 1, 1, null).length;
		const chains = HktGenesisGenome.chains(GENOME);
		const expectSegs = plain + chains.reduce((s, c) => s + c.links, 0);
		const gotSegs = new HktGenesisSkeleton.Skeleton().pose('walk', 0.5, 1, 1, GENOME).length;

		const shots = {};
		for (const clip of ['walk', 'idle', 'wave']) {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			HktGenesisGenome.applyMatter(genes, GENOME); // ③ 재질 차분
			genes.genome = GENOME;                       // ①②④ 형태·채색·부속
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, GENOME);
			const r = await driveAndShoot({
				FRAMES, N, genes,
				makeBones: (t) => skeleton.pose(clip, t, 1.0, 1.0, GENOME),
				eye: [2.3, 1.35, 2.3], center: [0, 0.9, 0], // 3/4 시점 — 꼬리(-z 후방) 노출
			});
			if (r.gpuErrs.length) return { err: 'GPU: ' + r.gpuErrs.join(';') };
			// 밝은 픽셀 수 + 유채색 픽셀의 게놈 팔레트(초록 밴드) 비율
			const img = document.getElementById('c2d').getContext('2d').getImageData(0, 0, 640, 640).data;
			let lit = 0, hueN = 0, hueHit = 0;
			for (let i = 0; i < img.length; i += 4) {
				const r8 = img[i], g8 = img[i + 1], b8 = img[i + 2];
				if (r8 + g8 + b8 < 70) continue;
				lit++;
				const mx = Math.max(r8, g8, b8), mn = Math.min(r8, g8, b8), d = mx - mn;
				if (d < 14) continue;
				let h;
				if (mx === r8) h = (((g8 - b8) / d) % 6) / 6; else if (mx === g8) h = ((b8 - r8) / d + 2) / 6; else h = ((r8 - g8) / d + 4) / 6;
				if (h < 0) h += 1;
				hueN++;
				if (h > 0.2 && h < 0.48) hueHit++; // 초록 밴드 (mock/컨셉 팔레트)
			}
			shots[clip] = { dataUrl: r.dataUrl, lit, hueFrac: hueN ? hueHit / hueN : 0 };
		}
		return { shots, plain, expectSegs, gotSegs };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT, GENOME: genome });

	if (result.err) { console.error(result.err); process.exit(1); }
	for (const clip of ['walk', 'idle', 'wave']) savePng(result.shots[clip].dataUrl, out(`extracted-${clip}.png`));

	const segOk = result.gotSegs === result.expectSegs;
	const litOk = ['walk', 'idle', 'wave'].every((c) => result.shots[c].lit > 3000);
	const hueOk = result.shots.walk.hueFrac > 0.5;
	console.log(`추출: ${live ? '실호출(LLM)' : 'mock(오프라인)'} — '${genome.name}' 프로파일 통과 ✅ · 반려 경로 ${rejected ? '✅' : '❌'}`);
	console.log(`부속 세그: 실뼈 ${result.plain} + 체인 = ${result.gotSegs} (기대 ${result.expectSegs}) ${segOk ? '✅' : '❌'}`);
	console.log(`3클립 렌더: walk ${result.shots.walk.lit}px · idle ${result.shots.idle.lit}px · wave ${result.shots.wave.lit}px ${litOk ? '✅' : '❌'}`);
	console.log(`팔레트 번역: walk 유채색 중 초록 밴드 ${(result.shots.walk.hueFrac * 100).toFixed(0)}% ${hueOk ? '✅' : '❌'}`);
	console.log('저장:', out('concept-*.png'), out('extracted-*.png'), '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(rejected && segOk && litOk && hueOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
