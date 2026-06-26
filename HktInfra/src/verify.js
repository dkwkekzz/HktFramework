// HktInfra step-0320 — 헤드리스 검증 (#9 후속: host 산출 뷰의 AOI 정확성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzoneaoi`.
//   더한 한 조각: 질의 zoneViewBuf(산출 뷰 원본)·zoneVisibleIds(반경 AOI 가시 집합). host 가 산출한 view 의 enter == 진짜 AOI(가까운 것만·먼 것 제외)인지 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzoneaoi`(가설) — a1(5,5)·a2(13,15)는 반경 4 밖 → 서로 안 보임: 각 세션 reset 뷰 enter == 자기만(zoneVisibleIds 일치).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0320 #9 후속 검증 — host 산출 뷰의 AOI 정확성(zoneViewBuf vs zoneVisibleIds). z1 의 결정론 위치(존 시드 고정): a1(5,5)·a2(13,15)·Chebyshev 거리 10 > 반경 4 → 서로 AOI 밖.
//   각 세션의 reset view_delta enter id 집합이 zoneVisibleIds(자기만 보임)와 정확히 일치 — host 가 산출한 다운스트림 뷰가 진짜 반경 AOI(가까운 것만·먼 것 제외)임을 단언. 게이트웨이 주소로 발신.
function hostzoneaoi(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzoneaoi (0320·#9 후속): host 산출 뷰의 AOI 정확성. a1·a2 가 반경 밖 → 각 세션 reset 뷰 enter == zoneVisibleIds(자기만)·게이트웨이 발신. ==');
  console.log('seed   | a1see | a2see | match | toGW | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const buf = o.zoneViewBuf('z1');
    const enterOf = (sid) => { const f = buf.find(s => s.payload.type === 'view_delta' && s.payload.sessionId === sid && s.payload.reset); return f ? f.payload.enter.map(e => e.id).sort() : null; };
    const a1see = enterOf('s:a1'), a2see = enterOf('s:a2');
    const vis1 = o.zoneVisibleIds('z1', 'a1'), vis2 = o.zoneVisibleIds('z1', 'a2');
    const match = a1see && a2see && a1see.join(',') === vis1.join(',') && a2see.join(',') === vis2.join(',');
    const toGW = buf.length > 0 && buf.every(s => s.to === 'gateway');
    const ok = check(match && toGW && a1see.join(',') === 'a1' && a2see.join(',') === 'a2',
      `seed ${seed}: AOI 정확성 위반 (a1see ${a1see}·vis1 ${vis1}·a2see ${a2see}·vis2 ${vis2}·toGW ${toGW})`);
    console.log(`${pad(seed, 6)} | ${pad((a1see || []).join('|'), 5)} | ${pad((a2see || []).join('|'), 5)} | ${pad(match ? 'Y' : 'N', 5)} | ${pad(toGW ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzoneaoi'] = hostzoneaoi;
kit.ORDER.splice(1, 0, 'hostzoneaoi');

(async () => { process.exit(await kit.cli(process.argv)); })();
