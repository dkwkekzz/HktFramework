// S4 Range 서버 계약 검증 — tools/serve.py 가 .rad LoD 스트리밍이 요구하는
// HTTP Range 응답(206 + Content-Range + 정확한 바이트 구간)을 내는지 확인한다.
// (python -m http.server 는 Range 를 무시해 스트리밍이 조용히 전체 다운로드로 퇴화한다 — 교체 이유)
//
// 사용: node range-server.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8137;
const FILE = '/assets/worlds/sample-terrain.ply';

function get(opts) {
	return new Promise((resolve, reject) => {
		const req = http.request({ host: 'localhost', port: PORT, path: FILE, headers: opts.headers || {} }, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
		});
		req.on('error', reject);
		req.end();
	});
}

(async () => {
	const whole = fs.readFileSync(path.join(ROOT, FILE.slice(1)));
	const py = spawn('python3', ['tools/serve.py', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
	try {
		await new Promise((r) => setTimeout(r, 800));
		const checks = [];
		const assert = (name, cond) => { checks.push([name, cond]); if (!cond) console.error('실패:', name); };

		const full = await get({});
		assert('전체 GET 200', full.status === 200 && full.body.length === whole.length);
		assert('Accept-Ranges 광고', full.headers['accept-ranges'] === 'bytes');

		const r1 = await get({ headers: { Range: 'bytes=100-299' } });
		assert('구간 206', r1.status === 206);
		assert('구간 Content-Range', r1.headers['content-range'] === `bytes 100-299/${whole.length}`);
		assert('구간 바이트 일치', r1.body.equals(whole.slice(100, 300)));

		const r2 = await get({ headers: { Range: 'bytes=500-' } }); // 열린 끝
		assert('열린 끝 206', r2.status === 206 && r2.body.length === whole.length - 500);
		assert('열린 끝 바이트 일치', r2.body.equals(whole.slice(500)));

		const r3 = await get({ headers: { Range: 'bytes=-256' } }); // suffix
		assert('suffix 206', r3.status === 206 && r3.body.equals(whole.slice(-256)));

		const r4 = await get({ headers: { Range: `bytes=${whole.length + 10}-` } });
		assert('범위 밖 416', r4.status === 416);

		const failed = checks.filter(([, c]) => !c);
		console.log(`Range 서버 검증: ${checks.length - failed.length}/${checks.length} 통과`);
		process.exit(failed.length ? 1 : 0);
	} finally {
		py.kill();
	}
})().catch((e) => { console.error(e); process.exit(1); });
