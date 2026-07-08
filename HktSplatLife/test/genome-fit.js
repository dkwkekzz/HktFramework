// HktSplatLife R3 자동 정합 — 최적화(학습)를 스플랫이 아니라 *게놈*에 건다.
//
// 표준 3DGS 는 스플랫별 파라미터(수백만)를 멀티뷰 사진으로 학습하지만, 이 프로젝트의
// 정체성은 게놈(수십 개 파라미터)이다 — 그래서 손실을 게놈에 걸어 탐색한다:
//   손실 = (1 − 실루엣 IoU) + w·공간 색격자 ΔE   (레퍼런스 이미지 vs 헤드리스 렌더)
//   탐색 = 좌표 하강 (라운드마다 스텝 반감, 미분 없음·결정론)
// 실루엣은 bbox 정규화라 전체 스케일과 무관하게 *비율*이 맞춰지고, 색격자는 부위 색의
// 공간 배치(보라 머리/흰 상의/데님/피부 다리)를 맞춘다. 평가 노이즈 제거를 위해
// setScene 의 Math.random 을 시드 고정 LCG 로 바꿔 모든 후보가 같은 시드로 배양된다.
//
// 사용: node genome-fit.js [rounds=3] [N=8192] [frames=120] [out=fit-best.png]
// 출력: 최적 morph JSON(stdout) + 최적 렌더 PNG — 결과는 genome.js GENOMES 에 데이터로 굽는다.
const path = require('path');
const { serve, launch, savePng, HARNESS_ROUTE } = require('./_common');

const [roundsArg = '3', nArg = '8192', framesArg = '120', out = 'fit-best.png'] = process.argv.slice(2);
const ROUNDS = parseInt(roundsArg), N = parseInt(nArg), FRAMES = parseInt(framesArg);

