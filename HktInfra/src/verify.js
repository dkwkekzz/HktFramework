// HktInfra step-0350 — 헤드리스 검증 (#9 후속 grand capstone: 월드 다운스트림 E2E 전 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `worldcap`.
//   더한 한 조각: 월드 다운스트림 전 정합 술어 downstreamWorldCoherent(모든 존 downstreamCoherent[포착 0330] && downstreamSettled[전파 0341]). grand capstone = host AOI 포착 + 신뢰 전파 + 실 클라 수렴(desync 0)이 한 시나리오에서 모두 성립 — SPINE §4 경로2 월드 다운스트림 host→게이트웨이→실 클라 E2E 완결.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `worldcap` — 2존·3클라·손실·migrate·late-join 뒤 downstreamWorldCoherent && 모든 클라 convergedTo && 게이트웨이 isolated. 월드 다운스트림 데이터 평면(0319~0350) 닫기.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0350 #9 후속 grand capstone — 월드 다운스트림 E2E. z1@A(a1@dc0·a2@dc1)·z2@C(b1@dc2)·a1 이동·z1 A→B migrate·s:a1#2 손실·a2 는 중도 입장.
//   뒤: orch.downstreamWorldCoherent(포착+전파 정착)·dc0·dc1·dc2 모두 convergedTo(host 권위 desync 0)·게이트웨이 isolated. SPINE §4 경로2 월드 다운스트림(0319~0350) 닫기.
function worldcap(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const MIG = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
  const OPS = [PLACE(1, 'z1', 'hostA'), PLACE(2, 'z2', 'hostC'), MIG(18, 'z1', 'hostB')];
  const ENT = [ENTER(3, 'z1', 'a1', 'dc0'), ENTER(5, 'z2', 'b1', 'dc2')];
  for (let k = 0; k < 8; k++) ENT.push(MOVE(6 + k, 'z1', 'a1', 1, 1, 'dc0'));   // a1 (5,5)→(13,13).
  ENT.push(ENTER(15, 'z1', 'a2', 'dc1'));   // a2 중도 입장(13,15)·a1 반경 안(late-join).
  ENT.push(MOVE(16, 'z2', 'b1', 1, 0, 'dc2'));
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 3, egressDrop: ['s:a1#2'], egressTimeout: 4 };
  console.log('== worldcap (0350·#9 후속 grand capstone): 월드 다운스트림 E2E. worldCoherent·dc0·dc1·dc2 수렴·iso. 0319~0350 닫기. ==');
  console.log('seed   | world | dc0 | dc1 | dc2 | iso | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 30, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway;
    const world = o.downstreamWorldCoherent();
    const c0 = r.downclients[0].convergedTo(o.zoneAuthSig('z1', 'a1'));
    const c1 = r.downclients[1].convergedTo(o.zoneAuthSig('z1', 'a2'));
    const c2 = r.downclients[2].convergedTo(o.zoneAuthSig('z2', 'b1'));
    const iso = g.gatewayDeliveryIsolated();
    const ok = check(world && c0 && c1 && c2 && iso, `seed ${seed}: world ${world} c ${c0}/${c1}/${c2} iso ${iso}`);
    console.log(`${pad(seed, 6)} | ${pad(world ? 'Y' : 'N', 5)} | ${pad(c0 ? 'Y' : 'N', 3)} | ${pad(c1 ? 'Y' : 'N', 3)} | ${pad(c2 ? 'Y' : 'N', 3)} | ${pad(iso ? 'Y' : 'N', 3)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['worldcap'] = worldcap;
kit.ORDER.splice(1, 0, 'worldcap');

(async () => { process.exit(await kit.cli(process.argv)); })();
