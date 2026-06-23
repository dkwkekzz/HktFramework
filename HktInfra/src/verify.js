// HktInfra step-0169 — 헤드리스 검증 (아이템 우편 saga 회계 정합 capstone·sagaConsistent)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlsagac`.
//   더한 한 조각: sagaConsistent() = ① gives==ackedGives+pendingGives ② ackedGives==giveOks+giveFails. 정상·손실·재전송 모든 체제서 성립(거래소 0128 의 우편 판).
//   검증: ⒜ `reg`(키트) — 미호출 accessor = 0168 비트 동일. ⒝ `exmlsagac`(가설) — 3 체제(정상·회신손실·재전송) 전부 sagaConsistent true.
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
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
const RETRY = (at) => ({ at, op: { type: 'mailRetry' } });
const base = (seed, drop, retry) => ({
  seed, ticks: 50, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 10, mailAckDrop: drop,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30)].concat(retry ? [RETRY(40)] : []),
});
// 3 체제 — 정상(무손실)·회신손실(pending 잔존)·재전송(drain). 회계 분포는 달라도 sagaConsistent 불변.
const REGIMES = (seed) => ({ normal: base(seed, null, false), loss: base(seed, [1], false), retry: base(seed, [1], true) });

function exmlsagac(seeds) {
  console.log('== exmlsagac: *capstone* — 아이템 우편 saga 회계 정합(sagaConsistent). ① gives==acked+pending ② acked==oks+fails 가 정상·손실·재전송 *모든 체제*서 성립(새는 give 0·분류 누락 0). 거래소 0128 의 우편 판. ==');
  console.log('seed   | normal(g/a/p) | loss | retry | 3체제 sagaConsistent | 판정');
  for (const seed of seeds) {
    const R = REGIMES(seed);
    const runs = {}; for (const k of Object.keys(R)) runs[k] = run(R[k]);
    const snap = (r) => r.mail.gives + '/' + r.mail.ackedGives + '/' + r.mail.pendingGives();
    const live = Object.values(runs).every(r => r.mail.sagaConsistent());
    const shapes = (runs.normal.mail.pendingGives() === 0 && runs.loss.mail.pendingGives() === 1 && runs.retry.mail.pendingGives() === 0);
    const ok =
      check(live, `seed ${seed}: 어느 체제서 sagaConsistent false`) &&
      check(shapes, `seed ${seed}: 체제별 pending 기대 어긋남(normal ${runs.normal.mail.pendingGives()}·loss ${runs.loss.mail.pendingGives()}·retry ${runs.retry.mail.pendingGives()})`);
    console.log(`${pad(seed, 6)} | ${pad(snap(runs.normal), 13)} | ${pad(snap(runs.loss), 7)} | ${pad(snap(runs.retry), 7)} | ${pad(live ? '예(3/3)' : '아니오', 20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → saga 회계가 *대수적으로 닫힌다*: 보낸 모든 give 는 정확히 acked(회신 받음) 또는 pending(미수신) 둘 중 하나(새는 give 0), 받은 모든 회신은 ok/fail 로 분류(누락 0). 회신손실로 pending 이 생겨도(loss 4/3/1) 재전송으로 drain 돼도(retry 4/4/0) 항등식 불변 — 0166~0168 이 더한 전이가 회계 닫힘을 보존.');
  console.log('    아이템 우편 saga 정합층 완성(0128 의 우편 판). give↔가방 transfers capstone(giveOks==escrowXfers 0170)이 두 서비스 회계 합치 — 다음 capstone.');
}

kit.MODES['exmlsagac'] = exmlsagac;
kit.ORDER.splice(1, 0, 'exmlsagac');

(async () => { process.exit(await kit.cli(process.argv)); })();
