// HktInfra step-0006 — 헤드리스 검증 (공간 분할 + 존 간 권위 핸드오프)
// 사용: node step-0006/verify.js <mode> [seed]
//   mode: reg | handoff | aoi | life | hide | repro | all
//     reg     — 회귀 0: 분할 끔(zones=1)이면 step-0005 와 *비트 동일*(net.log + 상태 다이제스트).
//     handoff — 권위 보존: 매 tick 소유자=1(공백·이중쓰기 0, in-flight 토큰까지 보존)·경계 넘은 엔터티가
//               정확히 한 번 이주·핸드오프 지연 N tick. 분할(zones=2)이 실제로 발동(handoffs>0).
//     aoi     — 경계 AOI 연속: 각 클라 seen == *전 존 합산* 반경 R 그라운드 트루스(존 경계 ≠ AOI 경계).
//               경계 횡단 가시(다른 존 소유 엔터티를 본 사례)가 실제로 발생함을 함께 보인다.
//     life    — 수명주기: 떠난 엔터티가 주변 클라 AOI 에서 사라지고 *소유 존*에서 제거(핸드오프 후에도).
//     hide    — 은닉: 클라는 게이트웨이만. 내부 토폴로지(zone/zone2/registry/sessionId/handoff) 누설 0.
//     repro   — 재현: 같은 시드 → 같은 상태(위치+소유존+AOI). 시드 의사난수만(Math.random 0).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, fnv1a, globalAoiTruth, ownerOf, PUBLIC_ADDRS } = NET;
const NET5 = require('../step-0005/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
// 멀티 존 시나리오 tick — 클라가 30 이동 후 정착(settled)하고, 경계 횡단 뷰가 *완전 수렴*하기까지의
// 드레인 여유를 둔다. 뷰 경로는 2홉(존→게이트웨이→클라) + ghost 1틱 지연 ≈ 3틱 지체 → 정착 후
// 몇 틱은 정지·수렴해야 seen == 최종 그라운드 트루스(존 경계 너머까지). 0005 는 40 으로 충분했으나
// 분할의 cross-zone 지연이 더해져 48 로 둔다(eventual consistency, 지연 상한 내 수렴). reg 은 0005
// 대조라 40 고정.
const SC = 48;
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

// net.log 를 from>to:payload 문자열 사슬로 — 전송 메시지 시퀀스의 비트 다이제스트(reg 대조).
function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// 상태 다이제스트 — 전 존 합산 엔터티 위치 + 각 클라 가시 집합(존 무관, reg 양쪽 호환).
function stateDigest(r) {
  const zones = r.zones || [r.zone];
  const ents = [];
  for (const z of zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
// repro 용 — 위치 + 소유 존 + AOI 까지 포함(분할 상태가 같은 시드에 같은가)
function fullDigest(r) {
  const owns = r.clients.map(c => c.avatar + '@' + (ownerOf(r, c.avatar) || '-')).sort().join(';');
  return fnv1a(hex(stateDigest(r)) + '|' + owns);
}

// ── reg: 분할 끔(zones=1) == step-0005 비트 동일 ──
function reg(seeds) {
  console.log('== reg: 분할 끔(zones=1) → step-0005 와 비트 동일(net.log + 상태). 회귀 0 ==');
  console.log('seed   | 0005 logHash | 0006(z1) logHash | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const p = { seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16 };
    const r5 = NET5.run(p);
    const r6 = run({ ...p, zones: 1 });
    const l5 = logDigest(r5), l6 = logDigest(r6);
    const s5 = stateDigest(r5), s6 = stateDigest(r6);
    const okL = l5 === l6, okS = s5 === s6;
    check(okL, `seed ${seed}: net.log 다름 (${hex(l5)} != ${hex(l6)})`);
    check(okS, `seed ${seed}: 상태 다름 (${hex(s5)} != ${hex(s6)})`);
    console.log(`${pad(seed, 6)} | ${hex(l5)}   | ${hex(l6)}       | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
  }
}

// ── handoff: 권위 보존(매 tick 소유자=1) + 경계 횡단 1회 이주 + 지연 ──
function handoff(seeds) {
  console.log('== handoff: 권위 보존(매 tick 소유자+in-flight=1, 이중쓰기 0) + 경계 횡단 이주 + 지연 ==');
  console.log('seed   | 핸드오프 | 이중쓰기 tick | 공백 tick | 최대지연 | 분할발동 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2 });
    // 매 tick: committed 소유자 수<=1(이중쓰기 0), committed+inflight==1 for every live avatar(공백 0)
    let doubleWrite = 0, gaps = 0;
    for (const t of r.trace) {
      for (const [, cnt] of t.committed) if (cnt > 1) doubleWrite++;
      const seen = new Set();
      for (const av of t.committed.keys()) seen.add(av);
      for (const av of t.inflight) {
        // in-flight 인 avatar 가 committed 에도 있으면 = 이중(보존 위반)
        if (t.committed.has(av)) doubleWrite++;
        seen.add(av);
      }
      // 보존: 모든 live(committed∪inflight) avatar 는 committed(==1) 또는 inflight(==1) 중 정확히 하나
      for (const av of seen) {
        const c = t.committed.get(av) || 0;
        const f = t.inflight.filter(x => x === av).length;
        if (c + f !== 1) gaps++;
      }
    }
    // 핸드오프 지연 = release(토큰 버스 진입) → acquire(소유 전환)까지 tick = *avatar 별* in-flight 연속 구간.
    // 존→존 핸드오프는 행복 경로(전송 모델 미적용)라 구조적으로 1 tick(다음 tick 배달)이어야 한다.
    const run_ = new Map(); let maxLatency = 0;
    for (const t of r.trace) {
      const now = new Set(t.inflight);
      for (const av of now) { run_.set(av, (run_.get(av) || 0) + 1); if (run_.get(av) > maxLatency) maxLatency = run_.get(av); }
      for (const av of [...run_.keys()]) if (!now.has(av)) run_.delete(av);
    }
    const handoffs = r.totals.handoffs;
    const ok =
      check(doubleWrite === 0, `seed ${seed}: 이중쓰기 ${doubleWrite} tick(소유자>1)`) &&
      check(gaps === 0, `seed ${seed}: 권위 공백/중복 ${gaps} (committed+inflight!=1)`) &&
      check(handoffs > 0, `seed ${seed}: 분할 미발동(핸드오프 0 — 경계 횡단 테스트 무의미)`);
    console.log(`${pad(seed, 6)} | ${pad(handoffs, 8)} | ${pad(doubleWrite, 13)} | ${pad(gaps, 9)} | ${pad(maxLatency, 8)} | ${(handoffs > 0 ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── aoi: 경계 AOI 연속 — seen == 전 존 합산 그라운드 트루스 + 경계 횡단 가시 발생 ──
function aoi(seeds) {
  console.log('== aoi: 경계 AOI 연속 — 각 클라 seen == 전 존 합산 반경 R 트루스(존 경계 ≠ AOI 경계) ==');
  console.log('seed   | 클라 | 매칭 | 횡단가시 사례 | 평균 가시 | AOI 절감 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2 });
    let match = 0, visSum = 0, crossSeen = 0;
    for (const c of r.clients) {
      const truth = globalAoiTruth(r, c.avatar);
      if (truth && JSON.stringify(c.seenIds()) === JSON.stringify(truth)) match++;
      visSum += c.seenIds().length;
      // 횡단 가시: 내가 한 존에, 내가 본 다른 엔터티가 다른 존 소유 → 존 경계 너머를 봄
      const myZone = ownerOf(r, c.avatar);
      for (const id of c.seenIds()) if (id !== c.avatar && ownerOf(r, id) && ownerOf(r, id) !== myZone) { crossSeen++; break; }
    }
    const save = (1 - r.totals.sent / r.totals.fullAssumed) * 100;
    const ok =
      check(match === r.clients.length, `seed ${seed}: seen!=전존 트루스 (${match}/${r.clients.length})`) &&
      check(r.totals.sent < r.totals.fullAssumed, `seed ${seed}: AOI 필터가 아무것도 안 줄임`);
    console.log(`${pad(seed, 6)} | ${pad(r.clients.length, 4)} | ${pad(match + '/' + r.clients.length, 4)} | ${pad(crossSeen, 13)} | ${pad((visSum / r.clients.length).toFixed(2), 9)} | ${pad(save.toFixed(1) + '%', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── life: 떠난 엔터티가 주변 AOI 에서 사라지고 소유 존에서 제거(핸드오프 후에도) ──
function life(seeds) {
  console.log('== life: 떠난 엔터티가 주변 클라 AOI 에서 사라짐 + 소유 존에서 제거(분할·핸드오프 후) ==');
  console.log('seed   | 떠난 엔터티 | 베이스라인 관측자 | 떠난 뒤 잔존 | 어느 존에도 없음 | 판정');
  for (const seed of seeds) {
    const base = run({ seed, ticks: SC, clients: 5, moves: 30, radius: 8, grid: 16, zones: 2 });
    const target = base.clients[0].avatar;
    const observersBase = base.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const left = run({ seed, ticks: SC, clients: 5, moves: 30, radius: 8, grid: 16, zones: 2, leave: { 0: 20 } });
    const observersAfter = left.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const removed = ownerOf(left, target) === null;
    const ok =
      check(observersBase.length > 0, `seed ${seed}: ${target} 관측자 없음(테스트 무의미)`) &&
      check(observersAfter.length === 0, `seed ${seed}: 떠난 ${target} 가 ${observersAfter.join(',')} 의 AOI 에 잔존`) &&
      check(removed, `seed ${seed}: 어느 존에도 ${target} 미제거`);
    console.log(`${pad(seed, 6)} | ${pad(target, 11)} | ${pad(observersBase.length, 17)} | ${pad(observersAfter.length, 12)} | ${(removed ? '예' : '아니오').padEnd(16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: 클라는 게이트웨이만. 내부 토폴로지(존 둘·핸드오프) 누설 0 ──
function hide(seeds) {
  console.log('== hide: 클라 접점이 공개 주소(login·gateway)뿐 + 내부(zone/zone2/registry/sessionId/handoff) 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16, zones: 2 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) || /handoff/i.test(probe) || /ghost/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드 → 같은 상태(위치+소유존+AOI). Math.random 0 ──
function repro(seeds) {
  console.log('== repro: 같은 시드 → 같은 상태(위치+소유존+AOI). 시드 의사난수만(Math.random 0) ==');
  console.log('seed   | full 다이제스트 | 2회 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const a = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2 });
    const b = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2 });
    const da = fullDigest(a), db = fullDigest(b);
    digests.add(da);
    const ok = check(da === db, `seed ${seed}: 같은 시드 상태 다름 (${hex(da)} != ${hex(db)})`);
    console.log(`${pad(seed, 6)} | ${hex(da)}      | ${(da === db ? 'OK' : 'FAIL').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──────────────────────────────────────────────────────────────
function summary(seeds) {
  console.log('== summary: 분할 존 2개 — 경계 핸드오프(소유자=1) + 경계 띠 상호 구독 + AOI 연속 ==');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2 });
    let match = 0;
    for (const c of r.clients) { const t = globalAoiTruth(r, c.avatar); if (t && JSON.stringify(c.seenIds()) === JSON.stringify(t)) match++; }
    const save = (1 - r.totals.sent / r.totals.fullAssumed) * 100;
    const ok = match === r.clients.length;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: AOI 연속 ${match}/${r.clients.length} ${ok ? 'OK' : 'FAIL'} · 핸드오프 ${r.totals.handoffs} · 경계구독 ${r.totals.ghostEnts}건 · 절감 ${save.toFixed(1)}% · 상태 ${hex(fullDigest(r))}`);
  }
  console.log('분할 존 = net-core/EntityZone × 2(region [0,8)/[8,16)·band=R) · 시뮬 0 · 권위 토큰 보존 · 시드 의사난수만');
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, handoff, aoi, life, hide, repro };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  handoff(seedArg); console.log('');
  aoi(seedArg); console.log('');
  life(seedArg); console.log('');
  hide(seedArg); console.log('');
  repro(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | handoff | aoi | life | hide | repro | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
