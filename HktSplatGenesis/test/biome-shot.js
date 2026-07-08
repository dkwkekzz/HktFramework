// T1 검증 — 월드 함수(무한 도메인 + 바이옴)의 두 완료 기준을 한 커맨드로:
//  ① 연속성(순수 Node): 시드는 같고 원점(cx,cz)만 다른 두 창이 겹침 영역에서
//     height/biome/color 가 수치 일치(diff 0) — 청크 경계 연속성의 근거.
//  ② 다채로움(브라우저): 넓은 파노라마 PLY 를 Spark 무대로 로드해 조감 촬영,
//     렌더 픽셀에서 4바이옴(+수역)이 색으로 구분되는지 판정 + PNG 저장.
//
// 무대는 "로드 대상"이므로 지형을 코드로 생성하는 것은 절대 원칙 1 위배가 아니다 (생명 아님).
// 사용: node biome-shot.js [out.png] [seed=7]
const { serve, launch, collectErrors, savePng } = require('./_common');
const T = require('../js/env/terrain-gen.js');

// ── ① 연속성 (순수 Node) ────────────────────────────────────────────────
function continuityCheck(seed) {
	const wp = { seed, extent: 45, amp: 0.9, scale: 3.0, octaves: 4 };
	const A = T.create(Object.assign({}, wp, { cx: 0, cz: 0 }));
	const B = T.create(Object.assign({}, wp, { cx: 30, cz: -20 })); // 겹침: x∈[-15,15], z∈[-25,5]
	let maxH = 0, maxRel = 0, maxCol = 0, biomeMiss = 0, n = 0;
	for (let i = 0; i < 2000; i++) {
		// 두 창이 모두 덮는 월드 좌표만
		const x = -15 + (i % 40) / 40 * 30;
		const z = -25 + ((i * 7) % 60) / 60 * 30;
		maxH = Math.max(maxH, Math.abs(A.height(x, z) - B.height(x, z)));
		maxRel = Math.max(maxRel, Math.abs(A.heightAt(x, z) - B.heightAt(x, z)));
		const ba = A.biomeAt(x, z), bb = B.biomeAt(x, z);
		if (ba.id !== bb.id) biomeMiss++;
		const ca = A.colorAt(x, z), cb = B.colorAt(x, z);
		for (let c = 0; c < 3; c++) maxCol = Math.max(maxCol, Math.abs(ca[c] - cb[c]));
		n++;
	}
	const ok = maxH === 0 && maxRel === 0 && maxCol === 0 && biomeMiss === 0;
	console.log(`① 연속성(n=${n}): height Δ${maxH} · heightAt Δ${maxRel} · color Δ${maxCol} · biome 불일치 ${biomeMiss} → ${ok ? 'OK' : '실패'}`);
	return ok;
}

// ── ② 파노라마 PLY + 바이옴 지상 진리 ────────────────────────────────────
// 넓은 창을 즉석 생성. spread = extent*0.875 (plyBytes 와 동일 내부 여백).
const SEED = parseInt(process.argv[3] || '7');
const EXT = 90, SPREAD = EXT * 0.875, G = 384;
const W = T.world({ seed: SEED, amp: 0.9, scale: 3.0, octaves: 4 });

function groundTruthHist() {
	const hist = {};
	for (let i = 0; i < 8000; i++) {
		const x = -SPREAD + (i % 90) / 90 * 2 * SPREAD;
		const z = -SPREAD + ((i * 13) % 90) / 90 * 2 * SPREAD;
		const b = W.biomeAt(x, z);
		hist[b.key] = (hist[b.key] || 0) + 1;
	}
	return hist;
}

