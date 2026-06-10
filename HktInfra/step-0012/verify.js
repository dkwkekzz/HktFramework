// HktInfra step-0012 — 헤드리스 검증 (버스 분산 + 실 네트워크 열화 내성)
// 사용: node step-0012/verify.js <mode> [seed]
//   mode: reg | e2e | bus | drop | partition | isolate | hide | repro | all
//     reg       — 회귀 0: 인프로세스 모드(버스/열화 OFF) → step-0011 와 *비트 동일*(net.log + 상태).
//                 zones 1·2 · recovery off/on · failover off/on(+death). 버스/열화 도입이 *비-침습*임을 증명.
//     e2e       — E2E 동치: 멀티프로세스(토픽 pub/sub 버스·무열화) = 인프로세스 *비트 동일*(logDigest+fullDigest)
//                 + 승격 일치 + desync 0. basic·transport·failover. 버스 재배선이 *의미를 보존*함.
//     bus       — 버스 분산: 직접 소켓 주소지정 → 토픽 발행/구독(라우팅 테이블). + 발행자 무수정 소비자 추가(tap)
//                 가 *비-침습*(같은 다이제스트)임을 증명 = N×N 주소결합 제거의 핵심.
//     drop      — 전송 열화(시드 프레임 드롭) + seq/ack/resend(reqId 멱등): 멀티프로세스가 무손실(인프로세스)과
//                 *비트 동일*. 링크 드롭을 재전송이 메워 와이어 신뢰성을 세움(desync 0).
//     partition — *소켓 분단* = 0009 추상 사망의 현실화: 권위 존 링크를 t0 부터 침묵 → orch lease 감지·failover 승격.
//                 액터는 *건강*(deathTick 0)한데 *링크만* 분단 → 인프로세스 deathTick 과 *비트 동일* · desync 0 ·
//                 재연결+펜싱(복귀 호스트 살아도 출력 수용 0 = split-brain 없음 · 소유자=1).
//     isolate   — 프로세스 분리: 각 서버 별 pid · broker 와 다름 · 통신=토픽 버스 프레임뿐(공유 메모리 0).
//     hide      — 은닉: 버스(서버간 토픽) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 누설 0.
//     repro     — 재현: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(버스·열화가 결정론을 안 깸).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
const NET11 = require('../step-0011/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const SC = 80;          // 승격 수렴 여유(꼬리)
const DEATH = 40;       // 권위 존 사망/분단 tick
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
// 권위 단일 소유 — 매 권위 엔티티의 살아있는 소유 존 수(=1 이어야 함). 분단 후 split-brain(=2) 검출.
function maxOwners(r) {
  const cnt = new Map();
  for (const z of r.allZones) if (z.isAuthority()) for (const id of z.ents.keys()) cnt.set(id, (cnt.get(id) || 0) + 1);
  let mx = 0; for (const v of cnt.values()) if (v > mx) mx = v;
  return mx;
}

// 검증 시나리오(공통)
const BASIC = (seed) => ({ seed, ticks: 48, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const FAILS = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화(게임-층 손실·지연·재정렬·중복) ON — broker 의 engine Net substrate 에 산다(소켓 와이어와 별개 층).
const TRANS = (seed) => ({ ...BASIC(seed), ticks: 60, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.both } });
// 소켓-층 분단 시나리오 — failover 토폴로지(orch+추종자)지만 *액터는 건강*(deathTick 0), 링크만 분단.
const PART = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, leaseTimeout: LEASE, wire: { partition: { host: 'zone1', at: DEATH } } });