// 페이지 안에 상주하는 평가기 — 디바이스·엔진·레퍼런스 격자를 1회 구축, 후보마다 재장면.
const INIT = `
window.__fit = (async () => {
	'use strict';
	const ad = await navigator.gpu.requestAdapter();
	const device = await ad.requestDevice();
	const gpuErrs = [];
	device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
	const ctx = document.getElementById('gpu').getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat();
	ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
	const engine = new HktGenesisEngine(device, ctx, format);
	const skeleton = new HktGenesisSkeleton.Skeleton();
	const view = HktMat.lookAt([0, 0.72, 2.6], [0, 0.66, 0], [0, 1, 0]); // 레퍼런스와 같은 정면
	const proj = HktMat.perspective(0.9, 1.0, 0.05, 100);
	const focalY = 0.5 * 640 / Math.tan(0.45);
	const rb = device.createBuffer({ size: 640 * 4 * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

	// 시드 고정 LCG (mulberry32) — 후보 간 손실 차가 순수하게 게놈 차이가 되게.
	function mulberry32(a) {
		return function () {
			a |= 0; a = (a + 0x6D2B79F5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// ── 정규화 색격자: 픽셀 → 마스크(최대 연결 성분) → bbox → GW×GH 셀 평균 ──
	// bbox 정규화 = 스케일 불변: 격자가 어긋나면 *비율*이 틀린 것이다.
	const GW = 20, GH = 28;
	function toGrid(px, W, H) {
		const mask = new Uint8Array(W * H);
		for (let i = 0; i < W * H; i++) mask[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] > 40) ? 1 : 0;
		// 최대 연결 성분 (4-이웃 BFS) — 레퍼런스 구석의 장식 반짝이 등 잡음 제거
		const lab = new Int32Array(W * H).fill(-1);
		let bestId = -1, bestCnt = 0, id = 0;
		const q = new Int32Array(W * H);
		for (let s = 0; s < W * H; s++) {
			if (!mask[s] || lab[s] >= 0) continue;
			let head = 0, tail = 0, cnt = 0;
			q[tail++] = s; lab[s] = id;
			while (head < tail) {
				const c = q[head++]; cnt++;
				const x = c % W, y = (c / W) | 0;
				if (x > 0 && mask[c - 1] && lab[c - 1] < 0) { lab[c - 1] = id; q[tail++] = c - 1; }
				if (x < W - 1 && mask[c + 1] && lab[c + 1] < 0) { lab[c + 1] = id; q[tail++] = c + 1; }
				if (y > 0 && mask[c - W] && lab[c - W] < 0) { lab[c - W] = id; q[tail++] = c - W; }
				if (y < H - 1 && mask[c + W] && lab[c + W] < 0) { lab[c + W] = id; q[tail++] = c + W; }
			}
			if (cnt > bestCnt) { bestCnt = cnt; bestId = id; }
			id++;
		}
		if (bestId < 0) return null;
		let x0 = W, x1 = 0, y0 = H, y1 = 0;
		for (let i = 0; i < W * H; i++) {
			if (lab[i] !== bestId) continue;
			const x = i % W, y = (i / W) | 0;
			if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
		}
		const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
		const cov = new Float32Array(GW * GH), col = new Float32Array(GW * GH * 3), cnt = new Float32Array(GW * GH);
		for (let y = y0; y <= y1; y++) {
			const gy = Math.min(GH - 1, (((y - y0) / bh) * GH) | 0);
			for (let x = x0; x <= x1; x++) {
				const i = y * W + x;
				const gx = Math.min(GW - 1, (((x - x0) / bw) * GW) | 0);
				const g = gy * GW + gx;
				cnt[g] += 1;
				if (lab[i] === bestId) {
					cov[g] += 1;
					col[g * 3] += px[i * 4]; col[g * 3 + 1] += px[i * 4 + 1]; col[g * 3 + 2] += px[i * 4 + 2];
				}
			}
		}
		for (let g = 0; g < GW * GH; g++) {
			const m = cov[g] || 1;
			col[g * 3] /= m; col[g * 3 + 1] /= m; col[g * 3 + 2] /= m;
			cov[g] = cnt[g] ? cov[g] / cnt[g] : 0;
		}
		return { cov, col };
	}
	function gridLoss(a, b) {
		let inter = 0, uni = 0, cd = 0, cn = 0;
		for (let g = 0; g < GW * GH; g++) {
			const ca = a.cov[g] > 0.35, cb = b.cov[g] > 0.35;
			if (ca && cb) {
				inter++;
				const dr = a.col[g * 3] - b.col[g * 3], dg = a.col[g * 3 + 1] - b.col[g * 3 + 1], db = a.col[g * 3 + 2] - b.col[g * 3 + 2];
				cd += Math.sqrt(dr * dr + dg * dg + db * db) / 441.7; cn++;
			}
			if (ca || cb) uni++;
		}
		const iou = uni ? inter / uni : 0;
		return { loss: (1 - iou) + 0.9 * (cn ? cd / cn : 1), iou, colorD: cn ? cd / cn : 1 };
	}

	// 레퍼런스 격자 (한 번만) — 160px 폭으로 리샘플 후 처리
	const refGrid = await new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const W = 160, H = Math.round(img.height * 160 / img.width);
			const c = document.createElement('canvas'); c.width = W; c.height = H;
			const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
			resolve(toGrid(g.getImageData(0, 0, W, H).data, W, H));
		};
		img.onerror = () => reject(new Error('레퍼런스 이미지 로드 실패'));
		img.src = '/assets/ref-hoshimori.png';
	});

	// 후보 평가: 게놈(morph 차분) → 배양 → 촬영 → 격자 손실
	async function evalMorph(morph, N, FRAMES, wantShot) {
		const base = HktGenesisGenome.GENOMES['별지기'];
		const genome = { morph, palette: base.palette, appendix: base.appendix, matter: base.matter };
		const genes = HktGenesisGenes.materialize(HktGenesisGenes.PRESETS['히키토']);
		genes.genome = genome;
		HktGenesisGenome.applyMatter(genes, genome);
		genes.bindBones = skeleton.pose('idle', 0, 1, 1, genome);
		const saved = Math.random;
		Math.random = mulberry32(1234);
		engine.setScene(N, [genes]);
		Math.random = saved;
		const dt = 1 / 60;
		let simTime = 0;
		for (let fr = 0; fr < FRAMES; fr++) {
			simTime += dt;
			engine.frame({
				dt, time: simTime, genes, entities: [genes], paused: false, pull: [0, 0, 0, 0],
				bones: skeleton.pose('idle', simTime, 1.0, 1.0, genome), showBones: false,
				view, proj, viewport: [640, 640], focal: [focalY, focalY],
			});
			if (fr % 30 === 29 && fr !== FRAMES - 1) await device.queue.onSubmittedWorkDone();
		}
		// 마지막 frame 과 같은 태스크에서 readback 인코딩 (present 함정 — _common.js 참조)
		const enc = device.createCommandEncoder();
		enc.copyTextureToBuffer({ texture: ctx.getCurrentTexture() }, { buffer: rb, bytesPerRow: 640 * 4 }, [640, 640, 1]);
		device.queue.submit([enc.finish()]);
		await rb.mapAsync(GPUMapMode.READ);
		const raw = new Uint8Array(rb.getMappedRange());
		// 640 → 160 리샘플 (4×4 평균) + BGRA 스왑
		const W = 160, bgra = format.startsWith('bgra');
		const px = new Uint8ClampedArray(W * W * 4);
		for (let y = 0; y < W; y++) {
			for (let x = 0; x < W; x++) {
				let r = 0, g = 0, b = 0;
				for (let sy = 0; sy < 4; sy++) {
					for (let sx = 0; sx < 4; sx++) {
						const i = ((y * 4 + sy) * 640 + x * 4 + sx) * 4;
						r += raw[i + (bgra ? 2 : 0)]; g += raw[i + 1]; b += raw[i + (bgra ? 0 : 2)];
					}
				}
				const o = (y * W + x) * 4;
				px[o] = r / 16; px[o + 1] = g / 16; px[o + 2] = b / 16; px[o + 3] = 255;
			}
		}
		let shot = null;
		if (wantShot) {
			const c = document.getElementById('c2d'); c.width = 160; c.height = 160;
			c.getContext('2d').putImageData(new ImageData(px, W, W), 0, 0);
			shot = c.toDataURL('image/png');
		}
		rb.unmap();
		const grid = toGrid(px, W, W);
		if (!grid) return { loss: 9, iou: 0, colorD: 1, gpuErrs, shot };
		const r = gridLoss(refGrid, grid);
		return { loss: r.loss, iou: r.iou, colorD: r.colorD, gpuErrs, shot };
	}
	return { evalMorph, gpuErrs };
})();
`;

