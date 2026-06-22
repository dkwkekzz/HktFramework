// HktInfra step-0123 — 헤드리스 검증 (보상 발행·abortPublish svc.exchange.aborted)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exabortpub`.
//   더한 한 조각: 0122 의 abort(보상 롤백)는 거래소 내부 회계로만 굴러 외부 관측 불가. 이 step 은 보상 성립(미소유 list→give 실패→abort)을 svc.exchange.aborted 로 1회 발행 — audit·시세 피드 무수정 소비자가 구독해 보상을 관측(수명주기 발행 4종 완비: sold/cancelled/expired/aborted).
//   검증: ⒜ `reg`(키트) — abortPublish OFF·bus 부재면 발행 0 = 0122 비트 동일. ⒝ `exabortpub`(가설) — 미소유 list 주입: ON 이면 aborted 1·abortPublished 1·audit 가 svc.exchange.aborted 1 관측; OFF 면 발행 0·audit 미관측. 보존/2-서비스 일치 유지.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item1
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },   // 유효 — give ok → open
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'ghost', price: 5, itemId: 'item9' } },     // 무효(s1 미소유) — give fail → 보상 abort → 발행
];
const ownedSet = (inv, av) => [...inv.ledger.entries()].filter(([, o]) => o === av).map(([id]) => id).sort();
const P = (seed, extra) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, bus: true, audit: true, exchange: true, exchInventory: true, exchSaga: true, exchCompensate: true, invOps: INV, exchangeOps: OPS, ...extra });

function exabortpub(seeds) {
  console.log('== exabortpub: *가설* — 보상 발행. 미소유 list→give 실패→abort 성립을 svc.exchange.aborted 로 1회 발행 → audit 무수정 소비자가 구독해 보상 관측. abortPublish OFF 면 발행 0·미관측. 수명주기 발행 4종(sold/cancelled/expired/aborted) 완비. ==');
  console.log('  s1 적재 item0/item1 → list item0(유효) + list item9(미소유→abort). ON: abortPublished 1·audit svc.exchange.aborted 1. OFF: 발행 0·audit 미관측. 보존/2-서비스 일치 유지.');
  console.log('seed   | aborted | abortPublished ON/OFF | audit aborted ON/OFF | open==escrow | conserved | 판정');
  for (const seed of seeds) {
    const on = run({ ...P(seed, { abortPublish: true }) });
    const off = run({ ...P(seed, { abortPublish: false }) });
    const auditOn = (on.audit && on.audit.seen.get('svc.exchange.aborted')) || 0;
    const auditOff = (off.audit && off.audit.seen.get('svc.exchange.aborted')) || 0;
    const onEsc = ownedSet(on.inventory, 'escrow');
    const onOpen = on.exchange.escrowItemIds();
    const match = JSON.stringify(onEsc) === JSON.stringify(onOpen);
    const ok =
      check(on.exchange.aborted === 1, `seed ${seed}: aborted 기대 1(${on.exchange.aborted})`) &&
      check(on.exchange.abortPublished === 1 && off.exchange.abortPublished === 0, `seed ${seed}: abortPublished 기대 ON1/OFF0(ON ${on.exchange.abortPublished}/OFF ${off.exchange.abortPublished})`) &&
      check(auditOn === 1 && auditOff === 0, `seed ${seed}: audit aborted 관측 기대 ON1/OFF0(ON ${auditOn}/OFF ${auditOff})`) &&
      check(match && JSON.stringify(onOpen) === '["item0"]', `seed ${seed}: 2-서비스 불일치(open ${JSON.stringify(onOpen)} vs escrow ${JSON.stringify(onEsc)})`) &&
      check(on.exchange.conserved(), `seed ${seed}: 보존 깨짐`);
    console.log(`${pad(seed, 6)} | ${pad(on.exchange.aborted, 7)} | ${pad(on.exchange.abortPublished + '/' + off.exchange.abortPublished, 21)} | ${pad(auditOn + '/' + auditOff, 20)} | ${pad((match ? '예' : '아니오') + ' ' + JSON.stringify(onOpen), 12)} | ${pad(on.exchange.conserved() + '', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 보상이 *관측 가능*해진다: abort 성립이 svc.exchange.aborted 로 1회 발행돼 audit(무수정 소비자)가 phantom 매물 롤백을 본다 — 0016 발행자 무수정 소비자 패턴의 거래소 *보상* 판(0111 cancelled·0115 expired 의 실패-롤백 형제). 수명주기 발행 4종(sold/cancelled/expired/aborted) 완비.');
  console.log('    abortPublish OFF·bus 부재면 발행 0·audit 미관측 = 0122 비트 동일(reg). 보상 자체(2-서비스 일치)는 발행과 직교 — 발행은 *관측*만 더한다(open==escrow·conserved 불변).');
}

kit.MODES['exabortpub'] = exabortpub;
kit.ORDER.splice(1, 0, 'exabortpub');

(async () => { process.exit(await kit.cli(process.argv)); })();