// ── reg: 인프로세스 0012 → 0011 비트 동일(버스/열화 도입 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(버스/열화 OFF) → step-0011 와 비트 동일(net.log + 상태). 버스/열화 도입 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0011 logHash | 0012(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r11 = NET11.run(p);
      const r12 = run({ ...p });
      const okL = logDigest(r11) === logDigest(r12), okS = stateDigest(r11) === stateDigest(r12);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r11))}   | ${hex(logDigest(r12))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스(토픽 버스·무열화) = 인프로세스 비트 동일(버스 재배선이 의미 보존) ──
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
        check(okL, `seed ${seed} ${name}: net.log 다름(버스 의미 깨짐)`) &&
        check(okF, `seed ${seed} ${name}: full 상태 다름`) &&
        check(okP, `seed ${seed} ${name}: 승격 수 다름(${a.totals.promotions} vs ${b.totals.promotions})`) &&
        check(dB === 0, `seed ${seed} ${name}: 멀티프로세스 최종 desync ${dB}(수렴 깨짐)`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(8)} | ${pad(b.cluster.pids.length, 8)} | ${(b.cluster.wire || '?').padEnd(7)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(a.totals.promotions + '/' + b.totals.promotions, 12)} | ${pad(dB, 11)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── bus: 버스 분산 — 토픽 라우팅 + 발행자 무수정 소비자 추가(tap)가 비-침습 ──
async function bus(seeds) {
  console.log('== bus: broker 단일점을 토픽 pub/sub 로 분산 — 직접 소켓 주소지정 제거 · 발행자 무수정 소비자 추가(tap) ==');
  console.log('seed   | 토픽 수 | 발행 | tap 수신 | 비-침습(tap 무관 동일) | 판정');
  for (const seed of seeds) {
    const cfg = { ...FAILS(seed), clients: 4 };
    const base = await runMulti(cfg);
    let tapCount = 0;
    // 발행자(배리어)는 무수정 — 같은 토픽에 *수동 소비자*만 더한다(N×N 직접 결합이 아닌 토픽 구독).
    const tapped = await runMulti({ ...cfg, tap: [{ topic: 'cmd.zone1', fn: () => { tapCount++; } }] });
    const topics = base.cluster.topics.slice().sort();
    const okTopic = topics.length >= 6 && topics.includes('cmd.zone1') && topics.includes('cmd.gateway');
    const okTap = tapCount > 0 && tapped.cluster.tapDeliveries > 0;
    const okNonInvasive = fullDigest(base) === fullDigest(tapped) && logDigest(base) === logDigest(tapped);
    const ok =
      check(okTopic, `seed ${seed}: 토픽 라우팅 테이블 비정상(${topics.join(',')})`) &&
      check(okTap, `seed ${seed}: tap 소비자 미수신(${tapCount})`) &&
      check(okNonInvasive, `seed ${seed}: tap 이 다이제스트를 바꿈(발행자 침습)`);
    console.log(`${pad(seed, 6)} | ${pad(topics.length, 7)} | ${pad(base.cluster.publishes, 6)} | ${pad(tapCount, 8)} | ${(okNonInvasive ? '예' : '아니오').padEnd(20)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 발행자(배리어)는 cmd.<host> 토픽으로 발행할 뿐 — 구독자(호스트)·tap 소비자를 *모른다*(직접 주소결합 제거).');
}

// ── drop: 전송 열화(프레임 드롭) + ack/resend → 무손실(인프로세스)과 비트 동일 ──
async function drop(seeds) {
  console.log('== drop: 버스 링크 프레임 드롭(시드) + seq/ack/resend(reqId 멱등) → 무손실(인프로세스)과 *비트 동일* ==');
  console.log('seed   | 드롭률 | 드롭 프레임 | 재전송 | log동일 | full동일 | desync | 판정');
  for (const seed of seeds) {
    const a = run(FAILS(seed));
    const b = await runMulti({ ...FAILS(seed), wire: { drop: 0.2, dropSeed: (seed ^ 0xD0B) >>> 0 } });
    const okL = logDigest(a) === logDigest(b);
    const okF = fullDigest(a) === fullDigest(b);
    const dB = finalLiveDesync(b);
    const ok =
      check(b.cluster.dropped > 0, `seed ${seed}: 드롭 0(열화 미주입)`) &&
      check(okL, `seed ${seed}: net.log 다름(드롭이 의미를 깸 — 재전송 실패)`) &&
      check(okF, `seed ${seed}: full 상태 다름`) &&
      check(dB === 0, `seed ${seed}: desync ${dB}`);
    console.log(`${pad(seed, 6)} | ${pad('0.2', 6)} | ${pad(b.cluster.dropped, 11)} | ${pad(b.cluster.resends, 6)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(dB, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 링크가 프레임을 잃어도 reqId 멱등 재전송이 메워 배리어 시퀀스 불변 → 다이제스트 비트 동일(와이어 신뢰성).');
}

// ── partition: 소켓 분단 = 추상 사망의 현실화 → failover → 재연결+펜싱(split-brain 없음) ──
async function partition(seeds) {
  console.log('== partition: 권위 존 *링크* 분단(t' + DEATH + ', 액터는 건강) = 0009 추상 사망의 소켓-층 현실화 ==');
  console.log('  인프로세스 deathTick 과 *비트 동일* · failover 승격 · desync 0 · 재연결+펜싱(소유자=1, split-brain 0)');
  console.log('seed   | log동일 | full동일 | 승격 | 침묵 tick | 재연결생존 | max소유자 | desync | 판정');
  for (const seed of seeds) {
    // 인프로세스 기준: 액터 사망(deathTick). 멀티프로세스: 액터 건강 + 링크 분단(wire.partition).
    const a = run({ ...FAILS(seed), killZone: 'zone1' });          // deathTick=40 (FAILS 기본)
    const b = await runMulti(PART(seed));                          // deathTick 0, wire.partition zone1@40
    const C = b.cluster;
    const okL = logDigest(a) === logDigest(b);
    const okF = fullDigest(a) === fullDigest(b);
    const okP = a.totals.promotions === b.totals.promotions && b.totals.promotions === 1;
    const dB = finalLiveDesync(b);
    const mo = maxOwners(b);
    const ok =
      check(okL, `seed ${seed}: net.log 다름(분단≠사망 — 의미 안 보존)`) &&
      check(okF, `seed ${seed}: full 상태 다름`) &&
      check(okP, `seed ${seed}: 승격 ${a.totals.promotions}/${b.totals.promotions}(≠1)`) &&
      check(C.reconnectedAlive, `seed ${seed}: 재연결 호스트 펜스 미응답(생존 미확인)`) &&
      check(mo === 1, `seed ${seed}: 최대 소유자 ${mo}(split-brain — 펜싱 실패)`) &&
      check(dB === 0, `seed ${seed}: desync ${dB}`);
    console.log(`${pad(seed, 6)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(b.totals.promotions, 4)} | ${pad(C.fencedAttempts, 9)} | ${(C.reconnectedAlive ? '예' : '아니오').padEnd(10)} | ${pad(mo, 9)} | ${pad(dB, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 액터를 죽이지 않고 *링크만* 끊어도 orch 가 침묵을 감지·승격. 복귀 호스트는 펜스로 출력 0 → split-brain 없음.');
}

// ── isolate: 프로세스 분리 — 각 서버 별 pid·broker 와 다름·통신은 토픽 버스 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: 각 서버 박스가 *구분되는 OS 프로세스*(pid)·broker 와도 다름 · 통신=토픽 버스 프레임뿐(공유 메모리 0) ==');
  const seed = seeds[0];
  const b = await runMulti(FAILS(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(C.pids.every(p => p !== C.parentPid), `자식 pid 가 broker(${C.parentPid})와 같음 — 분리 위반`) &&
    check(C.frames > 0 && C.framesIn > 0, `버스 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터(함수·순환·공유 참조) 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · 구분 pid ${pidSet.size}개 · 토픽 ${C.topics.length}개 · 버스 out ${C.frames}프레임/${C.socketBytes}B · in ${C.framesIn}프레임/${C.socketBytesIn}B · 양방향 직렬화 ${C.allSerializable}`);
  console.log('  배치(addr → host → pid):');
  const hostPid = new Map(C.hostIds.map((h, i) => [h, C.pids[i]]));
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(9)} → ${host.padEnd(9)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 멀티프로세스(서버간 버스) 후에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 멀티프로세스(서버간 토픽 버스) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...PART(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /topic/i.test(probe) || /partition/i.test(probe) || /fence/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(버스·열화가 결정론을 안 깸) ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(분단) 2회 → 같은 상태 + 인프로세스와도 동일(버스·열화가 결정론을 안 깸) ==');
  console.log('seed   | full 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run({ ...FAILS(seed), killZone: 'zone1' });
    const m1 = await runMulti(PART(seed));
    const m2 = await runMulti(PART(seed));
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
  console.log('== summary: 토픽 pub/sub 버스 + 소켓 층 열화(드롭·분단·재연결) 아래 인프로세스와 비트 동일(E2E 동치) ==');
  for (const seed of seeds) {
    const a = run({ ...FAILS(seed), killZone: 'zone1' });
    const b = await runMulti(PART(seed));
    const ok = logDigest(a) === logDigest(b) && fullDigest(a) === fullDigest(b) && finalLiveDesync(b) === 0 && maxOwners(b) === 1;
    if (!ok) FAILED = true;
    const C = b.cluster;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · TCP :${C.port} · 토픽 ${C.topics.length} · 분단 ${C.partitionHost}@${C.partitionAt} · 침묵 ${C.fencedAttempts}tick · 재연결생존 ${C.reconnectedAlive} · 소유자 ${maxOwners(b)} · log동일 ${logDigest(a) === logDigest(b)} · full동일 ${fullDigest(a) === fullDigest(b)} · desync ${finalLiveDesync(b)} | ${hex(fullDigest(b))}`);
  }
  console.log('버스 = 토픽 pub/sub(직접 주소결합 제거) · 열화 = 시드 드롭+resend·분단+failover·재연결+펜싱 · 인프로세스 모드면 0011 비트 동일');
}

// ── CLI ──
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  const ASYNC = { e2e, bus, drop, partition, isolate, hide, repro };
  if (mode === 'reg') reg(seedArg);
  else if (ASYNC[mode]) await ASYNC[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    await bus(seedArg); console.log('');
    await drop(seedArg); console.log('');
    await partition(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | bus | drop | partition | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
