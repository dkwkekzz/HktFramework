// HktInfra step-0009 — 헤드리스 검증 (추종자 승격 failover)
// 사용: node step-0009/verify.js <mode> [seed]
//   mode: reg | replica | failover | viewrec | window | hide | repro | all
//     reg      — 회귀 0: failover 끔(failover=false) → step-0008 와 *비트 동일*(net.log + 상태). recovery on/off · zones 1·2.
//     replica  — 복제 충실도 + 행복 경로: 추종자(shadow)가 권위와 *매 tick 비트 동일 ents*(입력 replay, 상태 전송 0).
//                무사망 failover on 은 0008 불변 유지(소유자=1·이중쓰기 0·desync 0·승격 0).
//     failover — 권위 연속: 권위 존 사망 주입. OFF(failover 없음)=영구 소실 vs ON=추종자 승격(bounded gap→소유자=1 회복·
//                이중쓰기 0·전 엔터티 생존·상태 보존(사망 전 복제 충실도 0)·승격 1회).
//     viewrec  — 뷰 복원: 승격 후 클라 seen 이 강제 keyframe 으로 *살아있는 권위 트루스*에 재수렴(최종 desync 0·승격 keyframe>0).
//     window   — 감지 창: leaseTimeout↑ 에 사망~승격 gap 창이 비례 성장(권위 연속의 한계 = bounded gap)·항상 최종 gap 0 회복.
//     hide     — 은닉: failover(lease/promote/orch) 후에도 클라는 게이트웨이만·내부 누설 0·뷰/재동기 정상.
//     repro    — 재현: 같은 시드+failover → 같은 상태(승격 타이밍·결과 결정론). Math.random 0.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, fnv1a, authorityCount, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
const NET8 = require('../step-0008/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const SC = 80;          // 승격 수렴 여유(꼬리). 사망 40 → 80 tick 으로 재동기 수렴 확인.
const DEATH = 40;       // 권위 존 사망 tick(중반 — 핸드오프로 양 존에 엔터티가 분포한 뒤)
const LEASE = 3;        // lease 결손 임계(감지 창). retxPeriod 2·resyncPeriod 3·heartbeat 10·leaseTimeout 3 더미판.
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
function stateDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
function fullDigest(r) {
  const owns = r.clients.map(c => c.avatar + '@' + (ownerOf(r, c.avatar) || '-')).sort().join(';');
  const sig = r.clients.map(c => c.avatar + ':' + c.seenSig()).sort().join('|');
  return fnv1a(owns + '#' + sig + '#' + r.totals.promotions);
}

// 권위 위반 — 도입된 엔터티마다 매 tick authorityCount: 1 이어야(>1 이중쓰기·0 공백). failover gap 은 *일시적*.
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
// 매 tick 공백(authorityCount==0) 수 시계열 — failover 의 *bounded gap → 0 회복* 관찰.
function gapSeries(r) {
  const intro = new Set(), out = [];
  for (const t of r.trace) {
    for (const av of t.committed.keys()) intro.add(av);
    for (const av of t.inflight) intro.add(av);
    let g = 0; for (const av of intro) if (authorityCount(t, av) === 0) g++;
    out.push(g);
  }
  return out;
}
// 최종 소실 — 마지막 tick 에 소유자도 in-flight 도 없는 *기대* 아바타(영구 공백). 클라 집합 기준.
function lostFinal(r) {
  const last = r.trace[r.trace.length - 1];
  let lost = 0;
  for (const c of r.clients) if (c.avatar && (last.committed.get(c.avatar) || 0) === 0 && !last.inflight.has(c.avatar)) lost++;
  return lost;
}
// 사망 전 추종자 복제 충실도 — 모든 tick(사망 전) divergence 0 이어야(상태 보존의 토대 = 입력 replay 가 권위와 비트 동일).
function preDeathReplicaMax(r) {
  const upto = (r.deathTick != null ? r.deathTick - 1 : r.replicaTrace.length);  // index<deathTick-1 = tick<=deathTick-1(사망 전)
  let m = 0; for (let i = 0; i < upto && i < r.replicaTrace.length; i++) m = Math.max(m, r.replicaTrace[i]);
  return m;
}
// 최종 desync — 마지막 tick 각 클라 seen vs *살아있는 권위 존* AOI 트루스(승격 존+생존 존). failover 후 유효한 진실.
function finalLiveDesync(r) {
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const truth = globalAoiTruth(r, c.avatar);
    if (truth === null) continue;   // 소실(영구 공백)은 lostFinal 이 잡음
    if (JSON.stringify(c.seenIds()) !== JSON.stringify(truth)) d++;
  }
  return d;
}

