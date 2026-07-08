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

function savePng(dataUrl, outPath) {
	fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

module.exports = { serve, launch, collectErrors, savePng, ROOT };
