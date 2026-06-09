// HktInfra step-0007 — 헤드리스 검증 (증분 AOI: 전체 스냅샷 → enter/exit/update 증분)
// 사용: node step-0007/verify.js <mode> [seed]
//   mode: reg | delta | bw | aoi | handoff | life | hide | repro | all
//     reg     — 회귀 0: 증분 끔(incremental=false)이면 step-0006 와 *비트 동일*(net.log + 상태). zones 1·2 모두.
//     delta   — 증분 정확: 클라가 증분만 누적 적용해 재구성한 가시 집합(위치 포함)이 *전체 스냅샷* 가시 집합과
//               *매 tick 전 클라* 동일. 증분 ≡ 전체 스냅샷(인코딩만 다름).
//     bw      — 대역폭: 증분 총 레코드 vs 전체 스냅샷 건수(절감 %)·정지 시 증분 0 수렴(꼬리 tick 합=0)·reset 수.
//     aoi     — 경계 AOI 연속(증분): 각 클라 seen == 전 존 합산 트루스 + 경계 너머(다른 존 ghost) enter 사례.
//     handoff — 권위 보존(0006 불변 유지): 매 tick 소유자+in-flight=1(이중쓰기·공백 0)·경계 횡단 발동.
//     life    — 수명주기: 떠난 엔터티가 주변 클라 seen 에서 *exit 증분*으로 사라지고 소유 존에서 제거.
//     hide    — 은닉: 클라는 게이트웨이만. view_delta 도 내부(zone/sessionId/handoff/ghost) 누설 0.
//     repro   — 재현: 같은 시드 → 같은 상태(위치+소유존+seen). 시드 의사난수만(Math.random 0).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, fnv1a, globalAoiTruth, ownerOf, PUBLIC_ADDRS } = NET;
const NET6 = require('../step-0006/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
// 증분의 cross-zone 수렴 여유는 0006 과 동일(뷰 2홉 + ghost 1틱 ≈ 3틱). 48 tick 유지. reg 은 0006 기본 40.
const SC = 48;
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

// net.log 를 from>to:payload 사슬로 — 전송 시퀀스 비트 다이제스트(reg 대조).
function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// 상태 다이제스트 — 전 존 합산 엔터티 위치 + 각 클라 가시 집합(존 무관).
function stateDigest(r) {
  const zones = r.zones || [r.zone];
  const ents = [];
  for (const z of zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
// repro 용 — 위치 + 소유 존 + 가시(위치 포함)까지
function fullDigest(r) {
  const owns = r.clients.map(c => c.avatar + '@' + (ownerOf(r, c.avatar) || '-')).sort().join(';');
  const sig = r.clients.map(c => c.avatar + ':' + c.seenSig()).sort().join('|');
  return fnv1a(hex(stateDigest(r)) + '|' + owns + '#' + sig);
}

// ── reg: 증분 끔(incremental=false) == step-0006 비트 동일 (zones 1·2 모두) ──
function reg(seeds) {
  console.log('== reg: 증분 끔(incremental=false) → step-0006 와 비트 동일(net.log + 상태). 회귀 0 ==');
  console.log('seed   | zones | 0006 logHash | 0007(inc off) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    for (const zones of [1, 2]) {
      const p = { seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16, zones };
      const r6 = NET6.run(p);
      const r7 = run({ ...p, incremental: false });
      const l6 = logDigest(r6), l7 = logDigest(r7);
      const s6 = stateDigest(r6), s7 = stateDigest(r7);
      const okL = l6 === l7, okS = s6 === s7;
      check(okL, `seed ${seed} zones${zones}: net.log 다름 (${hex(l6)} != ${hex(l7)})`);
      check(okS, `seed ${seed} zones${zones}: 상태 다름 (${hex(s6)} != ${hex(s7)})`);
      console.log(`${pad(seed, 6)} | ${pad(zones, 5)} | ${hex(l6)}   | ${hex(l7)}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── delta: 증분 정확 — 증분 재구성 seen == 전체 스냅샷 seen, 매 tick 전 클라(위치 포함) ──
function delta(seeds) {
  console.log('== delta: 증분 재구성 가시(위치 포함) == 전체 스냅샷 가시 — 매 tick 전 클라 동일 ==');
  console.log('seed   | tick×클라 | 불일치 | reset | 증분 적용 | 판정');
  for (const seed of seeds) {
    const inc = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    const full = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    let mismatch = 0, cells = 0;
    for (let t = 0; t < SC; t++) {
      const a = inc.seenTrace[t], b = full.seenTrace[t];
      for (let c = 0; c < a.length; c++) { cells++; if (a[c] !== b[c]) mismatch++; }
    }
    const applied = inc.clients.reduce((s, c) => s + c.deltasApplied, 0);
    const ok =
      check(mismatch === 0, `seed ${seed}: 증분 재구성 != 전체 스냅샷 (${mismatch}/${cells} 불일치)`) &&
      check(applied > 0, `seed ${seed}: 증분 적용 0(증분 경로 미발동)`);
    console.log(`${pad(seed, 6)} | ${pad(cells, 9)} | ${pad(mismatch, 6)} | ${pad(inc.totals.resets, 5)} | ${pad(applied, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── bw: 대역폭 — 증분 레코드 vs 전체 스냅샷, 정지 시 0 수렴 ──
function bw(seeds) {
  console.log('== bw: 증분 총 레코드 vs 전체 스냅샷 건수(절감 %)·정지 시 증분 0 수렴(꼬리 8tick=tick 41~48) ==');
  console.log('seed   | 전체스냅샷 | 증분(E/X/U) | 증분합 | 절감 | 꼬리8 증분 | reset | 판정');
  for (const seed of seeds) {
    const inc = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    const full = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    const baseline = full.totals.sent;             // 전체 스냅샷이 보낸 엔터티 건수
    const dRec = inc.totals.deltaRecords;          // 증분 총 레코드(enter+exit+update)
    const tail = inc.deltaTrace.slice(-8).reduce((a, b) => a + b, 0);  // 꼬리 8 tick 증분(정착·수렴 후 → 0)
    const save = (1 - dRec / baseline) * 100;
    const exu = inc.totals.deltaEnter + '/' + inc.totals.deltaExit + '/' + inc.totals.deltaUpdate;
    const ok =
      check(dRec < baseline, `seed ${seed}: 증분이 전체 스냅샷보다 안 작음 (${dRec} >= ${baseline})`) &&
      check(tail === 0, `seed ${seed}: 정지 후 꼬리 8tick 증분 ${tail}(0 수렴 실패)`);
    console.log(`${pad(seed, 6)} | ${pad(baseline, 10)} | ${pad(exu, 11)} | ${pad(dRec, 6)} | ${pad(save.toFixed(1) + '%', 6)} | ${pad(tail, 10)} | ${pad(inc.totals.resets, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── aoi: 경계 AOI 연속(증분) — seen == 전 존 합산 트루스 + 경계 횡단 가시 ──
function aoi(seeds) {
  console.log('== aoi: 증분 경계 AOI 연속 — 각 클라 seen == 전 존 합산 반경 R 트루스(존 경계 ≠ AOI 경계) ==');
  console.log('seed   | 클라 | 매칭 | 횡단가시 사례 | 평균 가시 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    let match = 0, visSum = 0, crossSeen = 0;
    for (const c of r.clients) {
      const truth = globalAoiTruth(r, c.avatar);
      if (truth && JSON.stringify(c.seenIds()) === JSON.stringify(truth)) match++;
      visSum += c.seenIds().length;
      const myZone = ownerOf(r, c.avatar);
      for (const id of c.seenIds()) if (id !== c.avatar && ownerOf(r, id) && ownerOf(r, id) !== myZone) { crossSeen++; break; }
    }
    const ok = check(match === r.clients.length, `seed ${seed}: seen!=전존 트루스 (${match}/${r.clients.length})`);
    console.log(`${pad(seed, 6)} | ${pad(r.clients.length, 4)} | ${pad(match + '/' + r.clients.length, 4)} | ${pad(crossSeen, 13)} | ${pad((visSum / r.clients.length).toFixed(2), 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── handoff: 권위 보존(0006 불변) 유지 — 증분이 권위에 영향 없음 ──
function handoff(seeds) {
  console.log('== handoff: 권위 보존(매 tick 소유자+in-flight=1, 이중쓰기 0) + 경계 횡단 — 증분 후에도 불변 ==');
  console.log('seed   | 핸드오프 | 이중쓰기 tick | 공백 tick | 최대지연 | 분할발동 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    let doubleWrite = 0, gaps = 0;
    for (const t of r.trace) {
      for (const [, cnt] of t.committed) if (cnt > 1) doubleWrite++;
      const seen = new Set();
      for (const av of t.committed.keys()) seen.add(av);
      for (const av of t.inflight) { if (t.committed.has(av)) doubleWrite++; seen.add(av); }
      for (const av of seen) {
        const c = t.committed.get(av) || 0;
        const f = t.inflight.filter(x => x === av).length;
        if (c + f !== 1) gaps++;
      }
    }
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
      check(handoffs > 0, `seed ${seed}: 분할 미발동(핸드오프 0)`);
    console.log(`${pad(seed, 6)} | ${pad(handoffs, 8)} | ${pad(doubleWrite, 13)} | ${pad(gaps, 9)} | ${pad(maxLatency, 8)} | ${(handoffs > 0 ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── life: 떠난 엔터티가 주변 클라 seen 에서 exit 증분으로 사라지고 소유 존에서 제거 ──
function life(seeds) {
  console.log('== life: 떠난 엔터티가 주변 클라 seen 에서 exit 증분으로 사라짐 + 소유 존에서 제거 ==');
  console.log('seed   | 떠난 엔터티 | 베이스라인 관측자 | 떠난 뒤 잔존 | 어느 존에도 없음 | 판정');
  for (const seed of seeds) {
    const base = run({ seed, ticks: SC, clients: 5, moves: 30, radius: 8, grid: 16, zones: 2, incremental: true });
    const target = base.clients[0].avatar;
    const observersBase = base.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const left = run({ seed, ticks: SC, clients: 5, moves: 30, radius: 8, grid: 16, zones: 2, incremental: true, leave: { 0: 20 } });
    const observersAfter = left.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const removed = ownerOf(left, target) === null;
    const ok =
      check(observersBase.length > 0, `seed ${seed}: ${target} 관측자 없음(테스트 무의미)`) &&
      check(observersAfter.length === 0, `seed ${seed}: 떠난 ${target} 가 ${observersAfter.join(',')} 의 seen 에 잔존`) &&
      check(removed, `seed ${seed}: 어느 존에도 ${target} 미제거`);
    console.log(`${pad(seed, 6)} | ${pad(target, 11)} | ${pad(observersBase.length, 17)} | ${pad(observersAfter.length, 12)} | ${(removed ? '예' : '아니오').padEnd(16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: 클라는 게이트웨이만. view_delta 도 내부 토폴로지 누설 0 ──
function hide(seeds) {
  console.log('== hide: 클라 접점이 공개 주소(login·gateway)뿐 + view_delta 내부(zone/sessionId/handoff/ghost) 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
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

// ── repro: 같은 시드 → 같은 상태(위치+소유존+seen). Math.random 0 ──
function repro(seeds) {
  console.log('== repro: 같은 시드 → 같은 상태(위치+소유존+seen). 시드 의사난수만(Math.random 0) ==');
  console.log('seed   | full 다이제스트 | 2회 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const a = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    const b = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    const da = fullDigest(a), db = fullDigest(b);
    digests.add(da);
    const ok = check(da === db, `seed ${seed}: 같은 시드 상태 다름 (${hex(da)} != ${hex(db)})`);
    console.log(`${pad(seed, 6)} | ${hex(da)}      | ${(da === db ? 'OK' : 'FAIL').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──────────────────────────────────────────────────────────────
function summary(seeds) {
  console.log('== summary: 증분 AOI — enter/exit/update 로 가시 재구성(정지 시 0 수렴) + 0006 불변 유지 ==');
  for (const seed of seeds) {
    const inc = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true });
    const full = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    let mism = 0;
    for (let t = 0; t < SC; t++) for (let c = 0; c < inc.seenTrace[t].length; c++) if (inc.seenTrace[t][c] !== full.seenTrace[t][c]) mism++;
    const save = (1 - inc.totals.deltaRecords / full.totals.sent) * 100;
    const tail = inc.deltaTrace.slice(-8).reduce((a, b) => a + b, 0);
    const ok = mism === 0 && tail === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 증분≡전체 ${mism === 0 ? 'OK' : 'MISMATCH ' + mism} · 절감 ${save.toFixed(1)}% · 정지 꼬리 ${tail} · reset ${inc.totals.resets} · 핸드오프 ${inc.totals.handoffs} · 상태 ${hex(fullDigest(inc))}`);
  }
  console.log('증분 AOI = EntityZone ④ 뷰 발행을 view(전체) → view_delta(enter/exit/update)로 · prevSeen 기준 · 세션 이주 시 reset · 시뮬 0');
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, delta, bw, aoi, handoff, life, hide, repro };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  delta(seedArg); console.log('');
  bw(seedArg); console.log('');
  aoi(seedArg); console.log('');
  handoff(seedArg); console.log('');
  life(seedArg); console.log('');
  hide(seedArg); console.log('');
  repro(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | delta | bw | aoi | handoff | life | hide | repro | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
