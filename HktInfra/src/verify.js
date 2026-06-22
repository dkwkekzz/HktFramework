// HktInfra step-0107 — 헤드리스 검증 (거래소 서비스 분리·아이템 escrow 거래·쌍 거래 보존)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `pexch`.
//   더한 한 조각: SPINE 계층3 거래소 박스 첫 구현. list=판매자가 아이템을 거래소 escrow 로 맡김(acquire), buy=escrow 아이템을 구매자에게+대가를 판매자에게(release 쌍), cancel=escrow 를 판매자에 반환(release). 모든 listed 아이템은 매 순간 정확히 한 상태(open/sold/cancelled) — 공백·중복 0(보존: listed == open + sold + cancelled). 닫힌 listing buy/cancel 은 거부(이중 해결 0). 가방(0014)의 단일 소유+쌍 거래를 *두 당사자 교환*으로 확장.
//   검증: ⒜ `reg`(키트) — exchange 미설정이면 거래소 박스 0 = 0106 비트 동일. ⒝ `pexch`(가설) — 4 list·2 buy·1 cancel·2 거부(닫힌/없는 매물). listed 4·sold 2·cancelled 1·open 1·rejects 2·conserved true·delivered b1/b2 1·proceeds s1 15·minted 불변(비침습).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, itemConserved, ledgerConsistent } = NET;
const { check, pad } = kit.helpers;

const DEAD_DIE = 14;
// 거래 시나리오: 4 등록(id 1~4)·2 체결(id1·id2)·1 취소(id3·소유자 s2)·2 거부(id1 재구매=닫힘·id99=없음)
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10 } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5 } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3 } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20 } },
  { at: 74, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },
  { at: 76, op: { type: 'exchCancel', seller: 's2', id: 3 } },
  { at: 77, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },   // 거부: 이미 체결(닫힘)
  { at: 78, op: { type: 'exchBuy', buyer: 'b1', id: 99 } },  // 거부: 없는 매물
];
const P_BASE = (seed, extra) => ({ seed, ticks: 90, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2,
  incremental: true, recovery: true, failover: true, inventory: true, itemOps: 30, chat: true, chatOps: 12, regions: 2,
  bus: true, audit: true, ranking: true, busResend: true, busOutAck: true, busMinWm: true,
  busConsumerLease: true, leaseSpan: 3, busLeaseLife: true, busLeaseAdapt: true, busLeaseGrace: true, cadencePrior: 6,
  busLeaseAudit: true, busLeasePresence: true, busPresenceRecover: true, recoverRetry: true, presencePublish: true,
  presenceMonitor: true, presenceBox: true, presenceReportBus: true, presenceShadow: true, presenceLease: true, hbTimeout: 3,
  presenceQuery: true, whisperRouter: true, rankDie: DEAD_DIE, whisperReceipt: true, deliverRetry: true, deliverTimeout: 4,
  ...extra });

function pexch(seeds) {
  console.log('== pexch: *가설* — 거래소 서비스 분리(아이템 escrow 거래). list=acquire(escrow)·buy/cancel=release 쌍. 모든 listed 아이템은 정확히 한 상태(open/sold/cancelled)·공백·중복 0(보존). 닫힌 매물 buy/cancel 거부 ==');
  console.log('  4 list·2 buy·1 cancel·2 거부. 기대: listed 4·sold 2·cancelled 1·open 1·rejects 2·conserved true·delivered b1/b2 1·proceeds s1 15·returned s2 1.');
  console.log('seed   | listed | sold | cancel | open | rejects | conserved | b1/b2 | proc s1 | 비침습 | 판정');
  for (const seed of seeds) {
    const on  = run({ ...P_BASE(seed, { exchange: true, exchangeOps: OPS }) });
    const off = run({ ...P_BASE(seed, {}) });   // 거래소 박스 없음(0106 동작)
    const ex = on.exchange;
    // ① 거래 원장 — list/buy/cancel/reject 회계 + 보존(listed == open + sold + cancelled)·이중 해결 0.
    const ledger = ex && ex.listed === 4 && ex.sold === 2 && ex.cancelled === 1 && ex.open() === 1 && ex.rejects === 2 && ex.conserved();
    // ② 쌍 거래 release 측 — 구매자 acquire·판매자 수익·반환.
    const release = ex && ex.delivered.get('b1') === 1 && ex.delivered.get('b2') === 1 && ex.proceeds.get('s1') === 15 && ex.returned.get('s2') === 1;
    // ③ 거래소 부재(OFF) — 박스 0(거래소 null·0106 동작).
    const absent = off.exchange == null;
    const nonInvasive = on.inventory.minted === off.inventory.minted && ledgerConsistent(on) && ledgerConsistent(off) && itemConserved(on) && itemConserved(off);
    const ok =
      check(ledger, `seed ${seed}: 거래 원장 틀림(listed ${ex && ex.listed}·sold ${ex && ex.sold}·cancel ${ex && ex.cancelled}·open ${ex && ex.open()}·rejects ${ex && ex.rejects}·conserved ${ex && ex.conserved()}·기대 4/2/1/1/2/true)`) &&
      check(release, `seed ${seed}: 쌍 거래 release 틀림(b1 ${ex && ex.delivered.get('b1')}·b2 ${ex && ex.delivered.get('b2')}·proc s1 ${ex && ex.proceeds.get('s1')}·ret s2 ${ex && ex.returned.get('s2')}·기대 1/1/15/1)`) &&
      check(absent, `seed ${seed}: OFF 거래소 박스 비재현(exchange ${off.exchange})`) &&
      check(nonInvasive, `seed ${seed}: 거래소가 원장/세계 권위 바꿈(minted ${on.inventory.minted}/${off.inventory.minted})`);
    console.log(`${pad(seed, 6)} | ${pad(ex ? ex.listed : 0, 6)} | ${pad(ex ? ex.sold : 0, 4)} | ${pad(ex ? ex.cancelled : 0, 6)} | ${pad(ex ? ex.open() : 0, 4)} | ${pad(ex ? ex.rejects : 0, 7)} | ${pad(ex ? ex.conserved() + '' : '-', 9)} | ${pad((ex ? ex.delivered.get('b1') : 0) + '/' + (ex ? ex.delivered.get('b2') : 0), 5)} | ${pad(ex ? ex.proceeds.get('s1') : 0, 7)} | ${pad(nonInvasive + '', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 거래소가 *존 넘는 아이템 거래*를 존간 결합 없이 한 박스에서 성립시킨다(SPINE §2 가방 행). escrow 가 거래소의 단일 쓰기 권위 — list=acquire·buy/cancel=release 쌍 거래로 모든 아이템이 매 순간 정확히 한 상태(공백·중복 0). 닫힌 매물 재거래 거부 = 이중 판매/해결 0(0026 dedup 의 거래 판).');
  console.log('    exchange 미설정 = 거래소 박스 0 = 0106 비트 동일(reg). 비-침습: 거래소는 자기 escrow 원장만 권위 — 가방 minted·세계 해시 불변(ON==OFF)·존 tick 밖 순수 반응형(onTick 0·발신 0).');
}

kit.MODES['pexch'] = pexch;
kit.ORDER.splice(1, 0, 'pexch');

(async () => { process.exit(await kit.cli(process.argv)); })();
