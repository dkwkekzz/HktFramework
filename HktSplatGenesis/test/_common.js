// HktSplatGenesis test 공용 — 정적 서버 + 헤드리스 WebGPU 크로뮴(swiftshader) + 촬영 유틸
//
// 헤드리스 컴포지터는 WebGPU 표면을 화면에 못 올리므로(스크린샷 검정) 촬영은
// 스왑체인 텍스처 readback 으로 한다. 함정: 마지막 프레임 뒤에 한 번이라도
// await(태스크 양보)하면 present 가 일어나 새(빈) 텍스처를 읽게 된다 —
// 반드시 마지막 frame() 과 copyTextureToBuffer 를 같은 태스크에서 인코딩할 것.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
// charset 필수 — 없으면 프리셋의 한글 키('히키토' 등)가 페이지에서 깨진다
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.fbx': 'application/octet-stream' };

// 프로젝트 루트를 서빙. routes = { '/경로': (req, res) => ... } 로 가상 파일 추가.
// HTTP Range(단일 구간) 지원 — .rad LoD 스트리밍 경로 검증용 (tools/serve.py 와 동일 계약)
function serve(port, routes) {
	const server = http.createServer((req, res) => {
		const url = req.url.split('?')[0];
		if (routes && routes[url]) return routes[url](req, res);
		const p = path.join(ROOT, url === '/' ? 'index.html' : url);
		fs.readFile(p, (err, data) => {
			if (err) { res.writeHead(404); res.end(); return; }
			const type = MIME[path.extname(p)] || 'application/octet-stream';
			const m = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range.trim());
			if (m && (m[1] !== '' || m[2] !== '')) {
				const size = data.length;
				let start, end;
				if (m[1] === '') { const len = Math.min(parseInt(m[2]), size); start = size - len; end = size - 1; }
				else { start = parseInt(m[1]); end = m[2] ? Math.min(parseInt(m[2]), size - 1) : size - 1; }
				if (start > end || start >= size) {
					res.writeHead(416, { 'content-range': `bytes */${size}` });
					res.end();
					return;
				}
				res.writeHead(206, {
					'content-type': type, 'accept-ranges': 'bytes',
					'content-range': `bytes ${start}-${end}/${size}`,
				});
				res.end(data.slice(start, end + 1));
				return;
			}
			res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' });
			res.end(data);
		});
	});
	return new Promise((r) => server.listen(port, () => r(server)));
}

// CHROMIUM_PATH 환경변수로 브라우저 지정 (미지정 시 playwright 번들 크로뮴)
function launch() {
	return chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
		args: ['--headless=new', '--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
			'--use-angle=swiftshader', '--use-vulkan=swiftshader', '--disable-vulkan-surface'],
	});
}

function collectErrors(page) {
	const errors = [];
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
	return errors;
}

// 엔진 직접 구동용 최소 페이지 (app.js/UI 없이 모듈만)
const HARNESS_ROUTE = (req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end('<!doctype html><meta charset="utf-8"><canvas id="gpu" width="640" height="640"></canvas><canvas id="c2d" width="640" height="640"></canvas>'
		+ '<script src="/vendor/three.min.js"><\/script><script src="/vendor/fflate.min.js"><\/script><script src="/vendor/FBXLoader.js"><\/script>'
		+ '<script src="/js/life/math.js"><\/script><script src="/js/life/genome.js"><\/script><script src="/js/life/skeleton.js"><\/script><script src="/js/life/anim.js"><\/script><script src="/js/life/presets.js"><\/script>'
		+ '<script src="/js/life/wgsl.js"><\/script><script src="/js/life/engine.js"><\/script>');
};

// 페이지 컨텍스트에서 쓸 촬영 루프 소스 — new Function 으로 주입한다.
// (page.evaluate 에 문자열 결합 대신 한곳에 모아 두 하니스가 공유)
const DRIVE_AND_SHOOT = `
async function driveAndShoot({ FRAMES, N, makeBones, genes, entities, gridCenter, eye, center, keepState }) {
	const ad = await navigator.gpu.requestAdapter();
	const device = await ad.requestDevice();
	const gpuErrs = [];
	device.addEventListener('uncapturederror', (e) => gpuErrs.push(e.error.message));
	const ctx = document.getElementById('gpu').getContext('webgpu');
	const format = navigator.gpu.getPreferredCanvasFormat();
	ctx.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
	const engine = new HktGenesisEngine(device, ctx, format);
	const ents = entities || [genes];
	engine.setScene(N, ents);
	const view = HktMat.lookAt(eye || [0.9, 1.35, 3.1], center || [0, 0.9, 0], [0, 1, 0]);
	const proj = HktMat.perspective(0.9, 1.0, 0.05, 100);
	const focalY = 0.5 * 640 / Math.tan(0.45);
	const dt = 1 / 60;
	let simTime = 0;
	for (let fr = 0; fr < FRAMES; fr++) {
		simTime += dt;
		engine.frame({
			dt, time: simTime, genes, entities: ents, paused: false, gridCenter,
			pull: [0, 0, 0, 0], bones: makeBones ? makeBones(simTime, dt) : null, showBones: true,
			view, proj, viewport: [640, 640], focal: [focalY, focalY],
		});
		// 마지막 프레임 뒤 양보 금지 (상단 주석의 present 함정)
		if (fr % 20 === 19 && fr !== FRAMES - 1) await device.queue.onSubmittedWorkDone();
	}
	const tex = ctx.getCurrentTexture();
	const bpr = 640 * 4;
	const rb = device.createBuffer({ size: bpr * 640, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
	const sb = device.createBuffer({ size: N * 48, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
	const enc = device.createCommandEncoder();
	enc.copyTextureToBuffer({ texture: tex }, { buffer: rb, bytesPerRow: bpr }, [640, 640, 1]);
	enc.copyBufferToBuffer(engine.splatBuf, 0, sb, 0, N * 48);
	device.queue.submit([enc.finish()]);
	await rb.mapAsync(GPUMapMode.READ);
	await sb.mapAsync(GPUMapMode.READ);
	const splatState = new Float32Array(sb.getMappedRange()).slice(); // 하니스별 지표 계산용
	const px = new Uint8Array(rb.getMappedRange());
	const c2d = document.getElementById('c2d').getContext('2d');
	const img = c2d.createImageData(640, 640);
	const bgra = format.startsWith('bgra');
	for (let i = 0; i < 640 * 640; i++) {
		img.data[i * 4 + 0] = px[i * 4 + (bgra ? 2 : 0)];
		img.data[i * 4 + 1] = px[i * 4 + 1];
		img.data[i * 4 + 2] = px[i * 4 + (bgra ? 0 : 2)];
		img.data[i * 4 + 3] = 255;
	}
	c2d.putImageData(img, 0, 0);
	// splatState 는 페이지 안 지표 계산용(keepState) — evaluate 경계 밖으로는 내보내지 말 것
	return {
		dataUrl: gpuErrs.length ? null : document.getElementById('c2d').toDataURL('image/png'),
		gpuErrs, splatState: keepState ? splatState : undefined,
	};
}
`;

function savePng(dataUrl, outPath) {
	fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

module.exports = { serve, launch, collectErrors, savePng, ROOT, HARNESS_ROUTE, DRIVE_AND_SHOOT };
