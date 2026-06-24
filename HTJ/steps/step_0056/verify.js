// step_0056/verify.js — TW1 산 = 딛는 지형 표면: 기복 정적 앵커 배열 위에 작은 구체가 정착. 순수·독립·영구.
//
//   design/environment.md §3 TW1 / §2·§4 — 환경 트랙의 첫 벽돌. sphere-world 의 접촉(0037)이 *단일* 큰 구체 위
//   쌓임을 보였다면, 이건 그 *환경 스케일* 판: 기복 있는 지형(지면 + 산 = 모양은 배열에 담김·sphere-world §3)
//   위에 작은 구체(캐릭터 대리)가 떨어져 **정착(딛기)**한다. 새 엔진 법칙 0 — 중력(0028)+접촉(0037) *조립*.
//   **지형 = 정적 앵커**(질량 무한 극한·외부 경계로서 충격 흡수, 지구처럼·environment §4): 힘을 받아도 위치 불변.
//   닫힌계 보존(sphere-world §7)은 *떠다니는 작은 구체들*에 적용되고, 앵커는 그 부분계 밖 경계 — 큰 질량끼리의
//   비현실적 중력 폭발도 이 극한이 자연히 피한다.
//   조립 step 적정 검증(부품 보존은 0028/0037 verify 가 보증·중복 금지): ① 새 상호작용 = 지형 위 정착(관통 안
//   함) ② 창발 = 산(돌출) 위 구체가 낮은 데로 굴러내림(중력 PE↓·법선 접촉만이라 비탈서 미끄러짐) ③ 환경 고유 =
//   지속성(앵커 정적·작은 외란에 표면 안 무너짐) ④ 부드러운 착지(낙하 KE→열·internalE↑ 소산) ⑤ 결정론.
//   실행: node HTJ/steps/step_0056/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 개체 descriptor(0037 verify 와 동일 형식).
function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 0;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: 0, Ly: 0, Lz: 0,
    KEcm, internalKE: 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 100, radius: opts.radius != null ? opts.radius : 1.2, temp: 0, peak: 1,
    anchored: !!opts.anchored                                   // 정적 앵커 플래그(지형)
  };
}
const totInt = (es) => es.reduce((s, e) => s + e.internalE, 0);
const rOf = (e) => Math.hypot(e.cx, e.cy, e.cz);                 // 지면 중심(0,0,0)으로부터 거리(=높이)
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;

const GROUND_R = 10, MOUNT_R = 3.5, SMALL_R = 1.2;
const gopt = { G: 5e-6, soft: 2 };                              // GM≈5(앵커 M=1e6) — 작은 구체를 끈다
const copt = { k: 15, cDamp: 40 };                              // 반발(떠받침) + 강한 감쇠(빨리 정착)

// 기복 지형 = 지면(중심) + 산(+z극 돌출) — 둘 다 정적 앵커. 모양은 배열에 담긴다(sphere-world §3).
function makeTerrain() {
  return [
    ent(0, 0, 0, 1e6, 0, 0, 0, { radius: GROUND_R, anchored: true }),                   // [0] 지면
    ent(0, 0, GROUND_R + MOUNT_R, 1e6, 0, 0, 0, { radius: MOUNT_R, anchored: true })     // [1] 산(기복)
  ];
}
// 정적 앵커 고정 — 한 step 후 지형 구체의 위치·속도를 원복(무한 질량 극한·environment §4).
//   엔진은 안 건드림(viewer/verify 가 장면 구성으로 고정) — engine 은 모든 구체를 동등히 본다.
function pinAnchors(es, saved) {
  for (let i = 0; i < es.length; i++) {
    if (!es[i].anchored) continue;
    const s = saved[i];
    es[i].cx = s.cx; es[i].cy = s.cy; es[i].cz = s.cz;
    es[i].px = 0; es[i].py = 0; es[i].pz = 0; es[i].KEcm = 0; es[i].energy = es[i].internalE;
  }
}
function savePos(es) { return es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz })); }
function run(es, steps) {
  const saved = savePos(es);
  let maxSmallSpeed = 0;
  for (let s = 0; s < steps; s++) {
    En.applyEntityGravity(es, 0.02, gopt);
    En.applyEntityContact(es, 0.02, copt);
    En.stepEntities(es, 0.02);
    pinAnchors(es, saved);                                      // 지형은 정적(외부 경계)
    for (const e of es) if (!e.anchored) maxSmallSpeed = Math.max(maxSmallSpeed, speed(e));
  }
  return maxSmallSpeed;
}

