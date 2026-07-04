// S3 오클루전 검증 — fixture 지형에서 능선이 카메라↔슬라임 사이에 오는 시점을 height() 로
// 탐색해 카메라를 그리 옮기고, 오클루전 on/off 의 생명 픽셀 수를 비교한다 (on ≪ off = 가려짐).
// 사진 2장: 가려진 화면(on) / 같은 시점의 미가림(off) — "전후" 완료 기준.
//
// 사용: node occlusion-shot.js outOn.png outOff.png [settleFrames=60] [count=65536]
const { serve, launch, collectErrors, savePng } = require('./_common');
const { height, genTerrainPly, genTerrainGlb } = require('./_fixture');

// 능선 가림 카메라 탐색: target 을 보는 반경 R 광선이 지형에 최대로 막히는 yaw
function findOccludedCamera() {
	const target = [0, 0.7, 0], R = 7, pitch = 0.03;
	let best = null;
	for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.03) {
		const cp = Math.cos(pitch), sp = Math.sin(pitch);
		const eye = [target[0] + R * cp * Math.sin(yaw), target[1] + R * sp, target[2] + R * cp * Math.cos(yaw)];
		let block = -1e9;
		for (let s = 0.15; s <= 0.85; s += 0.02) {
			const px = eye[0] + s * (target[0] - eye[0]);
			const py = eye[1] + s * (target[1] - eye[1]);
			const pz = eye[2] + s * (target[2] - eye[2]);
			if (Math.abs(px) > 4.6 || Math.abs(pz) > 4.6) continue; // collider 영역 안에서만
			block = Math.max(block, height(px, pz) - py);
		}
		if (!best || block > best.block) best = { yaw, pitch, radius: R, target, block };
	}
	return best;
}

