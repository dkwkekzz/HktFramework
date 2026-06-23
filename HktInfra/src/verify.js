// HktInfra step-0133 — 헤드리스 검증 (정리: topo-build.js 버스 구독 테이블 분할 topo-subs.js·기능 0·reg 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `topsplit`(정리 검증 — 분할 전후 비트 동일).
//   더한 한 조각: 없음(기능 0). topo-build.js 가 33KB 를 넘어(비대화 트리거) *버스 구독 테이블 빌더*(buildSubs)를 topo-subs.js 로 분리 — net-core 0030·cluster 0035·topology 0038·topo-actors 0098·svc-exchange 0124 분할과 같은 패턴. topo-build 는 spec 빌더로 남고 buildSubs 를 require.
//   검증: ⒜ `reg`(키트) — 표준 시나리오 비트 동일. ⒝ `topsplit`(정리) — 구독이 풍성한 토폴로지(가방·채팅·랭킹·audit·거래소 발행 5종·시세)를 src(분할)와 baseline(인라인 subs) 양쪽서 돌려 net.log·버스 라우팅/회계 *비트 동일* 단언(분할 = 순수 리팩터·구독 spec 불변).
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
const busDigest = NET.busDigest, auditDigest = NET.auditDigest;
// 버스 구독 테이블 직렬화(분할 전후 동치의 핵심) — bus actor 의 구독 spec 이 src/baseline 에서 정확히 같은지.
const subsDigest = (r) => { const b = r.actors && r.actors.get ? r.actors.get('bus') : null; return fnv1a(JSON.stringify(b && b.subs ? [...b.subs].sort() : (b && b.topics ? [...b.topics] : 'n/a'))); };

const INV = [
  { at: 60, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 61, op: { type: 'item_req', op: 'pickup', avatar: 's1' } },
  { at: 62, op: { type: 'item_req', op: 'pickup', avatar: 's2' } },
];
const OPS = [
  { at: 70, op: { type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'item0' } },
  { at: 71, op: { type: 'exchList', seller: 's2', item: 'potion', price: 3, itemId: 'item2' } },
  { at: 75, op: { type: 'exchBuy', buyer: 'b1', id: 1 } },
  { at: 77, op: { type: 'exchCancel', seller: 's2', id: 2 } },
  { at: 82, op: { type: 'exchList', seller: 's1', item: 'gem', price: 8, itemId: 'item1' } },
  { at: 85, op: { type: 'exchSweep', now: 85 } },
];
// 구독이 풍성한 토폴로지 — audit + 거래소 발행 5종(sold/cancelled/expired/aborted/saga_abandoned) + 시세 + 랭킹 + 채팅 모두 켜 buildSubs 의 많은 분기를 자극.
const P = (seed) => ({ seed, ticks: 95, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2,
  inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2, bus: true, audit: true, ranking: true,
  exchange: true, exchInventory: true, exchSaga: true, exchCompensate: true, sagaDedup: true, autoRetry: true, sagaMaxRetries: 2,
  exchangePublish: true, cancelPublish: true, expirePublish: true, abortPublish: true, abandonPublish: true, marketFeed: true,
  exchangePersist: true, exchangeSnapshot: 4, exchangeTtl: 5, invOps: INV, exchangeOps: OPS });

function topsplit(seeds) {
  console.log('== topsplit: *정리 검증* — topo-build.js 구독 테이블을 topo-subs.js(buildSubs)로 분할이 *순수 리팩터*(기능 0). 구독 풍성 토폴로지(가방·채팅·랭킹·audit·거래소 발행 5종·시세)를 src(분할)와 baseline(인라인)서 돌려 net.log·버스 라우팅/회계·audit 스트림 비트 동일 단언. ==');
  console.log('seed   | src logHash | base logHash | log동일 | bus동일 | audit동일 | subs동일 | 판정');
  for (const seed of seeds) {
    const cur = NET.run({ ...P(seed) });
    const prev = NETPREV.run({ ...P(seed) });
    const okL = logDigest(cur) === logDigest(prev);
    const okB = busDigest(cur) === busDigest(prev);
    const okA = auditDigest(cur) === auditDigest(prev);
    const okS = subsDigest(cur) === subsDigest(prev);
    const ok =
      check(okL, `seed ${seed}: net.log 다름(분할이 메시지 트레이스를 바꿈)`) &&
      check(okB, `seed ${seed}: 버스 라우팅/회계 다름(구독 spec 변형)`) &&
      check(okA, `seed ${seed}: audit 관측 스트림 다름`) &&
      check(okS, `seed ${seed}: bus 구독 테이블 다름(buildSubs 출력 != 인라인)`);
    const hx = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
    console.log(`${pad(seed, 6)} | ${hx(logDigest(cur))} | ${hx(logDigest(prev))}  | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okB ? '예' : '아니오').padEnd(6)} | ${(okA ? '예' : '아니오').padEnd(8)} | ${(okS ? '예' : '아니오').padEnd(7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → topo-build.js(33KB)의 버스 구독 테이블(가방/채팅/랭킹/audit/프레즌스/귓속말/파티/수신함/거래소 5종/시세)을 topo-subs.js(buildSubs)로 verbatim 이동 — net.log·버스 라우팅·audit 스트림·구독 spec 이 baseline(인라인)과 비트 동일(분할은 *파일 구조*만·동작 불변). 박스 1개=파일 1개 유계.');
  console.log('    구독 spec 이 SSOT(새 소비자 = 행 추가)라 분리해도 발행자 무수정 불변 — 거래소 발행 5종·시세·랭킹 등 많은 분기를 한 시나리오로 자극해 어느 행도 안 바뀜을 단언. reg(키트)는 표준 시나리오 비트 동일을 별도 보증.');
}

kit.MODES['topsplit'] = topsplit;
kit.ORDER.splice(1, 0, 'topsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
