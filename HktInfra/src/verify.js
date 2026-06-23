// HktInfra step-0131 — 헤드리스 검증 (saga 재시도 상한·sagaMaxRetries — 0059 recoverMaxRetries 의 saga 판)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagamax`.
//   더한 한 조각: 0129 autoRetry 는 회신 손실이 *영구*하면 매 sweep 마다 무한 재전송한다 — 실서버는 상한이 필요하다. exchRetry(0126)·autoRetry(0129) 의 재전송을 _resendPending() 공용 헬퍼로 추출하고 gid 당 sagaMaxRetries 회 상한을 둔다. 상한 도달 시 그 give 포기(pendingGive 제거·재전송 중단·giveAbandoned++)·pending 잔존(미해결·sagaConsistent 불변). 포기는 abort 아님(give 가 실제 성공했을 수 있어 낙관적 open 유지 = 안전).
//   검증: ⒜ `reg`(키트) — sagaMaxRetries 0(기본)이면 상한 분기 휴면 → 무제한 재전송 = 0130 비트 동일. ⒝ `exsagamax`(가설) — *영구* 회신 손실 + exchSweep 4회. 상한 ON(2): retries 2 로 유계·giveAbandoned 1·pending 1 잔존·open==escrow(안전)·sagaConsistent. OFF(0): retries 4(sweep 수만큼 발산)·giveAbandoned 0·pending 1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

// s1 list item0(give·회신 *영구* 손실). exchSweep 4회가 자동 재전송 트리거. ttl 0(만료 없음·sweep 은 재전송 트리거로만).
const INV = [{ at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } }];   // item0
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // give seller→escrow(gid0)·회신 영구 손실
  { at: 78, op: { type: 'exchSweep', now: 78 } },   // 재전송 1
  { at: 82, op: { type: 'exchSweep', now: 82 } },   // 재전송 2
  { at: 86, op: { type: 'exchSweep', now: 86 } },   // 상한 ON: 포기(재전송 0)·OFF: 재전송 3
  { at: 90, op: { type: 'exchSweep', now: 90 } },   // 상한 ON: 이미 포기(pendingGive 빔·no-op)·OFF: 재전송 4
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
// item_result(inventory→exchange) 회신을 *영구* 손실(tick 게이트 없음) → give 는 영영 ack 안 됨 → autoRetry 가 무한 재전송하려 함(상한이 막아야).
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' });
const CAP = 2;   // gid 당 재전송 상한
const SWEEPS = 4;   // exchSweep 횟수(상한 OFF 면 재전송 == SWEEPS = 발산)
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, sagaDedup: true, autoRetry: true,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagamax(seeds) {
  console.log('== exsagamax: *가설* — saga 재시도 상한(sagaMaxRetries=2). *영구* 회신 손실 + exchSweep 4회. 상한 ON: 재전송이 gid 당 2회로 유계(retries 2)·도달 후 포기(giveAbandoned 1·재전송 중단)·pending 1 잔존·open==escrow(포기는 abort 아님 = 안전)·sagaConsistent. OFF: retries 4(sweep 수만큼 발산)·giveAbandoned 0. ==');
  console.log('seed   | capON retries/abandoned/pending | ON open==escrow | capOFF retries/abandoned/pending | ON유계<OFF | sagaConsistent | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { sagaMaxRetries: CAP }) });
    const off = run({ ...P(seed, { sagaMaxRetries: 0 }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen);
    const bounded = on.exchange.retries < off.exchange.retries;   // 상한이 발산을 막았다
    const ok =
      check(on.exchange.retries === CAP && on.exchange.giveAbandoned === 1 && on.exchange.pendingGives() === 1, `seed ${seed}: 상한 ON 기대 어긋남(retries ${on.exchange.retries}/abandoned ${on.exchange.giveAbandoned}/pending ${on.exchange.pendingGives()})`) &&
      check(onSafe && JSON.stringify(onOpen) === '["item0"]', `seed ${seed}: 상한 ON 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)}) — 포기가 valid 매물을 abort 했나`) &&
      check(off.exchange.retries === SWEEPS && off.exchange.giveAbandoned === 0 && off.exchange.pendingGives() === 1, `seed ${seed}: 상한 OFF 기대 어긋남(retries ${off.exchange.retries}/abandoned ${off.exchange.giveAbandoned}/pending ${off.exchange.pendingGives()})`) &&
      check(bounded, `seed ${seed}: 상한이 발산을 못 막음(ON retries ${on.exchange.retries} !< OFF ${off.exchange.retries})`) &&
      check(on.exchange.sagaConsistent() && off.exchange.sagaConsistent(), `seed ${seed}: 회계 정합 깨짐(0128 불변 — 포기 give 가 pending 에 남아야)`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.retries + '/' + on.exchange.giveAbandoned + '/' + on.exchange.pendingGives(), 31)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.retries + '/' + off.exchange.giveAbandoned + '/' + off.exchange.pendingGives(), 32)} | ${pad(bounded ? '예' : '아니오', 10)} | ${pad((on.exchange.sagaConsistent() && off.exchange.sagaConsistent()) ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재전송이 *유계*가 된다: gid 당 sagaMaxRetries(2)회 재전송 후 그 give 를 포기(pendingGive 제거→이후 sweep 비-순회·giveAbandoned++) → 영구 회신 손실에도 재전송이 발산하지 않는다(retries 2, OFF 는 sweep 수 4 만큼 누적). 0059 recoverMaxRetries(프레즌스 명령 재시도 상한)의 saga 판.');
  console.log('    포기는 *재전송 중단*일 뿐 abort 아님 — give 가 실제 성공했을 수 있어(dedup 으로 escrow 가 item0 소유) 낙관적 open 을 유지(open==escrow 안전). 포기 give 는 pending 에 남아(미해결) sagaConsistent(gives==acked+pending) 불변. sagaMaxRetries 0 이면 상한 분기 휴면 = 0130 비트 동일(reg).');
}

kit.MODES['exsagamax'] = exsagamax;
kit.ORDER.splice(1, 0, 'exsagamax');

(async () => { process.exit(await kit.cli(process.argv)); })();
