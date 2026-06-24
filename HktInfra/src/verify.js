// HktInfra step-0209 — 헤드리스 검증 (로그인 큐 박스·enqueue/dequeue·loginQueue)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `loginqueue`.
//   더한 한 조각: LoginQueue 박스 — 대기열 FIFO(enqueue·중복 멱등) + 입장 티켓 발급(dequeue·먼저 줄 선 순서). 접속 폭주를 엣지서 흡수(0001 스텁의 대기열 실체화). loginQueue OFF → 0208 비트 동일(reg). 만료는 0210.
//   검증: ⒜ `reg`(키트). ⒝ `loginqueue`(가설) — enqueue 4(p1·p2·p3·p1 중복) + dequeue 1 → 큐 2·admitted 1·p1 tkt-1·p2 pos 0.
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
// 시나리오: p1·p2·p3 줄서기 + p1 중복(멱등) → dequeue 1(p1 입장·FIFO).
const OPS = [
  ENQ(2, 'p1'), ENQ(3, 'p2'), ENQ(4, 'p3'), ENQ(5, 'p1'),   // p1 중복 → 멱등 no-op.
  DEQ(6),   // 맨 앞 p1 입장 → tkt-1.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };

function loginqueue(seeds) {
  console.log('== loginqueue: 로그인 큐 박스 — enqueue/dequeue 기본. 접속 폭주를 엣지서 대기열로 흡수(FIFO·중복 멱등)하고 순서대로 세션 티켓 발급. 대기열은 엣지서 끝난다(월드 안 닿음). ==');
  console.log('seed   | 큐 길이 | admitted | p1 ticket | p2 pos | enq/deq | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    const ok = check(q.queueLength() === 2 && q.admittedCount() === 1 && q.ticketOf('p1') === 'tkt-1' &&
      q.positionOf('p2') === 0 && q.enqueues === 4 && q.dequeues === 1,
      `seed ${seed}: 큐 위반 (len ${q.queueLength()}·admit ${q.admittedCount()}·p1 ${q.ticketOf('p1')})`);
    console.log(`${pad(seed, 6)} | ${pad(q.queueLength(), 7)} | ${pad(q.admittedCount(), 8)} | ${pad(q.ticketOf('p1') || '-', 9)} | ${pad(q.positionOf('p2'), 6)} | ${pad(q.enqueues + '/' + q.dequeues, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → LoginQueue 가 접속을 엣지서 줄세우고(enqueue 4·p1 중복 멱등 → 큐 [p1,p2,p3]) 순서대로 입장 티켓 발급(dequeue → p1 입장·tkt-1·큐 [p2,p3]). 폭주가 월드에 안 닿는다(대기열은 엣지서 끝남·0001 스텁의 대기열 실체화). 기본 통신 — 티켓 만료는 0210.');
}

kit.MODES['loginqueue'] = loginqueue;
kit.ORDER.splice(1, 0, 'loginqueue');

(async () => { process.exit(await kit.cli(process.argv)); })();
