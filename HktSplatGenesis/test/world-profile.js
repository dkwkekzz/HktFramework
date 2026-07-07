// W2 검증 (순수 Node) — 월드 스타일 프로파일 + validate(genome):
//  ① 통과: 내장 프리셋(temperate/ashen)·최소 게놈·W4 v0 게놈(breeze-meadow)이 전부 울타리 안.
//  ② 반려: 극단 게놈(과진폭·바이옴 초과·과채도·퇴화 중복·수위 이탈)이 위반과 함께 반려된다.
//     클램프가 아니라 반려 — 이상치는 재추출(C 트랙 원칙).
//
// 브라우저 불필요. 사용: node world-profile.js
const path = require('path');
const fs = require('fs');
const T = require('../js/terrain-gen.js');
const P = require('../js/world-profile.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { (cond ? pass++ : fail++); console.log(`  ${cond ? 'OK ' : '실패'} · ${name}${extra ? ' — ' + extra : ''}`); };

// ── ① 통과: 정당한 월드는 울타리 안 ──────────────────────────────────────
console.log('① 통과해야 하는 게놈:');
for (const name of ['temperate', 'ashen']) {
	const r = P.validate(Object.assign({ seed: 1 }, T.preset(name)));
	ok(`preset ${name}`, r.ok, r.ok ? '' : JSON.stringify(r.violations));
}
{
	const r = P.validate({ seed: 3 }); // 최소 게놈 — 전부 기본값
	ok('최소 게놈 {seed}', r.ok, r.ok ? '' : JSON.stringify(r.violations));
}
{
	const gp = path.join(__dirname, '..', 'tools', 'world-extract', 'genomes', 'breeze-meadow.json');
	const raw = JSON.parse(fs.readFileSync(gp, 'utf8'));
	const g = {}; for (const k in raw) if (!k.startsWith('_')) g[k] = raw[k];
	const r = P.validate(g);
	ok('W4 v0 breeze-meadow.json', r.ok, r.ok ? '' : JSON.stringify(r.violations));
}

// ── ② 반려: 극단 게놈은 위반과 함께 반려 ──────────────────────────────────
console.log('② 반려해야 하는 게놈 (위반 필드 확인):');
function rejects(name, genome, expectFields) {
	const r = P.validate(genome);
	const fields = r.violations.map((x) => x.field);
	const hasAll = expectFields.every((f) => fields.some((ff) => ff.startsWith(f)));
	ok(name, !r.ok && hasAll, `위반 ${JSON.stringify(fields)}`);
}
rejects('과진폭 amp=5', { amp: 5 }, ['amp']);
rejects('바이옴 6개 초과', { biomeSet: Array.from({ length: 6 }, (_, i) => ({ temp: 0.1 * i, humid: 0.5, ampMul: 1, lo: [0.2, 0.3, 0.2], hi: [0.4, 0.5, 0.3] })) }, ['biomeSet.length']);
rejects('과채도 색 [1,0,0]', { biomeSet: [{ temp: 0.5, humid: 0.5, lo: [1, 0, 0], hi: [0.4, 0.5, 0.3] }] }, ['biomeSet[0].lo']);
rejects('퇴화 중복 바이옴', { biomeSet: [{ temp: 0.5, humid: 0.5 }, { temp: 0.51, humid: 0.5 }] }, ['biomeSet[0,1]']);
rejects('수위 relief 이탈 waterY=9', { base: 0.5, amp: 0.9, waterY: 9 }, ['waterY']);
rejects('과ampMul 3.0', { biomeSet: [{ temp: 0.5, humid: 0.5, ampMul: 3.0 }] }, ['biomeSet[0].ampMul']);

console.log(`\n판정: 통과 ${pass} · 실패 ${fail} → ${fail === 0 ? 'OK' : '실패'}`);
process.exit(fail === 0 ? 0 : 1);
