// HktInfra step-0219 — 헤드리스 검증 (로그인 큐 수용량 백프레셔·loginCapacity·동접 상한)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `logincapacity`.
//   더한 한 조각: loginCapacity{cap} → admitted 가 cap 도달이면 dequeue 가 입장 보류(player 큐 잔류·백프레셔·rejectedByCapacity). 월드 동접 상한을 엣지가 강제. 미주입 → capacity=∞ → 0218 비트 동일(reg). 2차 고도화 로그인 큐 #1.
//   검증: ⒜ `reg`(키트). ⒝ `logincapacity`(가설) — p1·p2·p3 enqueue → cap2 → dequeue×3: p1·p2 입장·p3 보류(큐 잔류).
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
const DEQ = (at) => ({ at, op: { type: 'loginDequeue' } });
const CAP = (at, cap) => ({ at, op: { type: 'loginCapacity', cap } });
// p1·p2·p3 줄섬 → cap2 → dequeue×3: p1·p2 입장(2)·p3 보류(큐 잔류·백프레셔).
const OPS = [
  ENQ(2, 'p1'), ENQ(3, 'p2'), ENQ(4, 'p3'),
  CAP(5, 2),
  DEQ(6), DEQ(7), DEQ(8),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };

function logincapacity(seeds) {
  console.log('== logincapacity: 로그인 큐 수용량 백프레셔(loginCapacity) — admitted 가 cap 도달이면 dequeue 가 입장 보류(player 큐 잔류). 월드 동접 상한을 엣지가 강제(폭주 시 줄이 늘되 월드는 cap 이상 안 받는다). 2차 고도화 로그인 큐 #1. ==');
  console.log('seed   | admitted | queueLen | rejected(백프레셔) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 9, ...BASE });
    const q = r.loginqueue;
    // cap2 → p1·p2 입장(admitted 2)·p3 보류(queueLength 1·rejectedByCapacity 1·dequeues 3).
    const ok = check(q.admittedCount() === 2 && q.queueLength() === 1 && q.rejectedByCapacity === 1 && q.positionOf('p3') === 0,
      `seed ${seed}: 수용량 위반 (admit ${q.admittedCount()}·queue ${q.queueLength()}·rejected ${q.rejectedByCapacity})`);
    console.log(`${pad(seed, 6)} | ${pad(q.admittedCount(), 8)} | ${pad(q.queueLength(), 8)} | ${pad(q.rejectedByCapacity, 18)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → cap2 에 도달하면 dequeue 가 입장을 보류(admitted 2 고정·p3 는 큐 맨 앞에 잔류·rejectedByCapacity 1). 폭주해도 월드 동접이 cap 이상 안 늘고 초과분은 엣지 큐에서 대기(백프레셔). 동접 상한·대기열 토대. 로그인 큐 2차 고도화 #1.');
}

kit.MODES['logincapacity'] = logincapacity;
kit.ORDER.splice(1, 0, 'logincapacity');

(async () => { process.exit(await kit.cli(process.argv)); })();
