// HktInfra step-0261 — 헤드리스 검증 (정리 #49 wiring: topo-run 주입열 분리·topo-inject.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `injsplit`.
//   더한 한 조각: run() 의 per-tick 제어 평면 메시지 주입열(rankDie/rankStall/producerInject/presenceFailover/whispers~loginOps/inject)을 topo-inject.js(applyInjections)로 verbatim 분리. ctx 핸들만 주입·기능 0 → 0260 비트 동일(reg). topo-run.js 35.9KB→22.7KB(<30KB).
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `injsplit`(가설) — 옮긴 핸들러(instanceOps·cacheOps)가 정규 박스에 도달(active 2·cache k1/k2).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0261 정리 분할(#49 wiring) 검증 — run() 의 주입열을 topo-inject.applyInjections 로 위임한 뒤,
//   *옮긴 핸들러*가 정규 박스에 도달하는지 본다(투명 분할). instanceOps(인스턴스 spawn)·cacheOps(캐시 set)를
//   한 시나리오로 동시 구동 → 인스턴스 active 2·캐시 k1/k2 채워짐이면 주입 위임 무결(reg 0 가 비트 동일을 별도 증명).
function injsplit(seeds) {
  const ISPAWN = (at, instanceId, kind) => ({ at, op: { type: 'instanceSpawn', instanceId, kind } });
  const CSET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
  const IOPS = [ISPAWN(1, 'd1', 'dungeon'), ISPAWN(2, 'd2', 'dungeon')];
  const COPS = [CSET(1, 'k1', 'v1'), CSET(2, 'k2', 'v2')];
  const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, instanceService: true, instanceOps: IOPS, cacheService: true, cacheOps: COPS };
  console.log('== injsplit (0261 분할·#49): run() per-tick 주입열을 topo-inject.applyInjections 로 위임 — 옮긴 핸들러(instanceOps·cacheOps)가 정규 박스에 도달(active 2·cache k1/k2)·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | active | k1 | k2 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const inst = r.instance, cache = r.cache;
    const ok = check(inst.activeCount() === 2 && cache.get('k1') === 'v1' && cache.get('k2') === 'v2',
      `seed ${seed}: 주입 위임 위반 (active ${inst.activeCount()}·k1 ${cache.get('k1')}·k2 ${cache.get('k2')})`);
    console.log(`${pad(seed, 6)} | ${pad(inst.activeCount(), 6)} | ${pad(cache.get('k1') || '-', 3)} | ${pad(cache.get('k2') || '-', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['injsplit'] = injsplit;
kit.ORDER.splice(1, 0, 'injsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
