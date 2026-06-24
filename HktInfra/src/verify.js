// HktInfra step-0230 — 헤드리스 검증 (로그인 큐 이탈·loginAbandon·3차 균형 라운드 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `loginabandon`.
//   더한 한 조각: loginAbandon{player} → 입장 전 대기열서 제거(abandoned·기다리다 포기). 큐에 없으면 멱등 no-op(abandonMisses). 미주입 → 0229 비트 동일(reg). 3차 고도화 로그인 #2·균형 라운드 닫기.
//   검증: ⒜ `reg`(키트). ⒝ `loginabandon`(가설) — p1·p2·p3 enqueue → p2 이탈 → 큐 [p1,p3]·미줄 pX 이탈 miss.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const ENQ = (at, player) => ({ at, op: { type: 'loginEnqueue', player } });
const ABANDON = (at, player) => ({ at, op: { type: 'loginAbandon', player } });
// p1·p2·p3 줄 세움 → p2 이탈(큐 [p1,p3]) → 미줄 pX 이탈(miss).
const OPS = [
  ENQ(1, 'p1'), ENQ(2, 'p2'), ENQ(3, 'p3'),
  ABANDON(4, 'p2'),
  ABANDON(5, 'pX'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };

function loginabandon(seeds) {
  console.log('== loginabandon: 로그인 큐 이탈(loginAbandon) — 입장 전 player 가 줄을 떠난다(대기열서 제거·기다리다 포기). 큐에 없는(이미 입장/미줄) player 는 멱등 no-op. 좀비 대기 슬롯을 비워 큐 길이를 사실대로 유지(0219 백프레셔 정확도↑). 3차 고도화 로그인 #2·균형 라운드 0221~0230 닫기. ==');
  console.log('seed   | 큐 | p2 pos | p3 pos | aband | miss | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    // p2 이탈 → 큐 [p1,p3](길이 2)·p2 없음(pos -1)·p3 한 칸 당겨짐(pos 1)·abandoned 1·미줄 pX miss 1.
    const ok = check(q.queueLength() === 2 && q.positionOf('p2') === -1 && q.positionOf('p1') === 0 && q.positionOf('p3') === 1 && q.abandoned === 1 && q.abandonMisses === 1,
      `seed ${seed}: 이탈 위반 (큐 ${q.queueLength()}·p2 ${q.positionOf('p2')}·aband ${q.abandoned}·miss ${q.abandonMisses})`);
    console.log(`${pad(seed, 6)} | ${pad(q.queueLength(), 2)} | ${pad(q.positionOf('p2'), 6)} | ${pad(q.positionOf('p3'), 6)} | ${pad(q.abandoned, 5)} | ${pad(q.abandonMisses, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 줄 선 p2 가 기다리다 떠나면 대기열서 빠지고(큐 [p1,p3]·abandoned 1) 뒤의 p3 가 한 칸 당겨진다(pos 1). 미줄 pX 이탈은 멱등 no-op(abandonMisses 1). 좀비 슬롯이 안 남아 큐 길이가 사실대로 유지(0219 백프레셔 정확도). 로그인 3차 고도화 #2 — 5박스 3차 균형 라운드(0221~0230) 닫기.');
}

kit.MODES['loginabandon'] = loginabandon;
kit.ORDER.splice(1, 0, 'loginabandon');

(async () => { process.exit(await kit.cli(process.argv)); })();
