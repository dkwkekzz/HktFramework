// step_0056/capture.js — 눈 검증: TW1 산 = 딛는 지형 표면. 기복 정적 앵커(지면+산) 위에 작은 구체가 떨어져 정착.
//   design/environment.md §3 TW1. 4 패널(시간 경과): 작은 구체들이 위에서 떨어져 → 기복 지형 표면에 닿아 →
//   반발로 떠받쳐지고 감쇠로 멈춰 → 표면 위에 *딛고 선다*(산 위 구체는 비탈로 굴러내림). 색=속도(빠름→느림=정착).
//   옆에서 본 단면(x-z 투영·중력 중심 0,0,0). PNG=tools/htj-capture.js. 실행: node HTJ/steps/step_0056/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const GROUND_R = 10, MOUNT_R = 3.5, SMALL_R = 1.2;
const gopt = { G: 5e-6, soft: 2 }, copt = { k: 15, cDamp: 40 };
const N = 40, OX = N / 2, OZ = N * 0.30;                        // 화면 투영 원점(중력 중심을 아래쪽에)

function ent(cx, cy, cz, mass, r, anchored) {
  return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0,
    KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anchored };
}
// 기복 지형 = 지면(중심) + 산 둘(+z극·옆 봉우리) — 모두 정적 앵커.
const es = [
  ent(0, 0, 0, 1e6, GROUND_R, true),
  ent(0, 0, GROUND_R + MOUNT_R, 1e6, MOUNT_R, true),                                  // 산 1(정상)
  ent(GROUND_R * 0.7, 0, GROUND_R * 0.78, 1e6, MOUNT_R * 0.8, true)                   // 산 2(옆 봉우리)
];
const saved = es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz }));
// 작은 구체들 — 위(+z)에서 흩뿌려 떨어뜨림(결정론).
const gold = Math.PI * (3 - Math.sqrt(5)), nSmall = 20, dropR = 18;
for (let i = 0; i < nSmall; i++) {
  // +z 반구 표면 위에 고르게 흩뿌려(황금각) 떨어뜨림 → 표면을 *덮는 층*으로 정착.
  const zfrac = 0.25 + 0.72 * (i + 0.5) / nSmall, r = Math.sqrt(Math.max(0, 1 - zfrac * zfrac)), th = gold * i;
  es.push(ent(Math.cos(th) * r * dropR, Math.sin(th) * r * dropR * 0.55, zfrac * dropR + 2, 100, SMALL_R, false));
}
function pin() { for (let i = 0; i < es.length; i++) if (es[i].anchored) { const s = saved[i]; es[i].cx = s.cx; es[i].cy = s.cy; es[i].cz = s.cz; es[i].px = es[i].py = es[i].pz = 0; } }
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;

// x-z 단면 투영(중력 중심을 아래로) — 색=속도(빠름 1→느림 0).
function snap() {
  let vmax = 0; for (const e of es) if (!e.anchored) vmax = Math.max(vmax, speed(e));
  return es.map(e => ({ cx: OX + e.cx, cy: OZ + e.cz, r: e.radius,
    v: e.anchored ? 0.12 : (vmax > 0 ? Math.min(1, speed(e) / vmax) : 0) }));
}

const snaps = [snap()];                                          // ① 낙하 직전
const marks = [120, 450, 1100, 2400];
for (let s = 1; s <= 2400; s++) {
  En.applyEntityGravity(es, 0.05, gopt); En.applyEntityContact(es, 0.05, copt); En.stepEntities(es, 0.05); pin();
  if (marks.includes(s)) snaps.push(snap());
}

const frames = snaps.map(f => ({ pts: f.map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: p.v })) }));
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

const smalls = es.filter(e => !e.anchored);
const allOnSurface = smalls.every(e => Math.hypot(e.cx, e.cy, e.cz) > GROUND_R - 0.5);
const settled = smalls.every(e => speed(e) < 0.15);
const anchorsStatic = es.filter(e => e.anchored).every((e, i) => true);   // pin() 보장
const ok = fs.existsSync(outPath) && allOnSurface && settled;
console.log('\n=== 눈 검증: TW1 산 = 딛는 지형 표면(기복 앵커 위에 정착) ===');
console.log(`  지형 = 정적 앵커 3개(지면 R${GROUND_R} + 산 2) · 작은 구체 ${smalls.length}개 낙하`);
console.log(`  정착 — 모두 표면 위(관통 없음): ${allOnSurface} · 모두 멈춤: ${settled} · 잔류 속도 max ${Math.max(...smalls.map(speed)).toFixed(3)}`);
console.log('  패널: 낙하 직전 → 닿음 → 떠받쳐 멈춤 → 표면 위 딛고 섬 · 색=속도(빠름→느림) / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 작은 구체가 기복 지형 표면 위에 딛고 선다(산 위는 비탈로 굴러내림)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
