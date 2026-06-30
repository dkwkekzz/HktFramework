// HktInfra step-0432 — 헤드리스 검증 (#4 진짜 비동기 2: send/recv 인과 규칙·clock condition)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `lcrecv`.
//   더한 한 조각: async-core.js — lamportExchange(N site send/recv FIFO 교환 결정론 스케줄→이벤트 로그+happens-before 간선)
//   + clockConditionViolations. clock condition: 모든 인과 간선 a→b 에서 C(a)<C(b). run() 미호출 → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `lcrecv` — 3 site 교환, 인과 간선 위반 0·간선≥1·결정론(같은 시드 같은 로그).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0432 #4 진짜 비동기 2 — lcrecv: send/recv 인과 규칙. 3 site Lamport 교환→clock condition 위반 0·send→recv 간선≥1·결정론.
function lcrecv(seeds) {
  console.log('== lcrecv (0432·#4): send/recv 인과 규칙 — 3 site 교환·clock condition(a→b⇒C(a)<C(b)) 위반 0 ==');
  console.log('seed   | 이벤트 | 간선 | recv | 위반 | 결정론 | 판정');
  for (const seed of seeds) {
    const a = NET.lamportExchange(seed, { sites: 3, rounds: 30 });
    const b = NET.lamportExchange(seed, { sites: 3, rounds: 30 });   // 재현(같은 시드→같은 로그)
    const viol = NET.clockConditionViolations(a.events, a.edges);
    const recvN = a.events.filter(e => e.kind === 'recv').length;
    const det = JSON.stringify(a.events) === JSON.stringify(b.events) && JSON.stringify(a.edges) === JSON.stringify(b.edges);
    const ok = check(viol === 0 && a.edges.length >= 1 && recvN >= 1 && det,
      `seed ${seed}: viol ${viol}·edges ${a.edges.length}·recv ${recvN}·det ${det}`);
    console.log(`${pad(seed, 6)} | ${pad(a.events.length, 6)} | ${pad(a.edges.length, 4)} | ${pad(recvN, 4)} | ${pad(viol, 4)} | ${pad(det ? 'Y' : 'N', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['lcrecv'] = lcrecv;
kit.ORDER.splice(1, 0, 'lcrecv');

(async () => { process.exit(await kit.cli(process.argv)); })();
