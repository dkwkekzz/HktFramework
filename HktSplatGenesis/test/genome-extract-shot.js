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

	// ── ① 합성 컨셉 이미지: 초록 양서류형 + 옷(머스터드 조끼·파란 반바지) 정면+측면 ──
	// 아주 큰 머리 · 짧고 굵은 다리 — 비율 번역이 사진에서 보여야 하는 극단 체형.
	// 컨셉 아트는 외부 입력의 대역이라 절대 원칙 1 과 무관 (생명 렌더가 아니다).
	const cpage = await browser.newPage();
	await cpage.goto('http://localhost:8142/harness.html');
	const concepts = await cpage.evaluate(() => {
		const c = document.getElementById('c2d'), x = c.getContext('2d');
		const blob = (cx, cy, rx, ry, fill) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
		const G1 = '#357a49', G2 = '#9fe6a8', VEST = '#c99a2e', SHORTS = '#3a63b8';
		const shots = [];
		for (const view of ['front', 'side']) {
			x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, 640, 640); // 단색 배경 (입력 규약)
			if (view === 'front') {
				blob(320, 400, 104, 96, VEST);          // 몸통 = 머스터드 조끼
				blob(320, 430, 58, 52, '#e8b84b');      // 조끼 밝은 배판
				blob(320, 210, 120, 112, G1);           // 아주 큰 머리 (맨살)
				blob(276, 198, 18, 23, '#1c1c1c'); blob(364, 198, 18, 23, '#1c1c1c'); // 눈
				blob(206, 392, 24, 50, G1); blob(434, 392, 24, 50, G1); // 짧은 맨팔
				blob(278, 522, 40, 40, SHORTS); blob(362, 522, 40, 40, SHORTS); // 파란 반바지(짧고 굵은 다리)
				blob(278, 572, 34, 18, G1); blob(362, 572, 34, 18, G1); // 맨발
			} else {
				blob(300, 400, 96, 94, VEST);
				blob(330, 428, 48, 46, '#e8b84b');
				blob(310, 210, 116, 110, G1);
				blob(372, 198, 17, 22, '#1c1c1c');
				blob(300, 522, 42, 40, SHORTS);
				blob(310, 572, 36, 18, G1);
				// 긴 꼬리 — 힙에서 뒤로 처지는 테이퍼 곡선 (맨살)
				x.fillStyle = G1; x.beginPath();
				x.moveTo(240, 400);
				x.quadraticCurveTo(110, 440, 55, 565);
				x.quadraticCurveTo(125, 480, 245, 470);
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

	// ── ④ 게놈 배양: 3클립 사진 + 비율(CPU) + 부위별 옷 색(스크린 투영 샘플) 판정 ──
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8142/harness.html');
	const result = await page.evaluate(async ({ FRAMES, N, DRIVE, GENOME }) => {
		eval(DRIVE);
		const G = HktGenesisGenome;
		const skeleton = new HktGenesisSkeleton.Skeleton();

		// CPU 비율 검증 — 게놈이 선언한 배율이 pose 에 그대로 반영되는가 ("이미지에 맞게 조절")
		// 채색 그룹 g: head=0. 길이 그룹 lg: leg=7 — 허벅지(UpLeg→Leg)+정강이(Leg→Foot)를
		// 모두 포함하므로 다리 *전체* 길이가 leg.l 로 줄어드는지 정확히 잰다 (자식 기준 g 로 재면
		// 정강이가 빠져 거짓 통과). 머리 최대 반지름 비 = head.r.
		const stats = (g) => {
			const segs = new HktGenesisSkeleton.Skeleton().pose('idle', 0, 1, 1, g);
			let top = -9, bot = 9, headR = 0, legLen = 0;
			for (const s of segs) {
				top = Math.max(top, s.a[1], s.b[1]); bot = Math.min(bot, s.a[1], s.b[1]);
				if (s.g === 0) headR = Math.max(headR, s.rb, s.ra);
				if (s.lg === 7) legLen += Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
			}
			return { height: top - bot, headR, legLen, count: segs.length };
		};
		const id = stats({ morph: {} }), mk = stats(GENOME); // mk.count 는 부속 체인 포함
		const declared = (grp, key) => { const e = (GENOME.morph || {})[grp]; return (e && e[key] != null) ? e[key] : 1; };
		const ratios = {
			leg: { got: mk.legLen / id.legLen, want: declared('leg', 'l') },
			head: { got: mk.headR / id.headR, want: declared('head', 'r') },
			height: mk.height / id.height,
		};
		const chains = G.chains(GENOME);
		const expectSegs = id.count + chains.reduce((s, c) => s + c.links, 0);

		// 부위 색 판정 준비 — 관절 world 위치를 스크린에 투영해 그 자리 색을 샘플한다.
		// 게놈 팔레트가 사진의 *그 부위*에 칠해졌는가 = 옷 색 구획의 증명.
		const EYE = [2.3, 1.35, 2.3], CTR = [0, 0.9, 0];
		const view = HktMat.lookAt(EYE, CTR, [0, 1, 0]);
		const proj = HktMat.perspective(0.9, 1.0, 0.05, 100);
		const mulP = (m, v) => [ // column-major mat4 × [v,1]
			m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
			m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
			m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
			m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15],
		];
		const toPx = (p) => {
			const c = mulP(proj, mulP(view, p));
			return [(c[0] / c[3] * 0.5 + 0.5) * 640, (1 - (c[1] / c[3] * 0.5 + 0.5)) * 640];
		};
		// idle 정지 포즈에서 부위 대표점: 머리(g0 최대 rb 세그의 b), 가슴(g2 최대 rb 세그의 b),
		// 허벅지(g7 최장 세그 중점) — 각각 head/torso/leg 램프가 칠해질 자리.
		const samplePts = (() => {
			const segs = skeleton.pose('idle', 0, 1, 1, GENOME);
			let headSeg, torsoSeg, legSeg, hr = 0, tr = 0, ll = 0;
			for (const s of segs) {
				if (s.g === 0 && s.rb > hr) { hr = s.rb; headSeg = s; }
				if (s.g === 2 && s.rb > tr) { tr = s.rb; torsoSeg = s; }
				const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
				if (s.g === 7 && L > ll) { ll = L; legSeg = s; }
			}
			const mid = (s) => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2];
			return { head: toPx(headSeg.b), torso: toPx(torsoSeg.b), leg: toPx(mid(legSeg)) };
		})();

		const hueOf = (r8, g8, b8) => {
			const mx = Math.max(r8, g8, b8), mn = Math.min(r8, g8, b8), d = mx - mn;
			if (d < 10) return -1;
			let h;
			if (mx === r8) h = (((g8 - b8) / d) % 6) / 6; else if (mx === g8) h = ((b8 - r8) / d + 2) / 6; else h = ((r8 - g8) / d + 4) / 6;
			return h < 0 ? h + 1 : h;
		};
		const hexHue = (hex) => { const v = parseInt(hex.slice(1), 16); return hueOf((v >> 16) & 255, (v >> 8) & 255, v & 255); };
		const hdist = (a, b) => { if (a < 0 || b < 0) return 1; const d = Math.abs(a - b); return Math.min(d, 1 - d); };

		const shots = {};
		for (const clip of ['walk', 'idle', 'wave']) {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			HktGenesisGenome.applyMatter(genes, GENOME); // ③ 재질 차분
			genes.genome = GENOME;                       // ①②④ 형태·채색·부속
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, GENOME);
			const r = await driveAndShoot({
				FRAMES, N, genes,
				makeBones: (t) => skeleton.pose(clip, t, 1.0, 1.0, GENOME),
				eye: EYE, center: CTR, // 3/4 시점 — 꼬리(-z 후방) 노출
			});
			if (r.gpuErrs.length) return { err: 'GPU: ' + r.gpuErrs.join(';') };
			const img = document.getElementById('c2d').getContext('2d').getImageData(0, 0, 640, 640).data;
			let lit = 0;
			for (let i = 0; i < img.length; i += 4) if (img[i] + img[i + 1] + img[i + 2] > 70) lit++;
			const shot = { dataUrl: r.dataUrl, lit };
			if (clip === 'idle') {
				// 정지 포즈에서 부위 대표점 주변 유채색 *중앙값* 색상 ↔ 게놈 램프 a 의 색상 대조
				// (평균은 이웃 부위/꼬리 픽셀 오염에 끌린다 — 중앙값 + 좁은 창이 대표색에 강건)
				shot.parts = {};
				for (const [part, [px, py]] of Object.entries(samplePts)) {
					const hues = [];
					for (let y = Math.max(0, py - 14) | 0; y < Math.min(640, py + 14); y++)
						for (let x = Math.max(0, px - 14) | 0; x < Math.min(640, px + 14); x++) {
							const i = (y * 640 + x) * 4;
							if (img[i] + img[i + 1] + img[i + 2] < 70) continue;
							const h = hueOf(img[i], img[i + 1], img[i + 2]);
							if (h >= 0) hues.push(h);
						}
					hues.sort((a, b) => a - b);
					const pal = (GENOME.palette || {})[part];
					shot.parts[part] = {
						got: hues.length ? hues[hues.length >> 1] : -1,
						want: pal ? hexHue(pal.a) : -1,
						n: hues.length,
					};
				}
			}
			shots[clip] = shot;
		}
		return { shots, ratios, gotSegs: mk.count, expectSegs, plain: id.count };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT, GENOME: genome });

	if (result.err) { console.error(result.err); process.exit(1); }
	for (const clip of ['walk', 'idle', 'wave']) savePng(result.shots[clip].dataUrl, out(`extracted-${clip}.png`));

	const hd = (a, b) => { if (a < 0 || b < 0) return 1; const d = Math.abs(a - b); return Math.min(d, 1 - d); };
	const R = result.ratios;
	const propOk = Math.abs(R.leg.got - R.leg.want) < 0.01 && Math.abs(R.head.got - R.head.want) < 0.01 && (R.leg.want >= 1 || R.height < 0.98);
	const segOk = result.gotSegs === result.expectSegs;
	const litOk = ['walk', 'idle', 'wave'].every((c) => result.shots[c].lit > 3000);
	const P = result.shots.idle.parts;
	const partOk = Object.values(P).every((p) => p.n > 60 && hd(p.got, p.want) < 0.09);
	const clothOk = hd(P.torso.got, P.leg.got) > 0.08 && hd(P.torso.got, P.head.got) > 0.08; // 옷 구획: 조끼≠바지≠맨살
	console.log(`추출: ${live ? '실호출(LLM)' : 'mock(오프라인)'} — '${genome.name}' 프로파일 통과 ✅ · 반려 경로 ${rejected ? '✅' : '❌'}`);
	console.log(`비율 번역: 다리 길이 ×${R.leg.got.toFixed(2)}(선언 ${R.leg.want}) · 머리 반지름 ×${R.head.got.toFixed(2)}(선언 ${R.head.want}) · 키 ×${R.height.toFixed(2)} ${propOk ? '✅' : '❌'}`);
	console.log(`부속 세그: 실뼈 ${result.plain} + 체인 = ${result.gotSegs} (기대 ${result.expectSegs}) ${segOk ? '✅' : '❌'}`);
	console.log(`3클립 렌더: walk ${result.shots.walk.lit}px · idle ${result.shots.idle.lit}px · wave ${result.shots.wave.lit}px ${litOk ? '✅' : '❌'}`);
	const fmtH = (h) => h < 0 ? '무채색' : h.toFixed(2);
	console.log(`부위 색(옷 구획): 머리 h${fmtH(P.head.got)}→${fmtH(P.head.want)} · 조끼 h${fmtH(P.torso.got)}→${fmtH(P.torso.want)} · 바지 h${fmtH(P.leg.got)}→${fmtH(P.leg.want)} ${partOk ? '✅' : '❌'} · 구획 대비 ${clothOk ? '✅' : '❌'}`);
	console.log('저장:', out('concept-*.png'), out('extracted-*.png'), '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(rejected && propOk && segOk && litOk && partOk && clothOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