(async () => {
	const out = process.argv[2] || 'biome.png';

	// ① 먼저 순수 검사 — 실패면 렌더 없이 종료
	const contOk = continuityCheck(SEED);

	// 지상 진리: 파노라마 영역에 4 육상 바이옴이 실제로 생성되는가
	const gt = groundTruthHist();
	const landBiomes = ['plains', 'mountain', 'desert', 'snow'].filter((k) => (gt[k] || 0) >= 200);
	console.log(`② 지상 진리 바이옴 분포: ${JSON.stringify(gt)} → 육상 ${landBiomes.length}/4`);

	// 파노라마 PLY (즉석) — splatScale 은 넓은 창 커버리지에 맞춰 상향
	const ply = Buffer.from(T.create({ seed: SEED, amp: 0.9, scale: 3.0, octaves: 4, extent: EXT }).plyBytes(G, 1.7));
	console.log(`파노라마 PLY: ${G}² = ${G * G} 스플랫 · ${(ply.length / 1e6).toFixed(2)}MB`);

	const server = await serve(8138, {
		'/assets/worlds/biome-panorama.ply': (req, res) => {
			res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': ply.length });
			res.end(ply);
		},
	});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
	});
	await page.goto('http://localhost:8138/?world=/assets/worlds/biome-panorama.ply&lod=0', { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('무대 로드 대기 초과 — 콘솔 오류:', errors);
		process.exit(1);
	}
	console.log('무대: 파노라마 로드 완료 (hasWorld)');

	// 조감 파노라마 카메라. Spark 는 스플랫 GPU 패킹에 렌더 몇 프레임이 필요하다 —
	// 측정 전에 워밍업 캡처를 돌려 스플랫이 다 올라온 뒤 찍는다.
	const CAM = { fov: 0.92, up: [0, 1, 0], target: [0, 0, 0], eye: [0, 58, 92] };
	for (let k = 0; k < 6; k++) {
		await page.evaluate((cm) => HktGenesisStage.capture({ fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye }, 768, 640), CAM);
		await page.waitForTimeout(120);
	}

	// 무대만 캡처 (생명 렌더 불필요 — 무대 = 지형) + 렌더 픽셀 색족 분류
	const shot = await page.evaluate((cm) => {
		const orbit = { fov: cm.fov, up: cm.up, target: cm.target, _eye: () => cm.eye };
		const W = 768, H = 640;
		const url = HktGenesisStage.capture(orbit, W, H);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const c = document.createElement('canvas'); c.width = W; c.height = H;
				const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
				const px = g.getImageData(0, 0, W, H).data;
				// 배경(어두운 하늘) 제외 후 색족(hue-family) 분류 — 감마에 견디는 규칙
				const buckets = { water: 0, plains: 0, desert: 0, snow: 0, mountain: 0 };
				let land = 0;
				for (let i = 0; i < W * H; i++) {
					const r = px[i * 4], gr = px[i * 4 + 1], b = px[i * 4 + 2];
					const lum = r * 0.3 + gr * 0.5 + b * 0.2;
					if (lum < 24 && b >= r) continue; // 배경 클리어색(0x06070f) 근처
					land++;
					if (r > 195 && gr > 195 && b > 195) buckets.snow++;
					else if (b > r + 14 && b > gr + 2) buckets.water++;
					else if (gr > r + 8 && gr > b + 10) buckets.plains++;
					else if (r > b + 22 && gr > b + 6 && r > 110) buckets.desert++;
					else if (Math.abs(r - gr) < 28 && Math.abs(gr - b) < 28) buckets.mountain++;
				}
				resolve({ dataUrl: c.toDataURL('image/png'), buckets, land });
			};
			img.onerror = () => resolve({ err: 'stage capture 이미지 로드 실패' });
			img.src = url;
		});
	}, CAM);

	if (shot.err) { console.error(shot.err); process.exit(1); }
	savePng(shot.dataUrl, out);
	const b = shot.buckets, land = shot.land || 1;
	const frac = {};
	for (const k of Object.keys(b)) frac[k] = +(100 * b[k] / land).toFixed(1);
	console.log(`저장: ${out} · 지형 픽셀 ${land}`);
	console.log(`② 렌더 색족 비율(%): ${JSON.stringify(frac)}`);
	// 판정: 렌더에서 서로 다른 색족이 ≥4 (각 ≥2%) 나와야 = 바이옴이 색으로 구분됨
	const distinct = Object.keys(frac).filter((k) => frac[k] >= 2);
	const real = errors.filter((e) => !e.includes('404'));
	const ok = contOk && landBiomes.length === 4 && distinct.length >= 4 && land > 40000 && real.length === 0;
	console.log(`판정: 연속성 ${contOk} · 육상바이옴 ${landBiomes.length}/4 · 렌더색족 ${distinct.length}(${distinct.join(',')}) → ${ok ? 'OK' : '실패'}`);
	if (!ok && real.length) console.error('콘솔 오류:', real);
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