(async () => {
	const outOn = process.argv[2] || 'occ-on.png';
	const outOff = process.argv[3] || 'occ-off.png';
	const SETTLE = parseInt(process.argv[4] || '60');
	const COUNT = process.argv[5] || '65536';
	const cam = findOccludedCamera();
	console.log(`가림 카메라: yaw ${cam.yaw.toFixed(2)} · 능선이 시선 위로 ${cam.block.toFixed(2)}u`);
	if (cam.block < 0.2) { console.error('fixture 에서 가림 시점을 못 찾음 — height() 확인'); process.exit(1); }

	const ply = genTerrainPly(), glb = genTerrainGlb();
	const server = await serve(8136, {
		'/assets/worlds/test-terrain.ply': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(ply); },
		'/assets/worlds/test-terrain.glb': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(glb); },
	});
	const browser = await launch();
	const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
	const errors = collectErrors(page);
	await page.addInitScript(() => {
		window.__rafCbs = [];
		window.requestAnimationFrame = (cb) => { window.__rafCbs.push(cb); return 1; };
		const orig = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...a) {
			const d = await orig.apply(this, a);
			window.__device = d;
			return d;
		};
	});
	await page.goto('http://localhost:8136/?world=/assets/worlds/test-terrain.ply&collider=/assets/worlds/test-terrain.glb', { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.HktGenesisStage && window.HktGenesisStage.hasWorld
			&& document.getElementById('stCollide').checked,
			null, { timeout: 60000, polling: 500 });
	} catch (e) {
		console.error('준비 초과 — 콘솔 오류:', errors);
		process.exit(1);
	}
	await page.selectOption('#count', COUNT);
	await page.evaluate(() => [...document.querySelectorAll('#presets button')].find((b) => b.textContent === '슬라임').click());

	let ts = 1000;
	// 정착 스텝 — 훅으로 camera/engine 참조를 잡아둔다
	await page.evaluate(() => { window.__hktAfterFrame = (o) => { window.__cam = o.camera; window.__eng = o.engine; }; });
	for (let i = 0; i < SETTLE; i++) {
		ts += 50;
		await page.evaluate(async (t) => {
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			if (window.__device) await window.__device.queue.onSubmittedWorkDone();
		}, ts);
	}

	// 한 프레임 촬영: 스왑체인 readback + 무대 캡처 합성 + 생명 픽셀 수
	const shoot = async (label) => {
		ts += 50;
		return page.evaluate(async (t) => {
			let cap = null;
			const prev = window.__hktAfterFrame;
			window.__hktAfterFrame = ({ device, context, canvas, camera }) => {
				const w = canvas.width, h = canvas.height, bpr = w * 4;
				const rb = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
				const enc = device.createCommandEncoder();
				enc.copyTextureToBuffer({ texture: context.getCurrentTexture() }, { buffer: rb, bytesPerRow: bpr }, [w, h, 1]);
				device.queue.submit([enc.finish()]);
				cap = { device, rb, w, h, camera };
			};
			const cbs = window.__rafCbs; window.__rafCbs = [];
			for (const cb of cbs) cb(t);
			window.__hktAfterFrame = prev;
			if (!cap) return { err: '훅 미실행' };
			const stageUrl = HktGenesisStage.capture(cap.camera, innerWidth, innerHeight);
			await cap.rb.mapAsync(GPUMapMode.READ);
			const px = new Uint8Array(cap.rb.getMappedRange());
			const img = new Image();
			await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = stageUrl; });
			const c = document.createElement('canvas');
			c.width = cap.w; c.height = cap.h;
			const g = c.getContext('2d');
			g.drawImage(img, 0, 0, cap.w, cap.h);
			const view = g.getImageData(0, 0, cap.w, cap.h);
			const bgra = navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');
			let lifePx = 0;
			for (let i = 0; i < cap.w * cap.h; i++) {
				const lr = px[i * 4 + (bgra ? 2 : 0)], lg = px[i * 4 + 1], lb = px[i * 4 + (bgra ? 0 : 2)], la = px[i * 4 + 3];
				if (la > 10) lifePx++;
				const ia = 1 - la / 255;
				view.data[i * 4 + 0] = Math.min(255, lr + view.data[i * 4 + 0] * ia);
				view.data[i * 4 + 1] = Math.min(255, lg + view.data[i * 4 + 1] * ia);
				view.data[i * 4 + 2] = Math.min(255, lb + view.data[i * 4 + 2] * ia);
				view.data[i * 4 + 3] = 255;
			}
			g.putImageData(view, 0, 0);
			return { dataUrl: c.toDataURL('image/png'), lifePx };
		}, ts);
	};

	// 카메라를 가림 시점으로 이동 (다음 프레임부터 반영)
	await page.evaluate((c) => {
		const cam = window.__cam;
		cam.yaw = c.yaw; cam.pitch = c.pitch; cam.radius = c.radius;
		cam.target[0] = c.target[0]; cam.target[1] = c.target[1]; cam.target[2] = c.target[2];
	}, cam);

	const on = await shoot('on');
	if (on.err) { console.error(on.err); process.exit(1); }
	await page.evaluate(() => window.__eng.setOccluder(null)); // 같은 시점, 가림만 제거
	const off = await shoot('off');
	if (off.err) { console.error(off.err); process.exit(1); }

	savePng(on.dataUrl, outOn);
	savePng(off.dataUrl, outOff);
	const ratio = on.lifePx / Math.max(off.lifePx, 1);
	console.log(`저장: ${outOn} (가림 ${on.lifePx}px) / ${outOff} (미가림 ${off.lifePx}px) · 비율 ${(ratio * 100).toFixed(0)}%`);
	const real = errors.filter((e) => !e.includes('404'));
	// 판정: 미가림에서 슬라임이 충분히 보이고, 가림에서 생명 픽셀이 절반 미만으로 준다
	const ok = off.lifePx > 3000 && ratio < 0.5 && real.length === 0;
	if (!ok) console.error('판정 실패:', JSON.stringify({ on: on.lifePx, off: off.lifePx, ratio, errors: real }));
	await browser.close();
	server.close();
	process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
