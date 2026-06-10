// HktInfra step-0014 — 헤드리스 검증 (가방 서비스 분리 — 아이템 원장을 존 tick 밖 비동기 서비스로)
// 사용: node step-0014/verify.js <mode> [seed]
//   mode: reg | e2e | sacred | ownership | isolate | hide | repro | all
//     reg        — 회귀 0: 인프로세스 모드(가방 OFF) → step-0013 과 *비트 동일*(net.log + 상태).
//                  zones 1·2 · recovery off/on · failover off/on(+death). 가방 박스 도입이 *비-침습*임을 증명.
//     e2e        — E2E 동치: 멀티프로세스(가방 ON·토픽 버스·무열화) = 인프로세스 *비트 동일*(logDigest+worldDigest+invDigest)
//                  + 아이템 단일 소유·conserved·consistent·itemDesync 0. basic-inv·failover-inv.
//     sacred     — *신성한 tick*(이 step 의 한 조각): 가방 ON vs OFF → 월드 상태(존 ents+AOI 뷰) *비트 동일*(가방이 시뮬에
//                  비-침습) · 한편 가방은 실제 일함(minted>0·transfers>0) · 존에 도달한 item 메시지 0 · inventory onTick 0.
//     ownership  — 권위 단일 소유(아이템): 매 아이템 소유자=1(belief maxOwners 1) · conserved(원장 ≡ minted, dupe·loss 0) ·
//                  consistent(원장 ≡ byOwner 역인덱스 — 쌍 거래 원자성) · 행복 경로 itemDesync 0 ·
//                  전송 열화(redundancy+dedup)에도 원장 보존(idempotent transfer·미소유 give 거부=failedOps).
//     isolate    — 프로세스 분리: inventory = 자기 OS pid(broker·타 호스트와 다름) · 원장 비어있지 않음 · 통신=버스 프레임뿐.
//     hide       — 은닉: 가방 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · inventory/item_req/원장/타 내부 누설 0.
//     repro      — 재현: 같은 시드 멀티프로세스(가방) 2회 → 같은 원장+월드 + 인프로세스와도 동일(결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS,
        itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest } = NET;
const NET13 = require('../step-0013/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;       // 권위 존 사망 tick(failover)
const LEASE = 3;        // lease 결손 임계
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// worldDigest — *월드 상태만*(존 ents + 클라 AOI). 가방 on/off 에 *불변*이어야 함(신성한 tick = 가방 비-침습).
function worldDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
function finalLiveDesync(r) {
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const truth = globalAoiTruth(r, c.avatar);
    if (truth === null) continue;
    if (JSON.stringify(c.seenIds()) !== JSON.stringify(truth)) d++;
  }
  return d;
}
// 존(시뮬) 측 소유자 — 매 권위 엔티티의 살아있는 소유 존 수(=1).
function maxZoneOwners(r) {
  const cnt = new Map();
  for (const z of r.allZones) if (z.isAuthority()) for (const id of z.ents.keys()) cnt.set(id, (cnt.get(id) || 0) + 1);
  let mx = 0; for (const v of cnt.values()) if (v > mx) mx = v;
  return mx;
}
// 존에 도달한 item 메시지 수(=0 이어야 함 — 가방은 존을 우회 = 신성한 tick).
function itemMsgsToZones(r) {
  return r.net.log.filter(m => /^zone/.test(m.to) && m.payload && /^item/.test(m.payload.type || '')).length;
}

