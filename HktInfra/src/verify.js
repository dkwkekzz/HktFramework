// HktInfra step-0180 — 헤드리스 검증 (아이템 우편 saga liveness 회계 정합 capstone·sagaLivenessConsistent)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailliveness`.
//   더한 한 조각: sagaLivenessConsistent() = pending.size == pendingGive.size + abandonedGive.size + permFailed(미해결 give 는 재전송중·재admission대기·영구종결 으로 정확히 분할·공백/중복 0) AND sagaConsistent(0169). 0172~0179 liveness arc 의 창발 불변·거래소 0140 의 우편 판. 미호출 read accessor = 0179 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — 미호출 accessor = 0179 비트 동일. ⒝ `mailliveness`(가설) — 정상 drain·재전송중·abandon 대기·영구 종결 *네 체제* 모두서 분할 항등식 성립.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const READMIT = (at) => ({ at, op: { type: 'mailReadmit' } });
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 0, mailAutoRetry: true, invOps: [PICK(2, 'x'), PICK(3, 'x')] };
const SENDS = [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1')];
// 네 체제: A 정상 drain(pending 0)·B 재전송 중(pendingGive)·C abandon 대기(abandonedGive)·D 영구 종결(permFailed).
const REGIMES = {
  'A 정상': (seed) => ({ seed, ticks: 60, ...COMMON, mailOps: [...SENDS, SWEEP(30), SWEEP(40)] }),
  'B 재전송중': (seed) => ({ seed, ticks: 60, ...COMMON, mailAckDropAlways: [1], mailMaxRetries: 0, mailOps: [...SENDS, SWEEP(30), SWEEP(40)] }),
  'C abandon대기': (seed) => ({ seed, ticks: 70, ...COMMON, mailAckDropAlways: [1], mailMaxRetries: 2, mailOps: [...SENDS, SWEEP(30), SWEEP(40), SWEEP(50)] }),
  'D 영구종결': (seed) => ({ seed, ticks: 100, ...COMMON, mailAckDropAlways: [1], mailMaxRetries: 2, mailReadmitMax: 1, mailOps: [...SENDS, SWEEP(30), SWEEP(40), SWEEP(50), READMIT(55), SWEEP(60), SWEEP(70), SWEEP(80)] }),
};

function mailliveness(seeds) {
  console.log('== mailliveness: *capstone* — saga liveness 회계 정합(sagaLivenessConsistent). 미해결(pending) give = 재전송중(pendingGive)+재admission대기(abandonedGive)+영구종결(permFailed) 으로 정확히 분할(공백/중복 0) AND sagaConsistent. 0172~0179 arc·거래소 0140 의 우편 판. 네 체제 전부. ==');
  console.log('seed   | A pnd=pg+ab+pf | B(재전송) | C(abandon) | D(영구) | 네 체제 분할+sagaConsistent | 판정');
  for (const seed of seeds) {
    const r = {}; for (const k in REGIMES) r[k] = run(REGIMES[k](seed));
    const live = Object.values(r).every(x => x.mail.sagaLivenessConsistent());
    const m = k => r[k].mail;
    const shapes =
      m('A 정상').pending.size === 0 &&
      m('B 재전송중').pendingGive.size === 1 && m('B 재전송중').pending.size === 1 &&
      m('C abandon대기').abandonedGive.size === 1 && m('C abandon대기').pending.size === 1 &&
      m('D 영구종결').permFailed === 1 && m('D 영구종결').pending.size === 1;
    const fmt = k => `${m(k).pending.size}=${m(k).pendingGive.size}+${m(k).abandonedGive.size}+${m(k).permFailed}`;
    const ok =
      check(live, `seed ${seed}: 어느 체제서 sagaLivenessConsistent false`) &&
      check(shapes, `seed ${seed}: 체제별 기대 상태 어긋남`);
    console.log(`${pad(seed, 6)} | ${pad(fmt('A 정상'), 14)} | ${pad(fmt('B 재전송중'), 9)} | ${pad(fmt('C abandon대기'), 10)} | ${pad(fmt('D 영구종결'), 7)} | ${pad(live ? '예(4/4)' : '아니오', 27)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 미해결(아직 ack 못 받은) give 는 매 순간 정확히 세 상태 중 하나다: 재전송 중(pendingGive·sweep 이 다시 보냄)·재admission 대기(abandonedGive·상한 도달 포기)·영구 종결(permFailed·readmitMax 도달). pending.size == 세 수의 합이 *모든 체제*(정상 drain·재전송중·abandon 대기·영구 종결)서 성립 — 새는 give 0·중복 0. sagaConsistent(0169·gives==acked+pending)와 함께 우편 saga liveness arc(0166~0180)를 닫는다. 거래소 0140 sagaLiveConsistent(liveness 판)의 우편 판.');
}

kit.MODES['mailliveness'] = mailliveness;
kit.ORDER.splice(1, 0, 'mailliveness');

(async () => { process.exit(await kit.cli(process.argv)); })();
