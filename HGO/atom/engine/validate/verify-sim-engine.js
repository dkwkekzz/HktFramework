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
    golden = Object.assign(golden, cur); // 가법: 기존 장면 해시 보존, 새 장면 추가
    fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 2) + '\n');
    console.log(`골든 갱신: ${GOLDEN} (장면 ${Object.keys(cur).join(', ')})`);
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
