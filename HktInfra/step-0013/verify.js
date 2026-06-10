// HktInfra step-0013 — 헤드리스 검증 (진짜 프로세스 kill 아래 failover)
// 사용: node step-0013/verify.js <mode> [seed]
//   mode: reg | e2e | kill | reprovision | falsedeath | isolate | hide | repro | all
//     reg         — 회귀 0: 인프로세스 모드(kill 생애주기 OFF) → step-0012 와 *비트 동일*(net.log + 상태).
//                   zones 1·2 · recovery off/on · failover off/on(+death). kill 생애주기 도입이 *비-침습*임을 증명.
//     e2e         — E2E 동치: 멀티프로세스(토픽 버스·무열화) = 인프로세스 *비트 동일*(logDigest+fullDigest)
//                   + 승격 일치 + desync 0. basic·transport·failover. (0012 상속)
//     kill        — *진짜 child.kill(SIGKILL)*: 권위 존 프로세스를 결정론 tick 에 소멸 → 소켓 close 로 *감지*(윈도 아님)
//                   → orch lease 침묵 감지·승격 → 인프로세스 deathTick 과 *비트 동일* · desync 0 · 소유자=1 ·
//                   죽은 pid 가 livePids 에서 사라짐(프로세스 진짜 소멸).
//     reprovision — kill→승격으로 N=1 이 되면 *새 프로세스 spawn*·스냅샷 상태 동기(loadstate)·권위 입력 미러로
//                   핫 standby 복원(N≥2) → 새 standby 가 권위와 divergence 0 · 권위 세계엔 *비-침습*(fullDigest 동일).
//     falsedeath  — 거짓 사망: *살아 있는* 호스트 링크 침묵 → broker 가 침묵 tick 을 세어 *타임아웃 추측*(presumedDead)
//                   → 승격 → 호스트가 *복귀해 권위 재개 시도*하나 stale epoch 라 발신 전량 펜싱(epochFenced>0) →
//                   진짜 사망과 *비트 동일* · split-brain 0 · 소유자=1.
//     isolate     — 프로세스 분리: 각 서버 별 pid · broker 와 다름 · 진짜 kill 후 죽은 pid 소멸 · 통신=버스 프레임뿐.
//     hide        — 은닉: 진짜 kill·재-provisioning·epoch 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 누설 0.
//     repro       — 재현: 같은 시드 멀티프로세스(kill) 2회 → 같은 상태 + 인프로세스와도 동일(kill 타이밍 결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
const NET12 = require('../step-0012/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const SC = 80;          // 승격 수렴 여유(꼬리)
const DEATH = 40;       // 권위 존 사망/kill tick
const LEASE = 3;        // lease 결손 임계(감지 창)
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
// 권위 단일 소유 — 매 권위 엔티티의 살아있는 소유 존 수(=1 이어야 함). kill/거짓사망 후 split-brain(=2) 검출.
function maxOwners(r) {
  const cnt = new Map();
  for (const z of r.allZones) if (z.isAuthority()) for (const id of z.ents.keys()) cnt.set(id, (cnt.get(id) || 0) + 1);
  let mx = 0; for (const v of cnt.values()) if (v > mx) mx = v;
  return mx;
}
// 엔티티 divergence — 두 존의 ents 가 비트 동일인가(재-provisioning standby 복제 충실도).
function entDivergence(za, zb) {
  if (!za || !zb) return 999;
  let d = 0;
  for (const [id, e] of za.ents) { const f = zb.ents.get(id); if (!f || f.x !== e.x || f.y !== e.y) d++; }
  for (const id of zb.ents.keys()) if (!za.ents.has(id)) d++;
  return d;
}

// 검증 시나리오(공통)
const BASIC = (seed) => ({ seed, ticks: 48, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const FAILS = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
const TRANS = (seed) => ({ ...BASIC(seed), ticks: 60, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.both } });
// 진짜 kill — failover 토폴로지(orch+추종자)·*액터 건강*(deathTick 0)·실 child.kill(zone1@40).
const KILL = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, leaseTimeout: LEASE, wire: { kill: { host: 'zone1', at: DEATH } } });
// 재-provisioning — kill(zone1@40) + 승격된 zone1f 의 새 standby(zone1g) spawn@46(상태동기+미러). moves 늘려 미러 트래픽 확보.
const REPROV_BASE = (seed) => ({ seed, ticks: 90, clients: 6, moves: 50, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, leaseTimeout: LEASE });
const REPROV = (seed) => ({ ...REPROV_BASE(seed), wire: { kill: { host: 'zone1', at: DEATH }, reprovision: { srcAddr: 'zone1f', newHost: 'zone1g', newAddr: 'zone1g', sibling: 'zone2', at: DEATH + 6 } } });
// 거짓 사망 — *살아 있는* 호스트 링크 침묵(zone1@40) → 타임아웃 추측 → 승격 → 복귀(healAt=55) 시 epoch 펜싱.
const FALSE = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, leaseTimeout: LEASE, wire: { falsedeath: { host: 'zone1', at: DEATH, healAt: DEATH + 15 } } });