(async () => {
	const server = await serve(8153, { '/harness.html': HARNESS_ROUTE });
	const browser = await launch();
	const page = await browser.newPage();
	page.setDefaultTimeout(0);
	page.on('pageerror', (e) => console.error('pageerror:', e.message));
	await page.goto('http://localhost:8153/harness.html');
	await page.evaluate(INIT);
	await page.evaluate(() => window.__fit); // 초기화 완료 대기

	const evalMorph = (morph, wantShot) => page.evaluate(
		async ({ morph, N, FRAMES, wantShot }) => {
			const F = await window.__fit;
			return await F.evalMorph(morph, N, FRAMES, wantShot);
		}, { morph, N, FRAMES, wantShot: !!wantShot });

	// ── 탐색 공간: 별지기 morph 를 초기값으로 한 좌표 하강 ──
	// [그룹, 필드, min, max] — 프로파일 울타리 안. 색·부속·재질은 고정(손실의 색항은
	// 비율이 색 배치를 어긋나게 하는 것을 벌점으로 잡는 용도).
	const SPACE = [
		['head', 'r', 1.0, 2.2], ['neck', 'r', 0.5, 1.2], ['neck', 'l', 0.8, 1.8],
		['torso', 'r', 0.7, 1.5], ['torso', 'l', 0.6, 1.2], ['shoulder', 'r', 0.5, 1.2],
		['arm', 'r', 0.5, 1.2], ['forearm', 'l', 0.5, 1.2], ['hand', 'l', 0.5, 1.2],
		['upleg', 'r', 0.8, 1.8], ['leg', 'r', 0.7, 1.6], ['leg', 'l', 0.5, 1.0],
		['foot', 'r', 0.5, 1.3], ['foot', 'l', 0.5, 1.0],
	];
	// 초기 morph = genome.js 별지기 값 (페이지에서 읽어온다 — 단일 원본 유지)
	const init = await page.evaluate(() => JSON.parse(JSON.stringify(HktGenesisGenome.GENOMES['별지기'].morph)));

	const getV = (m, g, f) => (m[g] && m[g][f] != null) ? m[g][f] : 1;
	const setV = (m, g, f, v) => { m[g] = Object.assign({}, m[g]); m[g][f] = Math.round(v * 100) / 100; };

	let cur = JSON.parse(JSON.stringify(init));
	let best = await evalMorph(cur);
	console.log(`기준 손실 ${best.loss.toFixed(4)} (IoU ${best.iou.toFixed(3)} · 색 ${best.colorD.toFixed(3)})`);
	let evals = 1;
	let step = 0.2;
	for (let round = 0; round < ROUNDS; round++) {
		for (const [g, f, lo, hi] of SPACE) {
			const v0 = getV(cur, g, f);
			for (const dv of [step, -step]) {
				const v = Math.min(hi, Math.max(lo, v0 + dv));
				if (Math.abs(v - getV(cur, g, f)) < 1e-6) continue;
				const cand = JSON.parse(JSON.stringify(cur));
				setV(cand, g, f, v);
				const r = await evalMorph(cand);
				evals++;
				if (r.loss < best.loss - 1e-4) {
					best = r; cur = cand;
					console.log(`  개선 #${evals} ${g}.${f} ${v0.toFixed(2)}→${v.toFixed(2)} · 손실 ${r.loss.toFixed(4)} (IoU ${r.iou.toFixed(3)} · 색 ${r.colorD.toFixed(3)})`);
				}
			}
		}
		step /= 2;
		console.log(`라운드 ${round + 1}/${ROUNDS} 종료 · 손실 ${best.loss.toFixed(4)} · 평가 ${evals}회`);
	}

	const fin = await evalMorph(cur, true);
	if (fin.shot) savePng(fin.shot, path.resolve(out));
	console.log(`\n최종 손실 ${fin.loss.toFixed(4)} (IoU ${fin.iou.toFixed(3)} · 색 ${fin.colorD.toFixed(3)}) · GPU 오류 ${fin.gpuErrs.length}`);
	console.log('최적 morph (genome.js GENOMES 에 굽기):');
	console.log(JSON.stringify(cur));
	await browser.close();
	server.close();
	process.exit(fin.gpuErrs.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
