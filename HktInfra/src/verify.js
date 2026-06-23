// HktInfra step-0126 — 헤드리스 검증 (saga 회신 재전송 + idempotent dedup·exchRetry·sagaDedup)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsagaretry`.
//   더한 한 조각: 0125 §9 해소. 거래소가 미해결 give 파라미터를 보관·exchRetry op 에 재전송. 가방이 (replyTo,gid)로 dedup — 이미 처리한 give 는 재실행 없이 저장 결과 재회신. 회신만 손실된 give(이미 성공)의 재전송이 owner≠from 오판→오보상(valid 매물 abort)되는 것 방지.
//   검증: ⒜ `reg`(키트) — exchRetry op 부재·sagaDedup OFF 면 0125 비트 동일. ⒝ `exsagaretry`(가설) — 회신 손실 후 재전송: dedup ON 이면 저장 ok:true 재회신→pending 0·giveOks 정확·open==escrow(안전); dedup OFF 면 재실행 실패→보상이 valid 매물 abort→open!=escrow(안전 위반·dedup 필요성 증명).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

// 최소 시나리오 — s1 이 item0 적재→list(give seller→escrow·gid0). 회신 손실로 pending={gid0}. exchRetry 로 재전송.
const INV = [{ at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } }];   // item0
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // give seller→escrow(gid0)·회신 손실
  { at: 80, op: { type: 'exchRetry' } },                                                            // 미해결 give 재전송
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
// 회신 경로 손실 — 가방→거래소 item_result *최초 전송*만 드롭(재전송분 resend 아님이라 같이 드롭됨; 단 재전송은 가방 dedup 재회신이라 from=inventory 또 드롭? → tick 한정으로 최초 회신만 드롭).
const REPLYLOSS = (seed) => ({ seed: (seed ^ 0x5A6A) >>> 0, delayMin: 0, delayMax: 0, loss: 1.0, redundancy: 1,
  routeFilter: (m) => m.from === 'inventory' && m.to === 'exchange' && m.payload.type === 'item_result' && m.tick < 80 });   // tick<80: 최초 회신만 손실·재전송(tick80+) 회신은 통과
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, exchange: true, exchInventory: true, exchSaga: true, exchCompensate: true,
  transport: REPLYLOSS(seed), invOps: INV, exchangeOps: OPS, ...extra });

function exsagaretry(seeds) {
  console.log('== exsagaretry: *가설* — saga 회신 재전송 + idempotent dedup. s1 list item0(give·회신 손실) → exchRetry 재전송. dedup ON: 가방이 저장 ok:true 재회신→pending 0·giveOks 1·open==escrow(안전). dedup OFF: 재실행 실패(owner=escrow)→보상이 valid 매물 abort→open!=escrow(안전 위반). dedup 필요성 증명. ==');
  console.log('seed   | retries | dedupON pending/oks/abrt | ON open==escrow | dedupOFF fails/abrt | OFF open==escrow | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { sagaDedup: true }) });
    const off = run({ ...P(seed, { sagaDedup: false }) });
    const onEsc = ownedSet(on.inventory, 'escrow'), onOpen = on.exchange.escrowItemIds();
    const offEsc = ownedSet(off.inventory, 'escrow'), offOpen = off.exchange.escrowItemIds();
    const onSafe = JSON.stringify(onEsc) === JSON.stringify(onOpen);
    const offSafe = JSON.stringify(offEsc) === JSON.stringify(offOpen);
    const ok =
      check(on.exchange.retries >= 1 && off.exchange.retries >= 1, `seed ${seed}: 재전송 안 됨(ON ${on.exchange.retries}/OFF ${off.exchange.retries})`) &&
      check(on.exchange.pendingGives() === 0 && on.exchange.giveOks === on.exchange.gives && on.exchange.aborted === 0, `seed ${seed}: dedup ON 회복 실패(pending ${on.exchange.pendingGives()}/oks ${on.exchange.giveOks}/gives ${on.exchange.gives}/abrt ${on.exchange.aborted})`) &&
      check(onSafe && JSON.stringify(onOpen) === '["item0"]', `seed ${seed}: dedup ON 안전 위반(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(off.exchange.aborted === 1 && !offSafe, `seed ${seed}: dedup OFF 인데 오보상/안전위반 미발생(abrt ${off.exchange.aborted}·safe ${offSafe}) — dedup 필요성 미증명`) &&
      check(JSON.stringify(offEsc) === '["item0"]' && JSON.stringify(offOpen) === '[]', `seed ${seed}: dedup OFF 격차 기대(escrow [item0]·open [])·실제 escrow ${JSON.stringify(offEsc)}/open ${JSON.stringify(offOpen)}`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.retries, 7)} | ${pad(on.exchange.pendingGives() + '/' + on.exchange.giveOks + '/' + on.exchange.aborted, 24)} | ${pad((onSafe ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 15)} | ${pad(off.exchange.giveFails + '/' + off.exchange.aborted, 19)} | ${pad((offSafe ? '예' : '아니오') + ' ' + JSON.stringify(offOpen), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 재전송이 *안전*하려면 가방이 멱등(재실행 0)이어야 한다: dedup ON 이면 가방이 (replyTo,gid)로 *저장된 결과*를 재회신 → 거래소 pending drain·giveOks 정확·open 매물 ≡ 가방 escrow(2-서비스 안전 회복). 0125 의 "지식 격차"가 닫힌다.');
  console.log('    dedup OFF 면 재전송이 가방서 *재실행*돼 owner≠from(이미 escrow) 으로 ok:false 오판 → 보상이 valid 매물을 abort → 거래소 open=[] 인데 가방 escrow=[item0](안전 위반). 이것이 0125 §9 가 경고한 "naive 재전송 오보상" — dedup 가 필요. exchRetry op 부재·sagaDedup OFF 면 0125 비트 동일(reg).');
}

kit.MODES['exsagaretry'] = exsagaretry;
kit.ORDER.splice(1, 0, 'exsagaretry');

(async () => { process.exit(await kit.cli(process.argv)); })();
