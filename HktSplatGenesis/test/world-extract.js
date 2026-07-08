// W4 자동화 검증 (순수 Node, 목 모드) — extract.js 파이프라인이:
//  ① 통과: 프로파일 안 게놈(목 응답)을 파싱·검증·_meta 부착·저장한다.
//  ② 반려: 프로파일 밖 게놈(과진폭)은 반려하고 파일을 쓰지 않는다(exit≠0).
// 라이브 vision 호출(ANTHROPIC_API_KEY 필요)은 제외 — 결정론 파이프라인만 검증한다.
//
// 사용: node world-extract.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const WP = require('../js/env/world-profile.js');

const EXTRACT = path.join(__dirname, '..', 'tools', 'world-extract', 'extract.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-'));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { (cond ? pass++ : fail++); console.log(`  ${cond ? 'OK ' : '실패'} · ${name}${extra ? ' — ' + extra : ''}`); };

function runMock(mockObj, outName) {
	const mockPath = path.join(tmp, outName + '.mock.json');
	const outPath = path.join(tmp, outName + '.out.json');
	fs.writeFileSync(mockPath, JSON.stringify(mockObj));
	let code = 0, stderr = '';
	try {
		execFileSync('node', [EXTRACT, 'dummy-image.jpg', outPath, '7'],
			{ env: Object.assign({}, process.env, { HKT_EXTRACT_MOCK: mockPath }), stdio: 'pipe' });
	} catch (e) { code = e.status || 1; stderr = (e.stderr || '').toString(); }
	return { code, outPath, wrote: fs.existsSync(outPath), stderr };
}

// ── ① 통과: 실제 W4 v0 게놈(breeze-meadow)을 목 응답으로 ──────────────────
const breeze = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'world-extract', 'genomes', 'breeze-meadow.json'), 'utf8'));
const good = {}; for (const k in breeze) if (k[0] !== '_') good[k] = breeze[k];
const g = runMock(good, 'good');
let goodValid = false;
if (g.wrote) {
	const written = JSON.parse(fs.readFileSync(g.outPath, 'utf8'));
	const clean = {}; for (const k in written) if (k[0] !== '_') clean[k] = written[k];
	goodValid = WP.validate(clean).ok && !!written._meta && written._meta.attempts === 1;
}
ok('프로파일 안 게놈 → 저장·검증·_meta', g.code === 0 && g.wrote && goodValid, `exit ${g.code}`);

// ── ② 반려: 과진폭 게놈은 반려·미저장 ────────────────────────────────────
const bad = { amp: 5, base: 0.5, waterY: 0, water: good.water, biomeSet: good.biomeSet };
const b = runMock(bad, 'bad');
ok('프로파일 밖 게놈 → 반려·미저장', b.code !== 0 && !b.wrote, `exit ${b.code}`);
ok('반려 사유에 amp 위반 노출', /amp/.test(b.stderr), b.stderr.split('\n').find((l) => /amp/.test(l)) || '');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n판정: 통과 ${pass} · 실패 ${fail} → ${fail === 0 ? 'OK' : '실패'}`);
process.exit(fail === 0 ? 0 : 1);
