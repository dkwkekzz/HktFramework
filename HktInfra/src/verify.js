// HktInfra step-0124 — 헤드리스 검증 (정리: svc-exchange.js 박스-부품 분할 core/txn/entry·기능 0·reg 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exsplit`(정리 검증 — 분할 전후 비트 동일).
//   더한 한 조각: 없음(기능 0). svc-exchange.js 가 32KB 를 넘어(비대화 트리거) ExchangeService 를 core(상태·헬퍼·crash·reconstruct·조회)+txn(onMsg)+entry 로 분할 — 가방 0053·whisper 0094·topo 0098 분할과 같은 패턴.
//   검증: ⒜ `reg`(키트) — 표준 시나리오 비트 동일(거래소 미포함이라 자명). ⒝ `exsplit`(정리) — *거래소 전 분기*(list/buy/cancel/expire/abort + 발행 4종 + saga + 보상 + 영속 + 시세)를 src(분할)와 baseline(단일 파일) 양쪽서 돌려 net.log 다이제스트·거래소 회계 전부 *비트 동일* 단언(분할 = 순수 리팩터·동작 불변).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const fnv1a = NET.fnv1a;
const logDigest = (r) => fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
// 거래소 회계 전부 직렬화(open 매물·발행·saga·보상·영속) — 분할 전후 비교용 다이제스트.
const exDigest = (r) => { const e = r.exchange; return fnv1a(JSON.stringify([
  [...e.listings.entries()], e.nextId, e.listed, e.sold, e.cancelled, e.expired, e.rejects, e.published, e.cancelPublished, e.expirePublished, e.abortPublished,
  e.gives, e.ackedGives, e.giveOks, e.giveFails, e.aborted, e.escrowItemIds(), e.conserved(),
  [...e.delivered], [...e.proceeds], [...e.returned], e.journal, e.snapshot])); };

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item0
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item1
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item2
  { at: 63, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },   // item3
  { at: 64, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },   // item4
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's1', item: 'shield', price: 5, itemId: 'item1' } },
  { at: 72, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 73, op: { type: 'exchList', seller: 's2', item: 'ring', price: 20, itemId: 'item3' } },
  { at: 74, op: { type: 'exchList', seller: 's1', item: 'ghost', price: 9, itemId: 'item9' } },   // 무효(미소유) → give fail → 보상 abort
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },           // item0 → b1 (sold)
  { at: 76, op: { type: 'exchBuy', buyer: 'b2', id: 2 } },           // item1 → b2 (sold)
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 3 } },       // item2 → s2 (cancel)
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item4' } },     // 늦게 list
  { at: 85, op: { type: 'exchSweep', now: 85 } },                    // id4(ring·@73) 만료
];
// 거래소 전 분기를 한 번에 자극: 발행 4종·saga·보상·영속·압축·시세·만료.
const P = (seed) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 0, bus: true, audit: true,
  exchange: true, exchInventory: true, exchSaga: true, exchCompensate: true,
  exchangePublish: true, cancelPublish: true, expirePublish: true, abortPublish: true, marketFeed: true,
  exchangePersist: true, exchangeSnapshot: 4, exchangeTtl: 5, invOps: INV, exchangeOps: OPS });

function exsplit(seeds) {
  console.log('== exsplit: *정리 검증* — svc-exchange.js core/txn/entry 분할이 *순수 리팩터*(기능 0). 거래소 전 분기(list/buy/cancel/expire/abort + 발행 4종 + saga + 보상 + 영속 + 시세)를 src(분할)와 baseline(단일 파일) 양쪽서 돌려 net.log·거래소 회계 비트 동일 단언. ==');
  console.log('seed   | src logHash | base logHash | log동일 | src exHash | base exHash | ex동일 | sold/can/exp/abrt | open | 판정');
  for (const seed of seeds) {
    const cur = NET.run({ ...P(seed) });
    const prev = NETPREV.run({ ...P(seed) });
    const okL = logDigest(cur) === logDigest(prev);
    const okE = exDigest(cur) === exDigest(prev);
    const e = cur.exchange;
    const ok =
      check(okL, `seed ${seed}: net.log 다름(분할이 메시지 트레이스를 바꿈)`) &&
      check(okE, `seed ${seed}: 거래소 회계 다름(분할이 상태를 바꿈)`);
    const hx = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
    console.log(`${pad(seed, 6)} | ${hx(logDigest(cur))} | ${hx(logDigest(prev))}  | ${(okL ? '예' : '아니오').padEnd(6)} | ${hx(exDigest(cur))} | ${hx(exDigest(prev))}  | ${(okE ? '예' : '아니오').padEnd(6)} | ${pad(e.sold + '/' + e.cancelled + '/' + e.expired + '/' + e.aborted, 17)} | ${pad(e.open(), 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → svc-exchange.js(32KB)를 core(상태·헬퍼·crash·reconstruct·조회)+txn(onMsg)+entry 로 분할 — net.log·거래소 회계가 baseline(단일 파일)과 비트 동일(분할은 *파일 구조*만·동작 불변). 박스 1개=파일 1개 유계(가방 0053·whisper 0094·topo 0098 와 같은 패턴).');
  console.log('    거래소 전 분기(체결/취소/만료/보상 abort + 발행 4종 + saga 피드백 + 영속/압축 + 시세 피드)를 한 시나리오로 자극해 어느 분기도 분할로 안 바뀜을 단언. reg(키트)는 거래소 미포함 표준 시나리오 비트 동일을 별도 보증.');
}

kit.MODES['exsplit'] = exsplit;
kit.ORDER.splice(1, 0, 'exsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