// ── reg: failover 끔 → step-0008 비트 동일 ──
function reg(seeds) {
  console.log('== reg: failover 끔(failover=false) → step-0008 와 비트 동일(net.log + 상태). recovery on/off · zones 1·2. 회귀 0 ==');
  console.log('seed   | zones | rec | 0008 logHash | 0009(fo off) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    for (const zones of [1, 2]) {
      for (const recovery of [false, true]) {
        const p = { seed, ticks: 40, clients: 4, moves: 30, radius: 4, grid: 16, zones, incremental: true, recovery };
        const r8 = NET8.run(p);
        const r9 = run({ ...p, failover: false });
        const okL = logDigest(r8) === logDigest(r9), okS = stateDigest(r8) === stateDigest(r9);
        check(okL, `seed ${seed} zones${zones} rec${recovery}: net.log 다름`);
        check(okS, `seed ${seed} zones${zones} rec${recovery}: 상태 다름`);
        console.log(`${pad(seed, 6)} | ${pad(zones, 5)} | ${(recovery ? 'on ' : 'off')} | ${hex(logDigest(r8))}   | ${hex(logDigest(r9))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
      }
    }
  }
}

// ── replica: 추종자 복제 충실도(입력 replay 비트 동일) + 무사망 행복 경로(0008 불변 유지) ──
function replica(seeds) {
  console.log('== replica: 추종자(shadow)가 권위와 *매 tick 비트 동일 ents*(입력 replay·상태 전송 0) + 무사망 failover on = 0008 불변 ==');
  console.log('seed   | 복제 충실도(전 tick diverge max) | 공백 | 이중쓰기 | 최종desync | 승격 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true });  // 무사망(deathTick=null)
    const divMax = Math.max(...on.replicaTrace);
    const v = authViolations(on);
    const dOn = finalLiveDesync(on);
    const ok =
      check(divMax === 0, `seed ${seed}: 추종자 복제 충실도 깨짐(divergence ${divMax} — 입력 replay 비결정)`) &&
      check(v.gaps === 0, `seed ${seed}: 무사망인데 공백 ${v.gaps}`) &&
      check(v.doubleWrite === 0, `seed ${seed}: 이중쓰기 ${v.doubleWrite}`) &&
      check(dOn === 0, `seed ${seed}: 최종 desync ${dOn}`) &&
      check(on.totals.promotions === 0, `seed ${seed}: 무사망인데 승격 ${on.totals.promotions}`);
    console.log(`${pad(seed, 6)} | ${pad(divMax, 32)} | ${pad(v.gaps, 4)} | ${pad(v.doubleWrite, 8)} | ${pad(dOn, 10)} | ${pad(on.totals.promotions, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── failover: 권위 존 사망 — OFF(failover 없음)=영구 소실 vs ON=추종자 승격(bounded gap→회복·전 생존·상태 보존) ──
function failover(seeds) {
  console.log(`== failover: 권위 존(zone1) 사망 주입(tick ${DEATH}) — OFF=영구 소실 vs ON=추종자 승격(bounded gap→소유자=1·전 생존·상태 보존) ==`);
  console.log('seed   | OFF 소실(영구) | ON 소실 | ON 최대gap | ON gap창(tick) | ON 최종gap | ON 이중쓰기 | 복제충실도 | 승격 | 판정');
  for (const seed of seeds) {
    const off = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: false, deathTick: DEATH });
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const g = gapSeries(on), maxGap = Math.max(...g), finalGap = g[g.length - 1], gapWindow = g.filter(x => x > 0).length;
    const vOn = authViolations(on);
    const lostOff = lostFinal(off), lostOn = lostFinal(on);
    const divMax = preDeathReplicaMax(on);
    const ok =
      // ON 불변: 전 엔터티 생존·최종 소유자=1 회복·이중쓰기 0·상태 보존(사망 전 복제 0)·정확히 1회 승격
      check(lostOn === 0, `seed ${seed}: ON 엔터티 소실 ${lostOn}(승격 후 생존 위반)`) &&
      check(finalGap === 0, `seed ${seed}: ON 최종 공백 ${finalGap}(소유자=1 미회복)`) &&
      check(vOn.doubleWrite === 0, `seed ${seed}: ON 이중쓰기 ${vOn.doubleWrite}(펜싱 위반)`) &&
      check(divMax === 0, `seed ${seed}: ON 사망 전 복제 충실도 ${divMax}(상태 보존 토대 깨짐)`) &&
      check(on.totals.promotions === 1, `seed ${seed}: ON 승격 ${on.totals.promotions}회(정확히 1 이어야)`) &&
      // bounded gap: 사망~승격 감지 창은 불가피하나 유한해야(leaseTimeout+승격 지연 ~ 5 tick 이내)
      check(maxGap > 0 && gapWindow <= LEASE + 3, `seed ${seed}: ON gap 창 ${gapWindow}(bounded 위반)`) &&
      // 대조: OFF 는 복원 장치가 없어 사망 존 엔터티 영구 소실(자가치유 불가)
      check(lostOff > 0, `seed ${seed}: OFF 소실 0(사망 대조 실패 — zone1 이 사망 시점에 소유 0?)`);
    console.log(`${pad(seed, 6)} | ${pad(lostOff, 14)} | ${pad(lostOn, 7)} | ${pad(maxGap, 10)} | ${pad(gapWindow, 14)} | ${pad(finalGap, 10)} | ${pad(vOn.doubleWrite, 11)} | ${pad(divMax, 10)} | ${pad(on.totals.promotions, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── viewrec: 승격 후 클라 뷰 복원 — 강제 keyframe 으로 살아있는 권위 트루스에 재수렴 ──
function viewrec(seeds) {
  console.log('== viewrec: 승격 후 클라 seen 이 강제 keyframe 으로 *살아있는 권위 트루스*에 재수렴(최종 desync 0·승격 keyframe>0) ==');
  console.log('seed   | 승격 keyframe | 최종 desync(live 트루스) | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const dOn = finalLiveDesync(on);
    const viewed = on.clients.filter(c => c.views > 0).length;
    const ok =
      check(on.totals.promotionKeyframes > 0, `seed ${seed}: 승격 keyframe 0(재동기 미발동)`) &&
      check(dOn === 0, `seed ${seed}: 최종 desync ${dOn}(재수렴 실패)`) &&
      check(viewed === on.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${on.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(on.totals.promotionKeyframes, 13)} | ${pad(dOn, 24)} | ${pad(viewed + '/' + on.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── window: leaseTimeout↑ → 감지 창(gap) 성장, 항상 최종 gap 0 회복 ──
function window(seeds) {
  console.log('== window: leaseTimeout↑ → 사망~승격 gap 창 비례 성장(권위 연속의 비용 = bounded gap)·항상 최종 gap 0 회복 ==');
  console.log('leaseTimeout | 평균 gap창(tick) | 평균 최대gap | 최종gap 합 | 소실 합 | 판정');
  for (const lt of [2, 3, 4, 6]) {
    let win = 0, maxg = 0, fin = 0, lost = 0;
    for (const seed of seeds) {
      const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: lt });
      const g = gapSeries(on);
      win += g.filter(x => x > 0).length; maxg += Math.max(...g); fin += g[g.length - 1]; lost += lostFinal(on);
    }
    const ok =
      check(fin === 0, `leaseTimeout ${lt}: 최종 gap 합 ${fin}(회복 실패)`) &&
      check(lost === 0, `leaseTimeout ${lt}: 소실 합 ${lost}(생존 위반)`);
    console.log(`${pad(lt, 12)} | ${pad((win / seeds.length).toFixed(1), 16)} | ${pad((maxg / seeds.length).toFixed(1), 12)} | ${pad(fin, 10)} | ${pad(lost, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: failover 후에도 클라는 게이트웨이만, 내부 누설 0 ──
function hide(seeds) {
  console.log('== hide: failover(lease/promote/orch) + 사망/승격 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: SC, clients: 4, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드+failover → 같은 상태(승격 타이밍·결과 결정론) ──
function repro(seeds) {
  console.log('== repro: 같은 시드+failover → 같은 상태(소유존+seen+승격). 승격 타이밍도 시드 결정론(Math.random 0) ==');
  console.log('seed   | full 다이제스트 | 2회 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const a = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const b = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const da = fullDigest(a), db = fullDigest(b);
    digests.add(da);
    const ok = check(da === db, `seed ${seed}: 같은 시드 상태 다름 (${hex(da)} != ${hex(db)})`);
    console.log(`${pad(seed, 6)} | ${hex(da)}      | ${(da === db ? 'OK' : 'FAIL').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
function summary(seeds) {
  console.log('== summary: 추종자 승격(failover) — 권위 존 사망 → 추종자가 bounded gap 후 권위 재구성(소유자=1·desync 0·전 생존) ==');
  for (const seed of seeds) {
    const off = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: false, deathTick: DEATH });
    const on = run({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
    const g = gapSeries(on);
    const ok = lostFinal(on) === 0 && g[g.length - 1] === 0 && finalLiveDesync(on) === 0 && on.totals.promotions === 1;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: OFF 영구소실 ${lostFinal(off)} → ON 승격 ${on.totals.promotions}·gap창 ${g.filter(x => x > 0).length}tick·최종gap ${g[g.length - 1]}·소실 ${lostFinal(on)}·desync ${finalLiveDesync(on)}·승격KF ${on.totals.promotionKeyframes} | 상태 ${hex(fullDigest(on))}`);
  }
  console.log('failover = 추종자 입력 replay 복제(상태 전송 0) + orch lease 감지 + 승격(강제 keyframe 재동기) · failover=false 면 0008 비트 동일');
}

// ── CLI ──
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, replica, failover, viewrec, window, hide, repro };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  replica(seedArg); console.log('');
  failover(seedArg); console.log('');
  viewrec(seedArg); console.log('');
  window(seedArg); console.log('');
  hide(seedArg); console.log('');
  repro(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | replica | failover | viewrec | window | hide | repro | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
