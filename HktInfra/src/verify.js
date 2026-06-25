// HktInfra step-0266 — 헤드리스 검증 (정리 #49 인접·선제: svc-inventory-core 생성자 필드 초기화 믹스인 분리·svc-inventory-init.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `invsplit`.
//   더한 한 조각: InventoryService 의 생성자 필드 초기화(가방 원장·영속·quorum·버스·saga ~120 필드)를 _init(opts) 로 빼 svc-inventory-init.js 믹스인으로 분리(Object.assign prototype·생성자는 this._init(opts) 한 줄). 정의 위치만 이동·기능 0 → 0265 비트 동일(reg). svc-inventory-core.js 28.5KB→5.4KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `invsplit`(가설) — 생성 후 opts 필드 정확·원장/역인덱스 빈 Map·crash 후 재초기화 정합.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { InventoryService } = NET;

// step-0266 정리 분할(#49 인접) 검증 — 가방 생성자 필드 초기화를 svc-inventory-init 믹스인(_init)으로 위임한 뒤,
//   생성된 인스턴스의 opts 필드가 정확하고(원장/역인덱스 빈 Map) crash 가 재초기화를 정합 유지하는지 본다(투명 분할).
function invsplit(seeds) {
  console.log('== invsplit (0266 분할·#49 인접): 가방 생성자 필드 초기화(_init ~120 필드)를 svc-inventory-init 믹스인으로 위임 — 생성 후 opts 필드 정확·원장/역인덱스 빈 Map·crash 재초기화 정합·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | quorumW | reliable | ledger0 | crash정합 | 판정');
  for (const seed of seeds) {
    const inv = new InventoryService({ persist: 'persist', quorumW: 2, reliable: true, snapshot: 6 });
    const initOk = inv.quorumW === 2 && inv.reliable === true && inv.snapInterval === 6 && inv.persist === 'persist' &&
      inv.ledger instanceof Map && inv.ledger.size === 0 && inv.byOwner instanceof Map && inv.durableSeq === -1;
    inv.ledger.set('i1', 'a'); inv._own('a', 'i1');   // 더럽힌 뒤 crash 재초기화 확인
    inv.crash();
    const crashOk = inv.ledger.size === 0 && inv.itemCount() === 0 && inv.byOwner.size === 0;
    const ok = check(initOk && crashOk, `seed ${seed}: init/crash 위반 (qW ${inv.quorumW}·rel ${inv.reliable}·led ${inv.ledger.size})`);
    console.log(`${pad(seed, 6)} | ${pad(inv.quorumW, 7)} | ${pad(String(inv.reliable), 8)} | ${pad(String(initOk), 7)} | ${pad(String(crashOk), 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['invsplit'] = invsplit;
kit.ORDER.splice(1, 0, 'invsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