// ── reg: 인프로세스 0013 → 0012 비트 동일(kill 생애주기 도입 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(kill 생애주기 OFF) → step-0012 와 비트 동일(net.log + 상태). 도입 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0012 logHash | 0013(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r12 = NET12.run(p);
      const r13 = run({ ...p });
      const okL = logDigest(r12) === logDigest(r13), okS = stateDigest(r12) === stateDigest(r13);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r12))}   | ${hex(logDigest(r13))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스(토픽 버스·무열화) = 인프로세스 비트 동일(0012 상속) ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(토픽 pub/sub 버스·무열화) = 인프로세스 *비트 동일*(logDigest+fullDigest)·승격 일치·desync 0 ==');
  console.log('seed   | 시나리오 | 프로세스 | 와이어 | log동일 | full동일 | 승격(in/멀티) | 멀티 desync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic', BASIC(seed)], ['transport', TRANS(seed)], ['failover', FAILS(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okF = fullDigest(a) === fullDigest(b);
      const okP = a.totals.promotions === b.totals.promotions;
      const dB = finalLiveDesync(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름`) &&
        check(okF, `seed ${seed} ${name}: full 상태 다름`) &&
        check(okP, `seed ${seed} ${name}: 승격 수 다름(${a.totals.promotions} vs ${b.totals.promotions})`) &&
        check(dB === 0, `seed ${seed} ${name}: 멀티프로세스 최종 desync ${dB}`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(8)} | ${pad(b.cluster.pids.length, 8)} | ${(b.cluster.wire || '?').padEnd(7)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(a.totals.promotions + '/' + b.totals.promotions, 12)} | ${pad(dB, 11)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── kill: 진짜 child.kill(SIGKILL) → 소켓 close 감지 → 승격 → 인프로세스 deathTick 과 비트 동일 ──
async function kill(seeds) {
  console.log('== kill: *진짜 child.kill(SIGKILL)* 권위 존 소멸 → 소켓 close *감지*(윈도 아님) → orch 승격 ==');
  console.log('  인프로세스 deathTick 과 *비트 동일* · desync 0 · 소유자=1 · 죽은 pid 소멸(진짜 프로세스 kill)');
  console.log('seed   | log동일 | full동일 | 승격 | kill감지(socket) | 죽은pid소멸 | max소유자 | desync | 판정');
  for (const seed of seeds) {
    const a = run({ ...FAILS(seed), killZone: 'zone1' });   // 인프로세스: 액터 사망(deathTick=40)
    const b = await runMulti(KILL(seed));                    // 멀티프로세스: 액터 건강 + 실 child.kill(zone1@40)
    const C = b.cluster;
    const okL = logDigest(a) === logDigest(b);
    const okF = fullDigest(a) === fullDigest(b);
    const okP = a.totals.promotions === b.totals.promotions && b.totals.promotions === 1;
    const dB = finalLiveDesync(b);
    const mo = maxOwners(b);
    const killed = C.killed.includes('zone1');
    const detected = C.socketClosed >= 1;                    // 소켓 close 신호 = 전송 층 사망 감지
    // 죽은 호스트 pid 가 *살아있는* pid 집합에서 사라졌는가(진짜 프로세스 소멸).
    const hostPid = new Map(C.pidByHost);
    const deadPid = hostPid.get('zone1');
    const pidGone = deadPid != null && !C.livePids.includes(deadPid);
    const ok =
      check(killed && detected, `seed ${seed}: kill/감지 실패(killed ${killed}·socketClosed ${C.socketClosed})`) &&
      check(okL, `seed ${seed}: net.log 다름(진짜 kill ≠ 사망)`) &&
      check(okF, `seed ${seed}: full 상태 다름`) &&
      check(okP, `seed ${seed}: 승격 ${a.totals.promotions}/${b.totals.promotions}(≠1)`) &&
      check(pidGone, `seed ${seed}: 죽은 pid(${deadPid}) 가 livePids 에 남음(프로세스 미소멸)`) &&
      check(mo === 1, `seed ${seed}: 최대 소유자 ${mo}(split-brain)`) &&
      check(dB === 0, `seed ${seed}: desync ${dB}`);
    console.log(`${pad(seed, 6)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(b.totals.promotions, 4)} | ${pad(C.socketClosed, 16)} | ${(pidGone ? '예' : '아니오').padEnd(11)} | ${pad(mo, 9)} | ${pad(dB, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 윈도(broker 가 침묵 시점을 *앎*)가 아니라 *소켓 close 신호*로 침묵을 감지 → deliver/tick 스킵 = deathTick 비트 동일.');
}

// ── reprovision: kill→승격 후 새 standby spawn·상태동기·미러 → N≥2 복원·divergence 0·권위 비-침습 ──
async function reprovision(seeds) {
  console.log('== reprovision: kill→승격으로 N=1 → *새 프로세스 spawn*·스냅샷 상태동기(loadstate)·권위 입력 미러 → N≥2 복원 ==');
  console.log('  새 standby 가 권위와 divergence 0 · 권위 세계엔 *비-침습*(fullDigest = 인프로세스 deathTick) · 소유자=1');
  console.log('seed   | standby | 미러배달 | divergence | N(zone1구역) | full=인프로세스 | max소유자 | desync | 판정');
  for (const seed of seeds) {
    const a = run({ ...REPROV_BASE(seed), deathTick: DEATH, killZone: 'zone1' });   // 인프로세스 deathTick 기준(재-provisioning 없음)
    const b = await runMulti(REPROV(seed));
    const C = b.cluster;
    const zf = b.allZones.find(z => z.addr === 'zone1f');
    const zg = b.allZones.find(z => z.addr === 'zone1g');
    const div = entDivergence(zf, zg);
    const nRegion = (zf && !zf.dead ? 1 : 0) + (zg ? 1 : 0);   // zone1 구역[0,H) 을 덮는 살아있는 프로세스 수
    const okF = fullDigest(a) === fullDigest(b);               // 재-provisioning 이 권위 세계에 비-침습
    const dB = finalLiveDesync(b);
    const mo = maxOwners(b);
    const standbyUp = C.reprovisioned.includes('zone1g') && !!zg;
    const ok =
      check(standbyUp, `seed ${seed}: standby(zone1g) 미기동`) &&
      check(div === 0, `seed ${seed}: standby divergence ${div}(복제 충실도 깨짐)`) &&
      check(nRegion >= 2, `seed ${seed}: zone1 구역 프로세스 ${nRegion}(N≥2 미복원)`) &&
      check(okF, `seed ${seed}: full 상태 다름(재-provisioning 이 권위 세계 침습)`) &&
      check(mo === 1, `seed ${seed}: 최대 소유자 ${mo}`) &&
      check(dB === 0, `seed ${seed}: desync ${dB}`);
    console.log(`${pad(seed, 6)} | ${(standbyUp ? '예' : '아니오').padEnd(7)} | ${pad(C.mirrorDeliveries, 8)} | ${pad(div, 10)} | ${pad(nRegion, 12)} | ${(okF ? '예' : '아니오').padEnd(15)} | ${pad(mo, 9)} | ${pad(dB, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 새 standby = shadow·발신 0(net.log 불변) → 권위 세계 비-침습. 권위 입력 미러로 같은 시드+입력열 복제 → divergence 0.');
}

// ── falsedeath: 살아있는 호스트 침묵 → 타임아웃 추측 → 승격 → 복귀 시 epoch 펜싱(split-brain 0) ──
async function falsedeath(seeds) {
  console.log('== falsedeath: *살아 있는* 호스트 침묵 → broker 침묵 tick 카운트 *타임아웃 추측*(presumedDead) → 승격 ==');
  console.log('  호스트 *복귀*해 권위 재개 시도하나 stale epoch 라 발신 전량 펜싱(epochFenced>0) → 진짜 사망과 비트 동일 · 소유자=1');
  console.log('seed   | log동일 | full동일 | 승격 | 추측사망tick | epoch | epoch펜싱 | max소유자 | desync | 판정');
  for (const seed of seeds) {
    const a = run({ ...FAILS(seed), killZone: 'zone1' });   // 인프로세스: 진짜 사망(deathTick=40)
    const b = await runMulti(FALSE(seed));                  // 멀티프로세스: 침묵→복귀(거짓 사망)
    const C = b.cluster;
    const okL = logDigest(a) === logDigest(b);
    const okF = fullDigest(a) === fullDigest(b);
    const okP = a.totals.promotions === b.totals.promotions && b.totals.promotions === 1;
    const dB = finalLiveDesync(b);
    const mo = maxOwners(b);
    const guessed = C.presumedDead.includes('zone1');
    const pdEntry = C.presumedDeadTick.find(e => e[0] === 'zone1');
    const pdTick = pdEntry ? pdEntry[1] : '-';
    const ok =
      check(guessed, `seed ${seed}: 타임아웃 추측 미발동(presumedDead ${C.presumedDead})`) &&
      check(C.epochFenced > 0, `seed ${seed}: epoch 펜싱 0(복귀 호스트가 출력 안 함 — 거짓 사망 미검증)`) &&
      check(okL, `seed ${seed}: net.log 다름(거짓 사망 ≠ 진짜 사망 — 펜싱 누수)`) &&
      check(okF, `seed ${seed}: full 상태 다름`) &&
      check(okP, `seed ${seed}: 승격 ${a.totals.promotions}/${b.totals.promotions}(≠1)`) &&
      check(mo === 1, `seed ${seed}: 최대 소유자 ${mo}(split-brain — epoch 펜싱 실패)`) &&
      check(dB === 0, `seed ${seed}: desync ${dB}`);
    console.log(`${pad(seed, 6)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(b.totals.promotions, 4)} | ${pad(pdTick, 12)} | ${pad(C.epoch, 5)} | ${pad(C.epochFenced, 9)} | ${pad(mo, 9)} | ${pad(dB, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 침묵의 *길이*가 추측을 낳고(윈도 아님), 복귀하는 *살아 있는* 권위를 stale epoch 가 거부한다 — "안전은 복귀의 함수".');
}

// ── isolate: 프로세스 분리 — 각 서버 별 pid·broker 와 다름·진짜 kill 후 죽은 pid 소멸·통신은 버스 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: 각 서버 박스가 *구분되는 OS 프로세스*(pid)·broker 와도 다름 · 진짜 kill 후 죽은 pid 소멸 · 통신=버스 프레임뿐 ==');
  const seed = seeds[0];
  const b = await runMulti(KILL(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const hostPid = new Map(C.pidByHost);
  const deadPid = hostPid.get('zone1');
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(C.pids.every(p => p !== C.parentPid), `자식 pid 가 broker(${C.parentPid})와 같음 — 분리 위반`) &&
    check(C.killed.includes('zone1') && !C.livePids.includes(deadPid), `진짜 kill 후 죽은 pid(${deadPid}) 미소멸`) &&
    check(C.frames > 0 && C.framesIn > 0, `버스 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터(함수·순환·공유 참조) 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · 구분 pid ${pidSet.size}개 · 죽은 pid ${deadPid}(소멸 ${!C.livePids.includes(deadPid)}) · 토픽 ${C.topics.length}개 · 버스 out ${C.frames}프레임/${C.socketBytes}B · in ${C.framesIn}프레임`);
  console.log('  배치(addr → host → pid · 생존):');
  for (const [addr, host] of C.placement) {
    const p = hostPid.get(host);
    console.log(`    ${addr.padEnd(9)} → ${host.padEnd(9)} → pid ${p} ${C.livePids.includes(p) ? '(live)' : '(killed)'}`);
  }
  check(ok, 'isolate');
}

// ── hide: 진짜 kill·재-provisioning·epoch 후에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 진짜 kill·재-provisioning·epoch 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...KILL(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /topic/i.test(probe) || /partition/i.test(probe) || /fence/i.test(probe) ||
          /kill/i.test(probe) || /epoch/i.test(probe) || /presumed/i.test(probe) || /reprov/i.test(probe) || /mirror/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드 멀티프로세스(kill) 2회 → 같은 상태 + 인프로세스와도 동일(kill 타이밍 결정론) ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(진짜 kill) 2회 → 같은 상태 + 인프로세스와도 동일(kill 타이밍이 *논리 tick* 결정론) ==');
  console.log('seed   | full 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run({ ...FAILS(seed), killZone: 'zone1' });
    const m1 = await runMulti(KILL(seed));
    const m2 = await runMulti(KILL(seed));
    const d1 = fullDigest(m1), d2 = fullDigest(m2), di = fullDigest(inp);
    digests.add(d1);
    const ok =
      check(d1 === d2, `seed ${seed}: 멀티 2회 상태 다름 (${hex(d1)} != ${hex(d2)})`) &&
      check(d1 === di, `seed ${seed}: 멀티 != 인프로세스 (${hex(d1)} != ${hex(di)})`);
    console.log(`${pad(seed, 6)} | ${hex(d1)}      | ${(d1 === d2 ? 'OK' : 'FAIL').padEnd(12)} | ${(d1 === di ? 'OK' : 'FAIL').padEnd(14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 진짜 프로세스 kill·타임아웃 추측·재-provisioning·거짓 사망 epoch 펜싱 아래 인프로세스와 비트 동일 ==');
  for (const seed of seeds) {
    const a = run({ ...FAILS(seed), killZone: 'zone1' });
    const b = await runMulti(KILL(seed));
    const C = b.cluster;
    const ok = logDigest(a) === logDigest(b) && fullDigest(a) === fullDigest(b) && finalLiveDesync(b) === 0 && maxOwners(b) === 1;
    if (!ok) FAILED = true;
    const hostPid = new Map(C.pidByHost);
    const deadPid = hostPid.get('zone1');
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · TCP :${C.port} · 진짜 kill ${C.killedHost}@${C.killAt} · 소켓감지 ${C.socketClosed} · 죽은pid ${deadPid} 소멸 ${!C.livePids.includes(deadPid)} · 소유자 ${maxOwners(b)} · log동일 ${logDigest(a) === logDigest(b)} · full동일 ${fullDigest(a) === fullDigest(b)} · desync ${finalLiveDesync(b)} | ${hex(fullDigest(b))}`);
  }
  console.log('진짜 kill(child.kill SIGKILL) = 소켓 close 감지 → deathTick 비트 동일 · 재-provisioning N≥2 복원 · 거짓 사망 epoch 펜싱(split-brain 0) · 인프로세스 모드면 0012 비트 동일');
}

// ── CLI ──
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  const ASYNC = { e2e, kill, reprovision, falsedeath, isolate, hide, repro };
  if (mode === 'reg') reg(seedArg);
  else if (ASYNC[mode]) await ASYNC[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    await kill(seedArg); console.log('');
    await reprovision(seedArg); console.log('');
    await falsedeath(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | kill | reprovision | falsedeath | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
