// verify-sim-engine.js — 골든 회귀 앵커. 모든 장면×시드의 *최종 상태 해시*를
// golden-sim.json 과 대조한다. 드리프트(의도치 않은 결과 변화)를 즉시 잡는다.
//   node engine/validate/verify-sim-engine.js            # 대조
//   node engine/validate/verify-sim-engine.js --update   # 골든 생성/갱신(새 장면 가법)
'use strict';
const fs = require('fs');
const path = require('path');
const K = require('../hgo-kernel.js');
const S = require('../hgo-sim.js');
const { SCENES } = require('../scenes.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const GOLDEN = path.join(__dirname, 'golden-sim.json');

function finalHash(scene, seed) {
  const sim = S.createSim(scene.init(K.mulberry32(seed), K));
  S.run(sim, scene.ticks);
  return K.hashState(sim);
}

function current() {
  const out = {};
  for (const id of Object.keys(SCENES)) { out[id] = {}; for (const s of SEEDS) out[id][s] = finalHash(SCENES[id], s); }
  return out;
}

function main() {
  const update = process.argv.includes('--update');
  const cur = current();
  let golden = {};
  if (fs.existsSync(GOLDEN)) golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

  if (update) {
    // 진짜 가법: *미존재 시에만* 채운다. 기존 앵커는 절대 덮어쓰지 않는다(회귀 0 불변).
    // 기존과 다르면 경고만 — 의도된 변경이면 해당 항목을 골든에서 수동 삭제 후 재실행.
    let added = 0, kept = 0;
    for (const id of Object.keys(cur)) {
      golden[id] = golden[id] || {};
      for (const s of SEEDS) {
        if (golden[id][s] === undefined) { golden[id][s] = cur[id][s]; added++; }
        else if (golden[id][s] !== cur[id][s]) console.warn(`  ! ${id}/${s}: 기존 앵커 ${golden[id][s]} ≠ 현재 ${cur[id][s]} — 보존(덮어쓰지 않음).`);
        else kept++;
      }
    }
    fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 2) + '\n');
    console.log(`골든 갱신: +${added} 추가 · ${kept} 보존 (${GOLDEN})`);
    return;
  }

  let fail = 0, n = 0;
  for (const id of Object.keys(cur)) {
    for (const s of SEEDS) {
      n++;
      const want = golden[id] && golden[id][s];
      if (want === undefined) { console.log(`  ? ${id}/${s}: 골든 없음 (--update 필요)`); fail++; continue; }
      if (want !== cur[id][s]) { console.log(`  ✗ ${id}/${s}: ${cur[id][s]} ≠ 골든 ${want}`); fail++; }
    }
  }
  console.log(`\n골든 대조: ${n - fail}/${n} 일치  ${fail === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
