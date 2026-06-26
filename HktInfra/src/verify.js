// HktInfra step-0344 — 헤드리스 검증 (#9 후속: 손실 하 다운스트림 클라 수렴 — 재전송 후 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcloss`.
//   더한 한 조각(통합 검증·src 무변경): 전 신뢰 스택(0337 gap-resync + 0338 타임아웃 재전송 + 게이트웨이 인오더 게이팅) 위에서 실 DownClient(0342)가 *손실에도* host 권위 AOI 로 수렴함을 단언.
//   검증: ⒜ `reg`(키트·src==baseline 비트 동일). ⒝ `dcloss` — s:a1#2 손실에도 재전송 복구 후 dc0.seenSig == zoneAuthSig('z1','a1')(desync 0)·resync>0·dropped 1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0344 #9 후속 — 손실 하 수렴. a1@dc0 4회 이동(dseq 0..4) 중 s:a1#2 손실 → 게이트웨이 gap-resync/타임아웃 재전송 복구 → 게이트웨이 인오더 게이팅 → DownClient 가 클린 인오더 스트림 적용.
//   복구 후 dc0.seenSig == zoneAuthSig('z1','a1')(host 권위 == 클라 뷰·desync 0)·resync>0(복구 발화)·dropped 1.
function dcloss(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0'), MOVE(4, 'z1', 'a1', 1, 1, 'dc0'), MOVE(5, 'z1', 'a1', 1, 0, 'dc0'), MOVE(6, 'z1', 'a1', 0, 1, 'dc0'), MOVE(7, 'z1', 'a1', 1, 1, 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2, egressDrop: ['s:a1#2'], egressTimeout: 4 };
  console.log('== dcloss (0344·#9 후속): 손실(s:a1#2) 하 수렴. 재전송 복구 후 dc0.seenSig == zoneAuthSig(desync 0)·resync>0·drop1. ==');
  console.log('seed   | drop | resync | match | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 24, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch, g = r.gateway, dc0 = r.downclients[0];
    const drop = o.zoneEgressDropped, resync = g.gatewayResyncsSent();
    const match = dc0.seenSig() === o.zoneAuthSig('z1', 'a1') && dc0.seenIds().length > 0;
    const ok = check(drop === 1 && resync > 0 && match, `seed ${seed}: drop ${drop} resync ${resync} dc0 [${dc0.seenSig()}] auth [${o.zoneAuthSig('z1', 'a1')}]`);
    console.log(`${pad(seed, 6)} | ${pad(drop, 4)} | ${pad(resync, 6)} | ${pad(match ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcloss'] = dcloss;
kit.ORDER.splice(1, 0, 'dcloss');

(async () => { process.exit(await kit.cli(process.argv)); })();
