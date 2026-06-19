// step_0001/verify.js — 기반 무대(격자 + 장)의 *수치 검증*. 순수·독립·영구.
//
//   이 step 은 동역학(법칙)이 없다. 검증하는 것은 *공간의 존재와 결정론*이다:
//     1. 격자 = N³ · 인덱싱이 전단사(왕복 일치)
//     2. 결정론 — 같은 (N, seed) → 동일 지문(fingerprint)
//     3. 데모 시드(공)의 점유 셀 수가 *정확히* 기대값과 일치(회귀 가드)
//     4. 인덱싱이 셀 배열 전체를 빠짐없이/겹침없이 덮는다
//
//   세계는 격자 위에 이름 붙은 *장(field)* 을 둔다 — 기본 장 'energy'. 데모 공을 그 장에 시드한다.
//   실행: node HTJ/steps/step_0001/verify.js
//   이 파일은 무대(장 모델) rename 으로 1회 갱신됨 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// ── 1. 격자 크기 + 인덱싱 전단사 ──
{
  const N = 8;
  const w = W.createWorld(N);
  check('격자 = N³ 셀', w.fields.energy.length === N * N * N, `${w.fields.energy.length} == ${N ** 3}`);

  let bijective = true, covered = new Uint8Array(N * N * N);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = w.index(x, y, z);
    if (i < 0 || i >= N ** 3) { bijective = false; break; }
    if (covered[i]) { bijective = false; break; }   // 겹침
    covered[i] = 1;
    const c = w.coords(i);                            // 왕복: i → (x,y,z) 복원
    if (c[0] !== x || c[1] !== y || c[2] !== z) { bijective = false; break; }
  }
  let allCovered = true; for (let i = 0; i < N ** 3; i++) if (!covered[i]) { allCovered = false; break; }
  check('인덱싱 전단사(왕복 일치·겹침 0)', bijective, bijective ? 'ok' : '실패');
  check('인덱싱이 배열 전체를 덮음(빈틈 0)', allCovered, allCovered ? 'ok' : '실패');
}

// ── 2. 결정론: 같은 (N, seed) → 같은 지문 ──
{
  const a = W.seedBall(W.createWorld(32), { seed: 42 });
  const b = W.seedBall(W.createWorld(32), { seed: 42 });
  check('결정론 — 같은 시드 → 동일 지문', a.fingerprint('energy') === b.fingerprint('energy'),
    `0x${a.fingerprint('energy').toString(16)} == 0x${b.fingerprint('energy').toString(16)}`);
  // get/set 일관성: 임의 셀을 직접 set 한 뒤 get 일치
  const w = W.createWorld(16); w.set('energy', 3, 5, 9, 7);
  check('get/set 왕복 일치', w.get('energy', 3, 5, 9) === 7 && w.fields.energy[w.index(3, 5, 9)] === 7, w.get('energy', 3, 5, 9));
}

// ── 3. 데모 공의 점유 셀 수 = 정확한 기대값(회귀 가드) ──
{
  const N = 32;
  const w = W.seedBall(W.createWorld(N), { seed: 42 });
  // 기대값: 같은 알고리즘으로 독립 재계산(코드 한 줄 변형도 잡아내는 골든).
  const c = (N - 1) / 2, r = N * 0.42;
  let expect = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - c, dy = y - c, dz = z - c;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= r) expect++;
  }
  const got = w.count('energy');
  check('데모 공 점유 셀 수 = 기대값', got === expect, `${got} == ${expect}`);
  check('공이 비어있지 않고 전체를 채우지도 않음(진짜 표면 존재)', got > 0 && got < N ** 3, `${got} / ${N ** 3}`);
  // 값 띠가 셋 다 존재(1/2/3) → 렌더 색 구분의 근거
  const vals = new Set(); for (const v of w.fields.energy) if (v) vals.add(v);
  check('값 띠 3종(1/2/3) 모두 존재', vals.has(1) && vals.has(2) && vals.has(3), '{' + [...vals].sort().join(',') + '}');
}

// ── 4. clear 후 빈 공간 ──
{
  const w = W.seedBall(W.createWorld(16), { seed: 1 });
  w.clear('energy');
  check('clear → 점유 0', w.count('energy') === 0, w.count('energy'));
}

// ── 결과 ──
console.log('\n=== step_0001 수치 검증: 기반 무대(격자 + 장) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
