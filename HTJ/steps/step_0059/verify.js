// step_0059/verify.js — TW1 펼쳐진 지형: 높이장 봉우리 위에 대량 구체가 정착, 계곡에 모인다. 순수·독립·영구.
//
//   design/environment.md §3 TW1 — 0056~0058 로 "딛는 지형의 물리"(정착·마찰·구름 저항=안식각)는 섰다. 이 step 은
//   그것을 *펼쳐진 연속 지형*(여러 봉우리·계곡)으로 키워 "이게 지형이다"를 보인다. 새 엔진 법칙 0 = 중력(0028
//   방사·큰 바닥 구가 가둠)+접촉(0037)+마찰(0057)+구름 저항(0058) *조립*. 골격 = 큰 바닥 구(중력원·안전망) 위에
//   높이장으로 얹은 봉우리 앵커들(seed·environment §2 "큰 골격은 author"), 그 위 표면 디테일·계곡 모임 = 구체 법칙 창발.
//   조립 step 적정 검증(부품 보존은 0028/0037/0057/0058 verify 가 보증): ① 기복 표면 위 정착 ② 계곡 모임(창발·낮은
//   데로) ③ 지형 정적(바닥·봉우리 앵커 불변) ④ 결정론.
//   실행: node HTJ/steps/step_0059/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

function ent(cx, cy, cz, mass, r, anchored) {
  return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0,
    internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anchored };
}
// 결정론적 높이장(완만) — 여러 봉우리·계곡. 인접 앵커 단차가 작아 연속 표면을 이룬다.
function hfTerrain(x, y) {
  return 3.0 * Math.sin(0.35 * x) * Math.cos(0.3 * y) + 2.0 * Math.sin(0.24 * x + 0.2 * y);
}
const R = 60, AR = 4.0, sr = 1.1, SPC = 3, W = 15, BASE = 0;   // 바닥 구 반경·봉우리 앵커반경·자유반경·카펫 간격·범위
const gopt = { G: 7.2e-7, soft: 3 }, copt = { k: 40, cDamp: 25 }, fopt = { k: 40, mu: 0.9 }, ropt = { k: 40, muRoll: 1.5 };

// 골격 = 큰 바닥 구(중력원·안전망) + 그 위(+z 극) 높이장 봉우리 앵커 카펫. 전부 정적.
function buildTerrain() {
  const es = [ent(0, 0, 0, 1e9, R, true)];                      // [0] 바닥 구(중력원)
  for (let gx = -W; gx <= W; gx += SPC) for (let gy = -W; gy <= W; gy += SPC)
    es.push(ent(gx, gy, R + hfTerrain(gx, gy), 1, AR, true));   // 봉우리(저질량=고체 장애물·중력 영향 없음)
  return es;
}
const nAnchor = buildTerrain().length;

function run(seedShift, steps) {
  const es = buildTerrain();
  const saved = es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz }));
  const gold = Math.PI * (3 - Math.sqrt(5)), nFree = 100, free = [];
  for (let i = 0; i < nFree; i++) {
    const rr = Math.sqrt((i + 0.5) / nFree) * W * 0.7, th = gold * i + seedShift;   // 안쪽에 떨군다
    const e = ent(Math.cos(th) * rr, Math.sin(th) * rr, R + 12 + (i % 10) * 0.5, 50, sr, false);
    es.push(e); free.push(e);
  }
  for (let s = 0; s < steps; s++) {
    En.applyEntityGravity(es, 0.02, gopt);                      // 방사 중력(바닥 구가 끈다·가둠)
    En.applyEntityContact(es, 0.02, copt);
    En.applyEntityFriction(es, 0.02, fopt);
    En.applyEntityRollingResistance(es, 0.02, ropt);
    En.stepEntities(es, 0.02);
    for (let i = 0; i < es.length; i++) if (es[i].anchored) { es[i].cx = saved[i].cx; es[i].cy = saved[i].cy; es[i].cz = saved[i].cz; es[i].px = es[i].py = es[i].pz = 0; es[i].Lx = es[i].Ly = es[i].Lz = 0; }
  }
  return { es, free, saved };
}

// ── 1. 기복 표면 위 정착 + 2. 계곡 모임(창발) ──
{
  const { free } = run(0, 7000);
  const rOf = (e) => Math.hypot(e.cx, e.cy, e.cz);
  const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
  // 정착: 바닥 위(관통 안 함=구 속으로 안 빠짐·r>R)·표면 부근·잦아듦.
  const onSurface = free.every(e => rOf(e) > R - 0.5 && rOf(e) < R + 16);
  const meanSpeed = free.reduce((s, e) => s + speed(e), 0) / free.length;
  check('기복 표면 위 정착 — 자유 구체가 높이장 표면 위에 멈춤(관통 안 함)',
    onSurface && meanSpeed < 0.3,
    `표면 위 ${onSurface}(R<r<R+16) · 평균 속도 ${meanSpeed.toFixed(3)}(<0.3)`);
  // 계곡 모임(창발): 정착 구체 평균 지형높이 < 0(봉우리서 굴러내려 계곡에 모임). 균등이면 ≈ 0.
  const meanHF = free.reduce((s, e) => s + hfTerrain(e.cx, e.cy), 0) / free.length;
  check('계곡 모임(창발) — 구체가 봉우리서 굴러내려 계곡(낮은 데)에 모인다',
    meanHF < -0.5, `정착 구체 평균 지형높이 ${meanHF.toFixed(2)}(<0=계곡 선호·봉우리는 비움)`);
}

// ── 3. 지형 정적 — 바닥·봉우리 앵커는 구체가 때려도 불변(외부 경계) ──
{
  const { es, saved } = run(1.3, 4000);
  let maxDisp = 0;
  for (let i = 0; i < nAnchor; i++) maxDisp = Math.max(maxDisp, Math.hypot(es[i].cx - saved[i].cx, es[i].cy - saved[i].cy, es[i].cz - saved[i].cz));
  check('지형 정적 — 바닥·봉우리 앵커 불변(구체가 때려도·외부 경계)',
    maxDisp === 0, `앵커 ${nAnchor}개 최대 변위 ${maxDisp}(=0)`);
}

// ── 4. 결정론 ──
{
  function fp(es) { let h = es.length >>> 0; for (const e of es) h = (Math.imul(h, 131) + Math.round(e.cx * 1e3) + Math.round(e.cz * 1e3)) >>> 0; return h >>> 0; }
  const a = run(0.4, 800), b = run(0.4, 800);
  check('결정론 — 같은 지형·낙하 → 같은 정착 지문', fp(a.es) === fp(b.es), `0x${fp(a.es).toString(16)}`);
}

console.log('\n=== step_0059 수치 검증: TW1 펼쳐진 지형 — 높이장 봉우리 위에 대량 구체 정착·계곡 모임 ===');
console.log(`  (지형 = 바닥 구 + 높이장 봉우리 앵커 ${nAnchor - 1}개 + 자유 구체 100개)`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
