// HktInfra step-0323 — 헤드리스 검증 (정리 분할: 다운스트림 뷰 질의 → orch-views.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `zoneviewsplit`.
//   더한 한 조각: orch-zonebridge.js(30.6KB>30KB) 의 뷰 질의 6종(0319~0322)을 orch-views.js 믹스인으로 분리(Object.assign 투명 분할·기능 0·reg 0). 기능 추가 없음.
//   검증: ⒜ `reg`(키트·OFF 비트 동일 — 분할이 동작 불변). ⒝ `zoneviewsplit`(스모크) — 옮긴 6 질의가 분할 후에도 정확히 해소·동작.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0323 정리 분할 스모크 — 뷰 질의 6종(zoneViewBuf·zoneViewEntered·zoneViewStats·zoneVisibleIds·zoneViewsFor·zoneViewFrames)이 orch-views.js 로 옮겨진 뒤에도
//   Orchestrator.prototype 에 Object.assign 되어 this 로 정확히 해소·동작함을 한 시나리오(z1·a1 이동·a2)로 확인. 분할은 *위치만* 옮긴 것이므로 reg 비트 동일이 본 증거.
function zoneviewsplit(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(7, 'z1', 'a1', 1, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== zoneviewsplit (0323 정리 분할): 뷰 질의 6종 → orch-views.js. 분할 후에도 해소·동작(reg 비트 동일이 본 증거). ==');
  console.log('seed   | frames | buf | stats(r/u) | vis | entered | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const vf = o.zoneViewFrames(), buf = o.zoneViewBuf('z1').length, st = o.zoneViewStats('z1', 's:a1');
    const vis = o.zoneVisibleIds('z1', 'a1'), ent = o.zoneViewEntered('z1', 's:a1'), vfor = o.zoneViewsFor('z1');
    const ok = check(vf > 0 && vf === vfor && buf >= vf && st.resets === 1 && st.updates >= 1 && vis.includes('a1') && ent.includes('a1'),
      `seed ${seed}: 분할 스모크 위반 (frames ${vf}·buf ${buf}·stats ${st.resets}/${st.updates}·vis ${vis}·entered ${ent})`);
    console.log(`${pad(seed, 6)} | ${pad(vf, 6)} | ${pad(buf, 3)} | ${pad(st.resets + '/' + st.updates, 10)} | ${pad(vis.join('|'), 3)} | ${pad(ent.join('|'), 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['zoneviewsplit'] = zoneviewsplit;
kit.ORDER.splice(1, 0, 'zoneviewsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
