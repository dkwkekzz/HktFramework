// step_0118/verify.js — (조립) 발밑 바이옴 + DNA 형태 바위: 환경이 발밑에서 행위성과 만난다.
//   새 물리 0(biomeField 0090·reconstructShape 0063·보행 부품은 부품 verify 가 보증). 여기선 *새 결합*만:
//   발밑 바이옴 샘플·캐릭터가 DNA 형태 footprint 에 막힘. 순수·독립·영구. node HTJ/steps/step_0118/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Ctl = require(path.resolve(__dirname, '../../engine/htj-control.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, G = 4, FX = 8;
const COPT = { k: 60, cDamp: 8 }, FOPT = { k: 60, mu: 8.0, cTan: 14 }, ROPT = { k: 60, muRoll: 4.0, cRoll: 8 };
const biome = Stream.biomeField({ scale: 0.09, nTemp: 3, nHum: 3, tempSalt: 'BT', humSalt: 'BH' });
const biomeAt = (x) => biome(x, 0).biome;

// DNA 형태 바위 — 세계 형태 사전에 등록(0062)된 hash 로 reconstructShape(0063) 비구형 footprint.
function makeRock() {
  const dict = {};
  const members = [{ cx: 0, cy: 0, cz: 0, radius: 1 }, { cx: 1.4, cy: 0, cz: 0, radius: 1 }, { cx: 0.7, cy: 1.3, cz: 0, radius: 1 }, { cx: -0.6, cy: 0.9, cz: 0, radius: 1 }];
  const hash = DNA.registerShape(dict, members, { quantum: 0.25 });
  const rock = { cx: 38, cy: -0.4, cz: 0, radius: 2.4, shapeHash: hash };
  const pts = DNA.reconstructShape(rock, dict, { quantum: 0.25, spread: 1.5, subScale: 1.5 });
  return { dict, hash, rock, pts };
}
function walk(steps) {
  const an = [];
  for (let x = -4; x <= 60; x++) an.push({ cx: x, cy: -3, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 3 });
  const { pts } = makeRock();
  const rockAn = pts.map(p => ({ cx: p.cx, cy: p.cy, cz: 0, mass: 1e9, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: p.r }));
  const allAn = [...an, ...rockAn];
  const ch = { cx: 10, cy: 1.2, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  const zero = () => { for (const a of allAn) { a.px = a.py = a.pz = a.Lx = a.Ly = a.Lz = 0; } };
  const biomeSeen = new Set();
  for (let s = 0; s < steps; s++) {
    ch.py -= ch.mass * G * DT; En.applyEntityContact([ch, ...allAn], DT, COPT);
    if (s >= 40) Ctl.applyControl([ch], DT, { commands: [{ i: 0, fx: FX }] });
    En.applyEntityFriction([ch, ...allAn], DT, FOPT); En.applyEntityRollingResistance([ch, ...allAn], DT, ROPT);
    zero(); En.stepEntity(ch, DT);
    if (s >= 40) biomeSeen.add(biomeAt(Math.round(ch.cx)));
  }
  return { ch, pts, biomeSeen };
}

const R = walk(1100);

// ① 발밑 바이옴 — 캐릭터가 걸으며 발밑 바이옴이 여러 종 바뀜·발밑 값이 biomeField 샘플과 일치(별도 author 아님).
(() => {
  const here = biomeAt(Math.round(R.ch.cx));                    // 멈춘 곳 발밑 바이옴
  ok(R.biomeSeen.size >= 3 && here === biome(Math.round(R.ch.cx), 0).biome,
    `발밑 바이옴 — 걸으며 ${R.biomeSeen.size}종 바이옴 가로지름(≥3)·발밑 값 ${here}=biomeField 샘플(별도 author 아님)`);
})();

// ② 바이옴 경계 — 경로에 뚜렷한 바이옴 띠 경계 존재(인접 x 에서 바이옴이 바뀌는 지점).
(() => {
  let boundaries = 0; for (let x = 10; x < 38; x++) if (biomeAt(x) !== biomeAt(x + 1)) boundaries++;
  ok(boundaries >= 2, `바이옴 경계 — 경로 x[10,38]에 바이옴 경계 ${boundaries}개(≥2·기후 띠 가로지름)`);
})();

// ③ DNA footprint — 바위가 여러 구성원 구(비구형)·캐릭터가 *실제 구성원*에 막힘(바운딩 구 반경 아님).
(() => {
  const leftMember = Math.min(...R.pts.map(p => p.cx));         // 가장 왼쪽 구성원 x
  const rockCenter = 38, boundingLeft = rockCenter - 2.4;       // 바운딩 구 왼쪽 끝
  // 캐릭터가 구성원 footprint(왼쪽 구성원)에 막혀 *바운딩 구보다 더 왼쪽*에서 정지.
  const blocked = R.ch.cx < leftMember && R.ch.cx < rockCenter - 3;
  ok(R.pts.length >= 4 && leftMember < boundingLeft + 0.5 && blocked,
    `DNA footprint — 바위 ${R.pts.length} 구성원(비구형)·왼쪽 구성원 x ${leftMember.toFixed(1)}·캐릭터 ${R.ch.cx.toFixed(1)}서 막힘(실제 형태 윤곽·바운딩 구 아님)`);
})();

// ④ 형태=세계 DNA — 바위 형태가 등록 hash(사전 dedup)서 온다(author 아님).
(() => {
  const { dict, hash } = makeRock();
  ok(dict[hash] && dict[hash].points && dict[hash].points.length >= 4,
    `형태=세계 DNA — 바위 형태가 등록 hash ${hash}(사전 ${Object.keys(dict).length}개·dedup canonical ${dict[hash].points.length}점)서 옴`);
})();

// ⑤ 결정론.
show(L.deterministic('같은 입력 → 같은 보행·바위', () => { const r = walk(400); return [Math.round(r.ch.cx * 1e4), r.biomeSeen.size]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
