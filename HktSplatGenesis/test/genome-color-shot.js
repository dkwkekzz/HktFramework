// C3 부위 채색(게놈 ②) 촬영 — 뼈 그룹별 램프로 머리/몸통/팔다리 색이 구분되는가.
// 사용: node genome-color-shot.js [palette.png] [plain.png] [프레임수] [스플랫수(2^n)]
//
// 판정:
//  · 부위 색 구분 — palette 게놈(머리 붉게·몸통 초록·다리 노랗게)에서 이미지 머리/몸통/다리
//    밴드의 평균색이 서로 크게 다르다.
//  · 속도 팔레트 유도 회귀 없음 — palette 미지정이면 밴드색이 서로 비슷하다(그룹이 개체 기본색을
//    안 바꾼다). 즉 채색은 게놈이 정한 램프 *양 끝*만 바꾸고, 보간(속도·변형률)은 그대로다.
const path = require('path');
const { serve, launch, collectErrors, savePng, HARNESS_ROUTE, DRIVE_AND_SHOOT } = require('./_common');

const [palOut = 'genome-palette.png', plainOut = 'genome-plain.png', framesArg = '200', nArg = '16384'] = process.argv.slice(2);

(async () => {
	const server = await serve(8139, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	const errors = collectErrors(page);
	await page.goto('http://localhost:8139/harness.html');

	const result = await page.evaluate(async ({ FRAMES, N, DRIVE }) => {
		eval(DRIVE);
		const skeleton = new HktGenesisSkeleton.Skeleton();
		// 부위별 뚜렷한 램프 — 세 부위를 색상환 ~120° 간격으로(머리 빨강·몸통 초록·다리 파랑)
		// 두어 부위 색이 확실히 구분됨을 색상(hue)으로 판정한다. 팔은 시각 변별용 호박색.
		const PALETTE = { palette: {
			head:  { a: '#d02020', b: '#ff6060' },  // 빨강 (hue≈0)
			torso: { a: '#1f9a3a', b: '#6fe07a' },  // 초록 (hue≈0.36)
			arm:   { a: '#d68a12', b: '#ffcf4a' },  // 호박 (변별용)
			leg:   { a: '#2246c8', b: '#7a96ff' },  // 파랑 (hue≈0.62)
			foot:  { a: '#2246c8', b: '#7a96ff' },
		} };

		// 이미지 세로 밴드(머리/몸통/다리)의 밝은 픽셀 평균색 — c2d 캔버스에서 읽는다.
		// 중앙 세로축만 표집(x 290~350)해 팔(측면)의 색이 몸통 밴드에 섞이지 않게 한다.
		function bands() {
			const c2d = document.getElementById('c2d').getContext('2d');
			const w = 640, img = c2d.getImageData(0, 0, w, 640).data;
			const regs = { head: [155, 215], torso: [255, 335], leg: [440, 560] };
			const out = {};
			for (const k in regs) {
				const y0 = regs[k][0], y1 = regs[k][1];
				let r = 0, g = 0, b = 0, n = 0;
				for (let y = y0; y < y1; y++) for (let x = 292; x < 350; x++) {
					const i = (y * w + x) * 4;
					if (img[i] + img[i + 1] + img[i + 2] > 60) { r += img[i]; g += img[i + 1]; b += img[i + 2]; n++; }
				}
				out[k] = n > 40 ? [r / n / 255, g / n / 255, b / n / 255] : null;
			}
			return out;
		}
		async function shoot(genome) {
			const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
			genes.genome = genome; // 살 개체의 채색 게놈 (engine 이 그룹 램프로 업로드)
			genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome);
			const r = await driveAndShoot({
				FRAMES, N, genes,
				makeBones: (simTime) => skeleton.pose('walk', simTime, 1.0, 1.0, genome),
			});
			return { dataUrl: r.dataUrl, gpuErrs: r.gpuErrs, bands: r.gpuErrs.length ? null : bands() };
		}
		const pal = await shoot(PALETTE);
		const plain = await shoot(undefined); // 팔레트 없음 — 회귀 기준
		return { pal, plain };
	}, { FRAMES: parseInt(framesArg), N: parseInt(nArg), DRIVE: DRIVE_AND_SHOOT });

	const { pal, plain } = result;
	if (!pal.dataUrl || !plain.dataUrl) { console.error('GPU 오류:', pal.gpuErrs, plain.gpuErrs); process.exit(1); }
	savePng(pal.dataUrl, path.resolve(palOut));
	savePng(plain.dataUrl, path.resolve(plainOut));

	// 색상(hue) 원형 거리 [0,0.5] — 밝기(속도 유도)와 무관하게 부위색 구분만 본다.
	const hue = (c) => {
		if (!c) return -1;
		const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn;
		if (d < 1e-3) return -1;
		let h;
		if (mx === c[0]) h = ((c[1] - c[2]) / d) % 6; else if (mx === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
		h /= 6; return h < 0 ? h + 1 : h;
	};
	const hdist = (a, b) => { if (a < 0 || b < 0) return 0; const d = Math.abs(a - b); return Math.min(d, 1 - d); };
	const hpairs = (bd) => { const h = { head: hue(bd.head), torso: hue(bd.torso), leg: hue(bd.leg) };
		return [hdist(h.head, h.torso), hdist(h.torso, h.leg), hdist(h.head, h.leg)]; };
	const palMin = Math.min(...hpairs(pal.bands));    // 팔레트: 부위쌍 최소 색상차 (커야 함)
	const plainMax = Math.max(...hpairs(plain.bands)); // 무팔레트: 부위쌍 최대 색상차 (작아야 함)

	const fmt = (c) => c ? `[${c.map((x) => x.toFixed(2)).join(',')}] h${(hue(c) < 0 ? 0 : hue(c)).toFixed(2)}` : '없음';
	console.log('palette  머리', fmt(pal.bands.head), '몸통', fmt(pal.bands.torso), '다리', fmt(pal.bands.leg));
	console.log('무팔레트 머리', fmt(plain.bands.head), '몸통', fmt(plain.bands.torso), '다리', fmt(plain.bands.leg));
	const sepOk = palMin > 0.14;      // 부위 색 구분 (색상환 거리)
	const regOk = plainMax < 0.06;    // 회귀: 기본색을 부위별로 바꾸지 않음 (같은 램프, 속도만 유도)
	console.log(`부위 색 구분: palette 최소 색상차 ${palMin.toFixed(3)} ${sepOk ? '✅' : '❌'}`);
	console.log(`속도 유도 회귀: 무팔레트 최대 색상차 ${plainMax.toFixed(3)} ${regOk ? '✅' : '❌'}`);
	console.log('저장:', palOut, plainOut, '· 페이지 오류:', errors.filter((e) => !e.includes('404')).length ? errors : '없음');

	await browser.close();
	server.close();
	process.exit(sepOk && regOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