// ── 검증 시나리오 ──
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const INV = (seed) => ({ ...BASE(seed), inventory: true, itemOps: 10 });
const FAILS_INV = (seed) => ({ ...INV(seed), ticks: 80, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화 — 가방 서버-측 홉(gateway↔inventory)만 redundancy/loss(원장 보존·idempotent 검증).
const DEGRADE = (seed) => ({ ...INV(seed), itemOps: 12, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.item } });

// ── reg: 인프로세스 0014(가방 OFF) → 0013 비트 동일(가방 박스 도입 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(가방 OFF) → step-0013 과 비트 동일(net.log + 상태). 가방 박스 도입 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0013 logHash | 0014(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r13 = NET13.run(p);
      const r14 = run({ ...p });
      const okL = logDigest(r13) === logDigest(r14), okS = worldDigest(r13) === worldDigest(r14);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r13))}   | ${hex(logDigest(r14))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스(가방 ON·무열화) = 인프로세스 비트 동일 ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(가방 ON·토픽 버스·무열화) = 인프로세스 *비트 동일*(log+world+inv)·아이템 단일소유·itemDesync 0 ==');
  console.log('seed   | 시나리오    | 프로세스 | log동일 | world동일 | inv동일 | minted/transfer | 소유자 | itemDesync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic-inv', INV(seed)], ['failover-inv', FAILS_INV(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okW = worldDigest(a) === worldDigest(b);
      const okI = invDigest(a) === invDigest(b);
      const mo = maxItemBeliefOwners(b);
      const dI = itemDesync(b);
      const cons = itemConserved(b) && ledgerConsistent(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름`) &&
        check(okW, `seed ${seed} ${name}: 월드 상태 다름`) &&
        check(okI, `seed ${seed} ${name}: 원장 다름`) &&
        check(cons, `seed ${seed} ${name}: 원장 보존/정합 깨짐`) &&
        check(mo <= 1, `seed ${seed} ${name}: 아이템 belief 소유자 ${mo}(split)`) &&
        check(dI === 0, `seed ${seed} ${name}: itemDesync ${dI}`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(11)} | ${pad(b.cluster.pids.length, 8)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okW ? '예' : '아니오').padEnd(8)} | ${(okI ? '예' : '아니오').padEnd(6)} | ${pad(b.inventory.minted + '/' + b.inventory.transfers, 15)} | ${pad(mo, 6)} | ${pad(dI, 10)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── sacred: 신성한 tick — 가방이 시뮬에 비-침습(월드 비트 동일)이면서 실제 일한다(이 step 의 한 조각) ──
function sacred(seeds) {
  console.log('== sacred: *신성한 tick* — 가방 ON vs OFF 월드 상태 *비트 동일*(시뮬 비-침습) · 가방은 실제 일함 · 존 도달 item 0 ==');
  console.log('seed   | world동일(on=off) | minted | transfer | fail | 존도달item | inv onTick | invHash(on) | 판정');
  for (const seed of seeds) {
    const off = run(BASE(seed));            // 가방 없음(0013 토폴로지)
    const on = run(INV(seed));              // 가방 분리(별도 itemRng·별도 채널)
    const okW = worldDigest(off) === worldDigest(on);   // 가방이 월드 시뮬에 비-침습
    const worked = on.inventory && on.inventory.minted > 0 && on.inventory.transfers > 0;
    const toZones = itemMsgsToZones(on);
    const invHasTick = typeof (on.inventory && on.inventory.onTick) === 'function';   // 신성한 tick = 가방 onTick 0
    const ok =
      check(okW, `seed ${seed}: 월드 상태가 가방 도입으로 변함(시뮬 침습)`) &&
      check(worked, `seed ${seed}: 가방 미작동(minted ${on.inventory ? on.inventory.minted : 0}·transfer ${on.inventory ? on.inventory.transfers : 0})`) &&
      check(toZones === 0, `seed ${seed}: item 메시지가 존에 ${toZones}건 도달(신성한 tick 침습)`) &&
      check(!invHasTick, `seed ${seed}: inventory 가 onTick 보유(tick 동기 — 신성한 tick 밖 아님)`);
    console.log(`${pad(seed, 6)} | ${(okW ? '예' : '아니오').padEnd(16)} | ${pad(on.inventory.minted, 6)} | ${pad(on.inventory.transfers, 8)} | ${pad(on.inventory.failedOps, 4)} | ${pad(toZones, 10)} | ${(invHasTick ? '있음' : '없음').padEnd(10)} | ${hex(invDigest(on))}  | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 아이템 트랜잭션은 존을 *우회*해 inventory 서비스로(존 net.log·상태 불변) — 시뮬 tick 엔 시뮬만. 가방은 tick 무관 순수 반응형.');
}

// ── ownership: 권위 단일 소유(아이템) — 단일 소유·conserved·consistent·수렴·열화 내성 ──
function ownership(seeds) {
  console.log('== ownership: 아이템 = 매 시점 소유자 1 · conserved(dupe·loss 0) · consistent(쌍 거래 원자성) · itemDesync 0 · 열화 보존 ==');
  console.log('seed   | belief소유자 | conserved | consistent | itemDesync | [열화]conserved | [열화]consistent | 거부(fail) | 판정');
  for (const seed of seeds) {
    const r = run(INV(seed));               // 행복 경로
    const d = run(DEGRADE(seed));           // 가방 홉 열화(redundancy+loss)
    const mo = maxItemBeliefOwners(r);
    const dI = itemDesync(r);
    const okC = itemConserved(r) && ledgerConsistent(r);
    const okDC = itemConserved(d), okDK = ledgerConsistent(d);
    const ok =
      check(mo === 1, `seed ${seed}: 아이템 belief 소유자 ${mo}(split-brain)`) &&
      check(okC, `seed ${seed}: 원장 보존/정합 깨짐(행복)`) &&
      check(dI === 0, `seed ${seed}: itemDesync ${dI}(belief 미수렴)`) &&
      check(okDC, `seed ${seed}: 열화 아래 원장 미보존(dupe/loss)`) &&
      check(okDK, `seed ${seed}: 열화 아래 원장 정합 깨짐(비-원자 give)`) &&
      check(maxZoneOwners(r) === 1, `seed ${seed}: 존 소유자 ${maxZoneOwners(r)}`);
    console.log(`${pad(seed, 6)} | ${pad(mo, 12)} | ${(okC ? '예' : '아니오').padEnd(9)} | ${(okC ? '예' : '아니오').padEnd(10)} | ${pad(dI, 10)} | ${(okDC ? '예' : '아니오').padEnd(15)} | ${(okDK ? '예' : '아니오').padEnd(16)} | ${pad(d.inventory.failedOps, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 이동 = release(from)+acquire(to) 쌍 거래(한 onMsg 원자). 옮긴 아이템 재-give 는 owner≠from 으로 거부 → 중복 이동 0. 전송 dedup 으로 열화에도 보존.');
}

// ── isolate: inventory = 자기 OS 프로세스·broker/타 호스트와 다름·통신은 버스 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: inventory = *구분되는 OS 프로세스*(pid)·broker/타 호스트와 다름 · 원장 비어있지 않음 · 통신=버스 프레임뿐 ==');
  const seed = seeds[0];
  const b = await runMulti(INV(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const hostPid = new Map(C.pidByHost);
  const invPid = hostPid.get('inventory');
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(invPid != null && invPid !== C.parentPid, `inventory pid(${invPid}) 가 broker(${C.parentPid})와 같음/부재`) &&
    check(C.placement.some(([a]) => a === 'inventory'), `inventory 가 배치에 없음`) &&
    check(b.inventory && b.inventory.ledger.size > 0, `원장 비어있음(가방 미작동)`) &&
    check(C.frames > 0 && C.framesIn > 0, `버스 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · inventory pid ${invPid} · 원장 ${b.inventory.ledger.size}아이템(minted ${b.inventory.minted}·transfer ${b.inventory.transfers}) · 토픽 ${C.topics.length}개 · 버스 out ${C.frames}/${C.socketBytes}B`);
  console.log('  배치(addr → host → pid):');
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(10)} → ${host.padEnd(10)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 가방 ON 에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 가방 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · inventory/item_req/원장/내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 가방 쓴 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...INV(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /inventory/i.test(probe) || /item_req/i.test(probe) || /ledger/i.test(probe) || /byOwner/i.test(probe) || /reqAvatar/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const usedItems = r.clients.filter(c => c.items && c.items.size > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${pad(usedItems + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 클라는 item_pickup/item_give(itemId·toAvatar) 만 게이트웨이로 — inventory 주소·원장·item_req 는 *서버간* 경계(비가시).');
}

// ── repro: 같은 시드 멀티프로세스(가방) 2회 → 같은 원장+월드 + 인프로세스와도 동일 ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(가방) 2회 → 같은 원장+월드 + 인프로세스와도 동일(결정론) ==');
  console.log('seed   | inv 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | world 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run(INV(seed));
    const m1 = await runMulti(INV(seed));
    const m2 = await runMulti(INV(seed));
    const d1 = invDigest(m1), d2 = invDigest(m2), di = invDigest(inp);
    const w = worldDigest(m1) === worldDigest(inp) && worldDigest(m1) === worldDigest(m2);
    digests.add(d1);
    const ok =
      check(d1 === d2, `seed ${seed}: 멀티 2회 원장 다름 (${hex(d1)} != ${hex(d2)})`) &&
      check(d1 === di, `seed ${seed}: 멀티 != 인프로세스 (${hex(d1)} != ${hex(di)})`) &&
      check(w, `seed ${seed}: world 다름`);
    console.log(`${pad(seed, 6)} | ${hex(d1)}    | ${(d1 === d2 ? 'OK' : 'FAIL').padEnd(12)} | ${(d1 === di ? 'OK' : 'FAIL').padEnd(14)} | ${(w ? 'OK' : 'FAIL').padEnd(10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 원장 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 가방 서비스 분리 — 아이템 원장이 존 tick 밖 비동기 서비스로(신성한 tick) · 단일 소유 · E2E 비트 동일 ==');
  for (const seed of seeds) {
    const a = run(INV(seed));
    const b = await runMulti(INV(seed));
    const C = b.cluster;
    const ok = logDigest(a) === logDigest(b) && worldDigest(a) === worldDigest(b) && invDigest(a) === invDigest(b)
      && itemConserved(b) && ledgerConsistent(b) && maxItemBeliefOwners(b) === 1 && itemDesync(b) === 0 && itemMsgsToZones(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · TCP :${C.port} · 원장 ${b.inventory.ledger.size}아이템(mint ${b.inventory.minted}·xfer ${b.inventory.transfers}·fail ${b.inventory.failedOps}) · 존도달item ${itemMsgsToZones(b)} · 소유자 ${maxItemBeliefOwners(b)} · itemDesync ${itemDesync(b)} · log동일 ${logDigest(a) === logDigest(b)} · inv동일 ${invDigest(a) === invDigest(b)} | ${hex(invDigest(b))}`);
  }
  console.log('가방 = 별 프로세스·tick 무관 순수 반응형 서비스 · 아이템 이동 = 쌍 거래(dupe 0) · 존 우회(신성한 tick) · 가방 OFF 면 0013 비트 동일');
}

// ── CLI ──
// MODES — run.js 의 modesOf 정적 스캔이 모드 토큰을 추출(spine 회귀 사슬이 reg 자동 선택). await 는 동기 함수에도 무해.
const MODES = { reg, e2e, sacred, ownership, isolate, hide, repro };
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  if (MODES[mode]) await MODES[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    sacred(seedArg); console.log('');
    ownership(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | sacred | ownership | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
