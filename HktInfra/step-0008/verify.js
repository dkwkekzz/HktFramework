// HktInfra step-0008 — 헤드리스 검증 (전송 열화 아래 핸드오프 + 반응적 복원)
// 사용: node step-0008/verify.js <mode> [seed]
//   mode: reg | handoff | authrec | deltarec | curve | hide | repro | all
//     reg      — 회귀 0: recovery 끔(recovery=false)·transport 없음 → step-0007 와 *비트 동일*(net.log + 상태). zones 1·2.
//     handoff  — 권위 보존(행복, recovery on·무손실): 매 tick 소유자+in-flight=1·이중쓰기 0·ack==handoff·증분≡전체(복원층 비파괴).
//     authrec  — 권위 복원: 핸드오프 토큰 유실 주입. recovery off → *권위 공백*(엔터티 소실). recovery on → 권위-of-record 로
//                공백 0·이중쓰기 0·소유자=1 유지·전 엔터티 생존, 재전송>0(유실 발생·복원 증명).
//     deltarec — 증분 복원: 증분 델타 유실 주입. recovery off → 클라 seen *영구 desync*(자가치유 상실). recovery on →
//                seq 감지→NAK→keyframe 재동기(+heartbeat 꼬리 상한)로 최종 desync 0, NAK·강제 키프레임>0.
//     curve    — 열화 곡선: 손실률↑ 에 따른 복원 오버헤드(재전송·NAK·키프레임)와 수렴(공백 0·최종 desync 0).
//     hide     — 은닉: 복원(seq/NAK/keyframe) 후에도 클라는 게이트웨이만·내부 토폴로지 누설 0.
//     repro    — 재현: 같은 시드+transport → 같은 상태(손실 패턴도 시드 결정론). Math.random 0.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, routeFilters, fnv1a, authorityCount, ownerOf, PUBLIC_ADDRS } = NET;
const NET7 = require('../step-0007/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const SC = 80;   // 복원 수렴 여유(꼬리). 손실 0.3 까지 최종 desync 0. reg 은 0007 대조라 40 tick·클라 4 고정.
const HANDOFF_TP = { seed: 0xBEEF, delayMin: 0, delayMax: 0, loss: 0.2, redundancy: 1, routeFilter: routeFilters.handoff };
const DELTA_TP = { seed: 0xD317A, delayMin: 0, delayMax: 0, loss: 0.2, redundancy: 1, routeFilter: routeFilters.delta };
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
function stateDigest(r) {
  const zones = r.zones || [r.zone];
  const ents = [];
  for (const z of zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
function fullDigest(r) {
  const owns = r.clients.map(c => c.avatar + '@' + (ownerOf(r, c.avatar) || '-')).sort().join(';');
  const sig = r.clients.map(c => c.avatar + ':' + c.seenSig()).sort().join('|');
  return fnv1a(hex(stateDigest(r)) + '|' + owns + '#' + sig);
}

// 권위 위반 집계 — 도입된 엔터티마다 매 tick authorityCount: 1 이어야(>1 이중쓰기·0 공백).
function authViolations(r) {
  let doubleWrite = 0, gaps = 0;
  const introduced = new Set();
  for (const t of r.trace) {
    for (const av of t.committed.keys()) introduced.add(av);
    for (const av of t.inflight) introduced.add(av);
    for (const av of introduced) {
      const a = authorityCount(t, av);
      if (a > 1) doubleWrite++;
      else if (a === 0) gaps++;
    }
  }
  return { doubleWrite, gaps };
}
// 최종 소실 엔터티 — 마지막 tick 에 소유자도 in-flight 도 없는(영구 공백) 도입 엔터티.
function lostFinal(r) {
  const introduced = new Set();
  for (const t of r.trace) { for (const av of t.committed.keys()) introduced.add(av); for (const av of t.inflight) introduced.add(av); }
  const last = r.trace[r.trace.length - 1];
  let lost = 0;
  for (const av of introduced) if (authorityCount(last, av) === 0) lost++;
  return lost;
}
// 최종 desync — 마지막 tick 각 클라 seen(위치 포함) vs 전체 스냅샷 트루스(같은 월드 타이밍).
function finalDesync(r, truth) {
  const a = r.seenTrace[r.seenTrace.length - 1], b = truth.seenTrace[truth.seenTrace.length - 1];
  let m = 0;
  for (let c = 0; c < a.length; c++) if (a[c] !== b[c]) m++;
  return m;
}

// ── reg: recovery 끔 → step-0007 비트 동일 ──
function reg(seeds) {
  console.log('== reg: recovery 끔(recovery=false)·transport 없음 → step-0007 와 비트 동일(net.log + 상태). 회귀 0 ==');
  console.log('seed   | zones | 0007 logHash | 0008(rec off) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    for (const zones of [1, 2]) {
      const p = { seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16, zones, incremental: true };
      const r7 = NET7.run(p);
      const r8 = run({ ...p, recovery: false });
      const l7 = logDigest(r7), l8 = logDigest(r8);
      const s7 = stateDigest(r7), s8 = stateDigest(r8);
      const okL = l7 === l8, okS = s7 === s8;
      check(okL, `seed ${seed} zones${zones}: net.log 다름 (${hex(l7)} != ${hex(l8)})`);
      check(okS, `seed ${seed} zones${zones}: 상태 다름 (${hex(s7)} != ${hex(s8)})`);
      console.log(`${pad(seed, 6)} | ${pad(zones, 5)} | ${hex(l7)}   | ${hex(l8)}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── handoff: 행복 경로(recovery on·무손실) — 복원층이 0007 불변을 깨지 않음 ──
function handoff(seeds) {
  console.log('== handoff: recovery on·무손실 — 매 tick 소유자+in-flight=1·이중쓰기 0·ack==handoff·증분≡전체(비파괴) ==');
  console.log('seed   | 핸드오프 | ack | 공백tick | 이중쓰기 | 증분≡전체 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
    const full = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    const v = authViolations(on);
    let mism = 0;
    for (let t = 0; t < SC; t++) for (let c = 0; c < on.seenTrace[t].length; c++) if (on.seenTrace[t][c] !== full.seenTrace[t][c]) mism++;
    const ok =
      check(v.gaps === 0, `seed ${seed}: 공백 ${v.gaps} tick`) &&
      check(v.doubleWrite === 0, `seed ${seed}: 이중쓰기 ${v.doubleWrite} tick`) &&
      check(on.totals.acksRx === on.totals.handoffs, `seed ${seed}: ack(${on.totals.acksRx}) != 핸드오프(${on.totals.handoffs})`) &&
      check(mism === 0, `seed ${seed}: 증분≡전체 깨짐 (${mism} 불일치)`);
    console.log(`${pad(seed, 6)} | ${pad(on.totals.handoffs, 8)} | ${pad(on.totals.acksRx, 3)} | ${pad(v.gaps, 8)} | ${pad(v.doubleWrite, 8)} | ${(mism === 0 ? '일치' : '깨짐').padEnd(9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── authrec: 핸드오프 토큰 유실 — recovery off(공백) vs on(권위-of-record 로 공백 0) ──
function authrec(seeds) {
  console.log('== authrec: 핸드오프 토큰 유실 주입 — OFF=권위 공백(엔터티 소실) vs ON=권위-of-record 복원(공백 0·소유자=1) ==');
  console.log('seed   | 유실 | OFF 공백tick | OFF 소실 | ON 공백tick | ON 이중쓰기 | ON 소실 | 재전송 | 판정');
  for (const seed of seeds) {
    const off = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: false, transport: { ...HANDOFF_TP } });
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...HANDOFF_TP } });
    const vOff = authViolations(off), vOn = authViolations(on);
    const lostOff = lostFinal(off), lostOn = lostFinal(on);
    const ok =
      check(on.totals.netLost > 0, `seed ${seed}: 토큰 유실 미발생(테스트 무의미)`) &&
      check(vOff.gaps > 0 || lostOff > 0, `seed ${seed}: OFF 가 공백을 안 보임(대조 실패)`) &&
      check(vOn.gaps === 0, `seed ${seed}: ON 권위 공백 ${vOn.gaps} tick`) &&
      check(vOn.doubleWrite === 0, `seed ${seed}: ON 이중쓰기 ${vOn.doubleWrite} tick`) &&
      check(lostOn === 0, `seed ${seed}: ON 엔터티 소실 ${lostOn}`) &&
      check(on.totals.retransmits > 0, `seed ${seed}: 재전송 0(복원 경로 미발동)`);
    console.log(`${pad(seed, 6)} | ${pad(on.totals.netLost, 4)} | ${pad(vOff.gaps, 12)} | ${pad(lostOff, 8)} | ${pad(vOn.gaps, 11)} | ${pad(vOn.doubleWrite, 11)} | ${pad(lostOn, 7)} | ${pad(on.totals.retransmits, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── deltarec: 증분 델타 유실 — recovery off(영구 desync) vs on(NAK/keyframe 재동기 → desync 0) ──
function deltarec(seeds) {
  console.log('== deltarec: 증분 델타 유실 주입 — OFF=영구 desync(자가치유 상실) vs ON=NAK/keyframe 재동기(최종 desync 0) ==');
  console.log('seed   | 유실 | OFF 최종desync | ON 최종desync | NAK | 강제KF | heartbeat | 판정');
  for (const seed of seeds) {
    const truth = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });  // 전체 스냅샷(같은 월드 타이밍 — 핸드오프 신뢰)
    const off = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: false, transport: { ...DELTA_TP } });
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP } });
    const dOff = finalDesync(off, truth), dOn = finalDesync(on, truth);
    const ok =
      check(on.totals.netLost > 0, `seed ${seed}: 델타 유실 미발생(테스트 무의미)`) &&
      check(dOff > 0, `seed ${seed}: OFF 가 desync 를 안 보임(대조 실패 — 유실이 가시집합에 안 닿음)`) &&
      check(dOn === 0, `seed ${seed}: ON 최종 desync ${dOn}(재동기 미수렴)`) &&
      check(on.totals.naksSent > 0, `seed ${seed}: NAK 0(손실 감지 미발동)`);
    console.log(`${pad(seed, 6)} | ${pad(on.totals.netLost, 4)} | ${pad(dOff, 14)} | ${pad(dOn, 13)} | ${pad(on.totals.naksSent, 3)} | ${pad(on.totals.keyframesForced, 6)} | ${pad(on.totals.heartbeats, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── curve: 손실률↑ 에 따른 복원 오버헤드 + 수렴(공백 0·최종 desync 0) ──
function curve(seeds) {
  console.log('== curve: 손실률↑ → 복원 오버헤드(재전송·NAK·키프레임) 성장 + 수렴(공백 0·최종 desync 0). 0004 curve 패턴 ==');
  console.log('-- 핸드오프 라우트 손실(권위 복원) — 공백/이중쓰기/소실은 손실률 무관 0(권위-of-record) --');
  console.log('loss  | 평균유실 | 공백 합 | 이중쓰기 합 | 소실 합 | 재전송 합 | 판정');
  for (const loss of [0, 0.05, 0.1, 0.2, 0.3]) {
    let netLost = 0, gaps = 0, dbl = 0, lost = 0, retx = 0;
    for (const seed of seeds) {
      const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...HANDOFF_TP, loss } });
      const v = authViolations(on);
      netLost += on.totals.netLost; gaps += v.gaps; dbl += v.doubleWrite; lost += lostFinal(on); retx += on.totals.retransmits;
    }
    const ok = check(gaps === 0 && dbl === 0 && lost === 0, `loss ${loss}: 권위 위반(공백 ${gaps}·이중 ${dbl}·소실 ${lost})`);
    console.log(`${pad(loss, 5)} | ${pad((netLost / seeds.length).toFixed(1), 8)} | ${pad(gaps, 7)} | ${pad(dbl, 11)} | ${pad(lost, 7)} | ${pad(retx, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('-- 델타 라우트 손실(증분 복원) — 최종 desync 0 으로 수렴, NAK/키프레임 오버헤드 성장 --');
  console.log('loss  | 평균유실 | 최종desync 합 | NAK 합 | 강제KF 합 | 판정');
  for (const loss of [0, 0.05, 0.1, 0.2, 0.3]) {
    let netLost = 0, dsync = 0, naks = 0, kf = 0;
    for (const seed of seeds) {
      const truth = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
      const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP, loss } });
      netLost += on.totals.netLost; dsync += finalDesync(on, truth); naks += on.totals.naksSent; kf += on.totals.keyframesForced;
    }
    const ok = check(dsync === 0, `loss ${loss}: 최종 desync 합 ${dsync}(수렴 실패)`);
    console.log(`${pad(loss, 5)} | ${pad((netLost / seeds.length).toFixed(1), 8)} | ${pad(dsync, 13)} | ${pad(naks, 6)} | ${pad(kf, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: 복원 후에도 클라는 게이트웨이만, 내부 누설 0 ──
function hide(seeds) {
  console.log('== hide: 복원(seq/NAK/keyframe) + 손실 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | NAK 보낸 클라 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 4, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP } });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) || /handoff/i.test(probe) || /ghost/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const nakers = r.clients.filter(c => c.naksSent > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${pad(nakers + '/' + r.clients.length, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드+transport → 같은 상태(손실 패턴도 결정론) ──
function repro(seeds) {
  console.log('== repro: 같은 시드+transport → 같은 상태(위치+소유존+seen). 손실 패턴도 시드 결정론(Math.random 0) ==');
  console.log('seed   | full 다이제스트 | 2회 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const a = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP } });
    const b = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP } });
    const da = fullDigest(a), db = fullDigest(b);
    digests.add(da);
    const ok = check(da === db, `seed ${seed}: 같은 시드 상태 다름 (${hex(da)} != ${hex(db)})`);
    console.log(`${pad(seed, 6)} | ${hex(da)}      | ${(da === db ? 'OK' : 'FAIL').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
function summary(seeds) {
  console.log('== summary: 반응적 복원 — 핸드오프(ack/재전송)·증분(seq/NAK/keyframe) 으로 전송 열화 아래 공백·desync 0 으로 복원 ==');
  for (const seed of seeds) {
    const ah = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...HANDOFF_TP } });
    const truth = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: false });
    const dd = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, transport: { ...DELTA_TP } });
    const v = authViolations(ah);
    const dOn = finalDesync(dd, truth);
    const ok = v.gaps === 0 && v.doubleWrite === 0 && lostFinal(ah) === 0 && dOn === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 핸드오프유실 ${ah.totals.netLost}→공백 ${v.gaps}·소실 ${lostFinal(ah)}·재전송 ${ah.totals.retransmits} | 델타유실 ${dd.totals.netLost}→최종desync ${dOn}·NAK ${dd.totals.naksSent}·KF ${dd.totals.keyframesForced} | 상태 ${hex(fullDigest(dd))}`);
  }
  console.log('반응적 복원 = 핸드오프 ack/재전송(권위-of-record outbox) + 증분 seq/NAK/keyframe(+heartbeat) · recovery=false 면 0007 비트 동일');
}

// ── CLI ──
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, handoff, authrec, deltarec, curve, hide, repro };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  handoff(seedArg); console.log('');
  authrec(seedArg); console.log('');
  deltarec(seedArg); console.log('');
  curve(seedArg); console.log('');
  hide(seedArg); console.log('');
  repro(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | handoff | authrec | deltarec | curve | hide | repro | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