// ── 1. 정착(딛기) + 2. 창발(낮은 데로) ──
{
  const es = makeTerrain();
  const probe = ent(1.4, 0, GROUND_R + 2 * MOUNT_R + SMALL_R, 100, 0, 0, 0, { radius: SMALL_R });  // 산 정상 살짝 비스듬
  es.push(probe);
  const probeR0 = rOf(probe);
  const gold = Math.PI * (3 - Math.sqrt(5)), nSmall = 7, dropR = 18, smalls = [];
  for (let i = 0; i < nSmall; i++) {
    const yfrac = (i + 0.5) / nSmall, r = Math.sqrt(Math.max(0, 1 - yfrac * yfrac)), th = gold * i;
    const e = ent(Math.cos(th) * r * dropR, Math.sin(th) * r * dropR, yfrac * dropR, 100, 0, 0, 0, { radius: SMALL_R });
    es.push(e); smalls.push(e);
  }
  const maxSpeed = run(es, 6000);
  const settled = smalls.concat(probe);
  const noPenetrate = settled.every(e => rOf(e) > GROUND_R - 0.3);
  const stopped = settled.every(e => speed(e) < 0.1) && maxSpeed > 0.3;
  check('정착(딛기) — 작은 구체가 기복 지형 표면 위에 멈춤(지면 관통 안 함)',
    noPenetrate && stopped,
    `관통 없음 ${noPenetrate}(모두 r>${GROUND_R}) · 잔류 속도 max ${Math.max(...settled.map(speed)).toFixed(4)}(낙하 최대 ${maxSpeed.toFixed(2)}→정착)`);
  const probeR1 = rOf(probe);
  check('창발(낮은 데로) — 산 위 구체가 굴러내림(중력 PE↓·비탈 미끄러짐)',
    probeR1 < probeR0 - MOUNT_R && probeR1 < GROUND_R + 2 * SMALL_R + 1.5,
    `시험 구체 높이 r ${probeR0.toFixed(2)}(산 정상)→${probeR1.toFixed(2)}(지면 표면≈${(GROUND_R + SMALL_R).toFixed(1)})`);
}

// ── 3. 지속성 — 앵커(지면·산)는 작은 구체가 때려도 정적(외부 경계·표면 안 무너짐) ──
{
  const es = makeTerrain();
  const ground = es[0], mount = es[1];
  const g0 = { x: ground.cx, y: ground.cy, z: ground.cz }, m0 = { x: mount.cx, y: mount.cy, z: mount.cz };
  for (let i = 0; i < 7; i++) es.push(ent(-6 + i * 2, 0, 16, 100, 0, 0, 0, { radius: SMALL_R }));
  run(es, 6000);
  const groundDisp = Math.hypot(ground.cx - g0.x, ground.cy - g0.y, ground.cz - g0.z);
  const mountDisp = Math.hypot(mount.cx - m0.x, mount.cy - m0.y, mount.cz - m0.z);
  check('지속성 — 지형 앵커(지면·산) 정적·작은 외란에 표면 안 무너짐',
    groundDisp === 0 && mountDisp === 0,
    `지면 변위 ${groundDisp} · 산 변위 ${mountDisp} (정적 앵커=불변)`);
}

// ── 4. 부드러운 착지 — 낙하 KE 가 접촉 감쇠로 internalE(열)↑ → 멈춘다(소산) ──
{
  const es = makeTerrain();
  for (let i = 0; i < 6; i++) es.push(ent(-5 + i * 2, 1, 17, 100, 0, 0, 0, { radius: SMALL_R }));
  const int0 = totInt(es);
  run(es, 4000);
  const int1 = totInt(es);
  const allStopped = es.filter(e => !e.anchored).every(e => speed(e) < 0.1);
  check('부드러운 착지 — 낙하 KE→열(internalE↑) 소산으로 정착',
    int1 > int0 + 1 && allStopped,
    `internalE ${int0.toFixed(1)}→${int1.toFixed(1)}(↑=소산) · 작은 구체 모두 멈춤 ${allStopped}`);
}

// ── 5. 결정론 ──
{
  function fp() {
    const es = makeTerrain();
    for (let i = 0; i < 5; i++) es.push(ent(-4 + i * 2, 0, 16, 100, 0, 0, 0, { radius: SMALL_R }));
    run(es, 800);
    let h = es.length >>> 0;
    for (const e of es) h = (Math.imul(h, 131) + Math.round(e.cx * 1e4) + Math.round(e.cz * 1e4) + Math.round(e.internalE * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 지형·낙하 → 같은 정착 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0056 수치 검증: TW1 산 = 딛는 지형 표면 — 기복 정적 앵커 위에 작은 구체가 정착 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
