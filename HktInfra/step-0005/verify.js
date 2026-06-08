// HktInfra step-0005 — 헤드리스 검증 (간단한 더미 서버 동작)
// 사용: node step-0005/verify.js <mode> [seed]
//   mode: aoi | radius | life | hide | repro | all
//     aoi    — 각 클라가 받은 엔터티 정보(seen)가 *반경 R 안 그라운드 트루스*와 정확히 일치(서버 AOI 필터 정확).
//     radius — 반경 ↑ → 가시 엔터티 단조 증가, R≥grid 면 전체 가시(AOI 절감 → 0). 대역폭 절감 곡선.
//     life   — 수명주기: 떠난 엔터티가 주변 클라 AOI 에서 사라진다(enter/leave 브로드캐스트 반영).
//     hide   — 은닉: 클라는 게이트웨이만. 내부 주소·토폴로지(zone/registry/sessionId) 누설 0.
//     repro  — 라우팅 재현성: 같은 시드 → 같은 브로드캐스트 로그(Math.random 0, 시드 의사난수만).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const { run, fnv1a, PUBLIC_ADDRS } = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }
// 상태 다이제스트 — 최종 엔터티 위치 + 각 클라 가시 집합(AOI 결과). 시드 의존(위치 = 시드 PRNG).
function stateDigest(r) {
  const ents = [...r.zone.ents.entries()].sort().map(([id, e]) => id + ':' + e.x + ',' + e.y).join('|');
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).join(';');
  return fnv1a(ents + '#' + seen);
}

