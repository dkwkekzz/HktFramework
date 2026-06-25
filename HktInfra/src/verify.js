// HktInfra step-0263 — 헤드리스 검증 (정리 #49 wiring: topo-build 서비스 박스 add 시퀀스 분리·topo-boxes.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `boxsplit`.
//   더한 한 조각: buildTopology() 의 서비스/데이터 박스 add() 시퀀스(gateway·bus·persist·inventory·chat·audit·presence·ranking·exchange·mail·guild·instance·cache·worldlog·loginqueue 등)를 topo-boxes.js(addServiceBoxes)로 verbatim 분리. ctx(destructure/derive 결과)만 주입·기능 0 → 0262 비트 동일(reg). topo-build.js 31.5KB→14.4KB(<30KB).
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `boxsplit`(가설) — 멀티 서비스 토폴로지의 모든 박스가 spec order 에 존재.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { buildTopology } = NET;

// step-0263 정리 분할(#49 wiring) 검증 — buildTopology 의 서비스/데이터 박스 add 시퀀스를 topo-boxes.addServiceBoxes 로 위임한 뒤,
//   멀티 서비스 토폴로지가 여전히 모든 박스를 spec order 에 채우는지 본다(위임 무결). reg 0 가 비트 동일을 별도 증명.
function boxsplit(seeds) {
  const OPTS = { clients: 6, zones: 2, failover: true, bus: true, inventory: true, chat: true, audit: true, ranking: true, exchange: true, mail: true, guildService: true, instanceService: true, cacheService: true, worldLog: true, loginQueue: true };
  const WANT = ['gateway', 'bus', 'inventory', 'chat', 'audit', 'ranking', 'exchange', 'mail', 'guild', 'instance', 'cache', 'worldlog', 'loginqueue'];
  console.log('== boxsplit (0263 분할·#49): 서비스/데이터 박스 add 시퀀스를 topo-boxes.addServiceBoxes 로 위임 — 멀티 서비스 토폴로지의 모든 박스가 spec order 에 존재(위임 무결)·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | boxes present | 판정');
  for (const seed of seeds) {
    const topo = buildTopology({ ...OPTS, seed });
    const order = new Set(topo.order);
    const missing = WANT.filter(a => !order.has(a));
    const ok = check(missing.length === 0, `seed ${seed}: 누락 박스 [${missing.join(',')}]`);
    console.log(`${pad(seed, 6)} | ${pad((WANT.length - missing.length) + '/' + WANT.length, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['boxsplit'] = boxsplit;
kit.ORDER.splice(1, 0, 'boxsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
