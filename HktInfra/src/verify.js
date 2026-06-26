// HktInfra step-0306 — 헤드리스 검증 (#9 잔여: 실 host.js 물리 분리 6 — host inbox stale 거부)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zonehoststale`.
//   더한 한 조각: _tickRuntimes host drain 시 그 host 가 더는 소유 안 하는 존의 frame 을 거부(zoneHostStale++·drained 미증가·이중 쓰기 방지). OFF→0305 비트 동일(reg).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `zonehoststale`(가설) — 같은 tick 존 frame+이주 → 떠난 host 가 frame 거부(stale 1)·이주된 host 에서 entity 보존·recv==drained+stale.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0306 #9 잔여 검증 — host inbox 가 *떠난 존*의 frame 을 거부한다(실 프로세스 이중 쓰기 방지).
//   격리 시나리오: z1·z2 둘 다 hostA(컨테이너 생존 보장)·a1 enter z1. tick 10 에 같은 tick 으로 z1 move frame(hostA inbox enqueue)+z1 migrate hostA→hostB.
//   → hostA drain 시 z1 ∉ hostA(이주됨) → frame 거부(zoneHostStale 1)·move 미적용·a1 은 z1(이제 hostB)에 보존(total 1)·recv==drained+stale.
function zonehoststale(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const PLACEOPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostA')];
  const ENTOPS = [ENTER(5, 'z1', 'a1')];
  const PROBE = [{ at: 10, zoneId: 'z1', avatar: 'a1', host: 'hostA', toHost: 'hostB', dx: 2, dy: 1 }];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, placementOps: PLACEOPS, entityOps: ENTOPS, zoneHostStaleProbe: PROBE };
  console.log('== zonehoststale (0306·#9 잔여 6): host inbox stale 거부. 같은 tick z1 move frame+z1 migrate(A→B) → hostA drain 시 떠난 z1 frame 거부(stale1)·a1 z1(@B) 보존·recv==drained+stale. ==');
  console.log('seed   | stale | recv | drained | r==d+s | z1@   | total | a1@z1 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 16, ...BASE });
    const o = r.orch;
    const rds = o.zoneHostFramesRecv === o.zoneHostDrained + o.zoneHostStale;
    const z1host = o.zoneHostOf('z1');
    const a1in = o.zoneHasEntity('z1', 'a1');
    const ok = check(o.zoneHostStale === 1 && rds && z1host === 'hostB' && o.totalEntities() === 1 && a1in &&
      o.zoneHostSingleOwner() && o.zoneHostDrift() === 0,
      `seed ${seed}: host stale 거부 위반 (stale ${o.zoneHostStale}·recv ${o.zoneHostFramesRecv}·drained ${o.zoneHostDrained}·z1@ ${z1host}·total ${o.totalEntities()}·a1 ${a1in})`);
    console.log(`${pad(seed, 6)} | ${pad(o.zoneHostStale, 5)} | ${pad(o.zoneHostFramesRecv, 4)} | ${pad(o.zoneHostDrained, 7)} | ${pad(rds ? 'Y' : 'N', 6)} | ${pad(z1host, 5)} | ${pad(o.totalEntities(), 5)} | ${pad(a1in ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zonehoststale'] = zonehoststale;
kit.ORDER.splice(1, 0, 'zonehoststale');

(async () => { process.exit(await kit.cli(process.argv)); })();