// ── aoi: 클라 seen == 반경 R 그라운드 트루스 (서버 AOI 필터 정확) ──
function aoi(seeds) {
  console.log('== aoi: 각 클라 수신 엔터티(seen) == 반경 R 안 그라운드 트루스 + AOI 대역폭 절감 ==');
  console.log('seed   | 클라 | 매칭 | 평균 가시 | 전체대비 절감 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4 });
    let match = 0, visSum = 0;
    for (const c of r.clients) {
      const truth = r.zone.aoiTruth(c.avatar);
      if (JSON.stringify(c.seenIds()) === JSON.stringify(truth)) match++;
      visSum += c.seenIds().length;
    }
    const save = (1 - r.zone.sent / r.zone.fullSent) * 100;
    const ok =
      check(match === r.clients.length, `seed ${seed}: seen!=AOI 트루스 (${match}/${r.clients.length})`) &&
      check(r.zone.sent < r.zone.fullSent, `seed ${seed}: AOI 필터가 아무것도 안 줄임`);
    console.log(`${pad(seed, 6)} | ${pad(r.clients.length, 4)} | ${pad(match + '/' + r.clients.length, 4)} | ${pad((visSum / r.clients.length).toFixed(2), 9)} | ${pad(save.toFixed(1) + '%', 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── radius: 반경 ↑ → 가시 단조 증가, R≥grid 면 전체(절감 0) ──
function radius(seeds) {
  console.log('== radius: 반경 ↑ → 가시 엔터티 단조 증가, R≥grid 면 전체 가시(AOI 절감→0) ==');
  console.log('(시드 ' + seeds.length + '종 합산, clients 6 · grid 16)');
  console.log('  반경 R | 보낸 엔터티 | 전체 가정 | 절감 | 단조? | 판정');
  let prev = -1;
  for (const R of [1, 2, 4, 8, 16]) {
    let sent = 0, full = 0;
    for (const seed of seeds) {
      const r = run({ seed, ticks: 40, clients: 6, moves: 30, radius: R, grid: 16 });
      sent += r.zone.sent; full += r.zone.fullSent;
    }
    const save = (1 - sent / full) * 100;
    const monotone = sent >= prev;            // 반경 클수록 더 많이 보낸다
    const fullAt16 = R < 16 || sent === full; // R≥grid → 전부 가시(절감 0)
    const ok = check(monotone, `반경 ${R}: 가시 비단조 (${sent} < ${prev})`) &&
      check(fullAt16, `반경 ${R}>=grid 인데 절감 ${save.toFixed(1)}% != 0`);
    console.log(`  ${pad(R, 6)} | ${pad(sent, 11)} | ${pad(full, 9)} | ${pad(save.toFixed(1) + '%', 6)} | ${(monotone ? '예' : '아니오').padEnd(5)} | ${ok ? 'OK' : 'FAIL'}`);
    prev = sent;
  }
}

// ── life: 떠난 엔터티가 주변 AOI 에서 사라진다 (enter/leave 브로드캐스트 반영) ──
function life(seeds) {
  console.log('== life: 수명주기 — 떠난 엔터티가 주변 클라 AOI 에서 사라진다(반경 8, 관측자 보장) ==');
  console.log('seed   | 떠난 엔터티 | 베이스라인 관측자 | 떠난 뒤 잔존 | 존에서 제거 | 판정');
  for (const seed of seeds) {
    // 반경 8 로 관측자 보장. client0(av1)이 tick 20 에 떠난다.
    const base = run({ seed, ticks: 40, clients: 5, moves: 30, radius: 8 });
    const target = base.clients[0].avatar;   // av1
    const observersBase = base.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const left = run({ seed, ticks: 40, clients: 5, moves: 30, radius: 8, leave: { 0: 20 } });
    const observersAfter = left.clients.slice(1).filter(c => c.seenIds().includes(target)).map(c => c.avatar);
    const removed = !left.zone.ents.has(target);
    const ok =
      check(observersBase.length > 0, `seed ${seed}: ${target} 관측자 없음(테스트 무의미)`) &&
      check(observersAfter.length === 0, `seed ${seed}: 떠난 ${target} 가 ${observersAfter.join(',')} 의 AOI 에 잔존`) &&
      check(removed, `seed ${seed}: 존에서 ${target} 미제거`);
    console.log(`${pad(seed, 6)} | ${pad(target, 11)} | ${pad(observersBase.length, 17)} | ${pad(observersAfter.length, 12)} | ${(removed ? '예' : '아니오').padEnd(11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: 클라는 게이트웨이만. 내부 토폴로지 누설 0 ──
function hide(seeds) {
  console.log('== hide: 클라 접점이 공개 주소(login·gateway)뿐 + 내부 토폴로지(zone/registry/sessionId) 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드 → 같은 브로드캐스트 로그(라우팅 결정성, Math.random 0) ──
function repro(seeds) {
  console.log('== repro: 같은 시드 → 같은 상태(위치+AOI 결과). 시드 의사난수만(Math.random 0) ==');
  console.log('seed   | 상태 다이제스트 | 2회 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const a = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4 });
    const b = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4 });
    const da = stateDigest(a), db = stateDigest(b);
    digests.add(da);
    const ok = check(da === db, `seed ${seed}: 같은 시드 상태 다름 (${hex(da)} != ${hex(db)})`);
    console.log(`${pad(seed, 6)} | ${hex(da)}      | ${(da === db ? 'OK' : 'FAIL').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──────────────────────────────────────────────────────────────
function summary(seeds) {
  console.log('== summary: 더미 서버 — 이벤트 → 주변 클라 AOI 브로드캐스트 → 엔터티 시각화 정보 ==');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 40, clients: 4, moves: 30, radius: 4 });
    let match = 0;
    for (const c of r.clients) if (JSON.stringify(c.seenIds()) === JSON.stringify(r.zone.aoiTruth(c.avatar))) match++;
    const save = (1 - r.zone.sent / r.zone.fullSent) * 100;
    const ok = match === r.clients.length;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: AOI 정확 ${match}/${r.clients.length} ${ok ? 'OK' : 'FAIL'} · 대역폭 절감 ${save.toFixed(1)}% · 상태 ${hex(stateDigest(r))}`);
  }
  console.log('AOI 브로드캐스트 = net-core/EntityZone(반경 4·grid 16) · 시뮬레이션 0(위치 맵만) · 시드 의사난수만');
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { aoi, radius, life, hide, repro };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  aoi(seedArg); console.log('');
  radius(seedArg); console.log('');
  life(seedArg); console.log('');
  hide(seedArg); console.log('');
  repro(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: aoi | radius | life | hide | repro | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
