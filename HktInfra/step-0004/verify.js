// HktInfra step-0004 — 헤드리스 검증
// 사용: node step-0004/verify.js <mode> [seed]
//   mode: reg | conf | prop | auth | sep | curve | hide | bytes | swap | all
//     reg   — 회귀 0: 전송 끔(transport=null)+INPUT_DELAY=1 → step-0001/0003 골든 비트 동일(스케줄·naive 둘 다).
//             동시에 engine/ 추출이 비-침습임을 증명(동결 Sim·엣지/코디 스텁 무수정 이전).
//     conf  — 동결 ISimCore v1 계약(engine) 무수정 확인: 더미·array 결정론·수명주기·intent·표현무관(0003 유지).
//     prop  — 결정론 전파(전송 ON): 스케줄 권위 사슬 = '전송 골든'(타이밍 불변), 추종자 매 tick 일치(desync 0).
//     auth  — 권위 보존·수렴(전송 ON): 권위=유일 소유자, 추종자 자기권위 0, desync 0(지연·재정렬·손실 아래).
//     sep   — 가설 핵심: 타이밍↔내용 분리. 스케줄=타이밍 불변(1 사슬)·desync 0 vs naive=타이밍 누설(N 사슬)·desync>0.
//     curve — 전송 열화 곡선: ⒜ 지연 절벽(delayMax>예산 → 마감 미스) ⒝ 손실 복원(redundancy↑ → desync→0).
//     hide  — 은닉 불변: 전송 ON 켜도 클라 접점 누설 0·추종자 비노출(0002/0003 유지).
//     bytes — 입력 재현 + 신뢰성 비용: 추종자 상태 전송 0, 입력만. redundancy = 대역폭 세(R× 사본).
//     swap  — 동결 Sim 교체(전송 ON): 단일 seam(makeSim)만 바꿔 더미↔array → 전송 골든 비트 동일, 인프라 무수정.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const {
  run, fnv1a, PUBLIC_ADDRS, SIM_FACTORIES, SIM_CONTRACT_VERSION,
  mulberry32, INFRA_CLASSES, CONCRETE_SIM_NAMES,
} = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const TICKS = 60;
const INTENTS = 20;
const INPUT_DELAY = 8;                 // 전송 ON 입력 지연 버퍼 깊이(예산 = INPUT_DELAY-1 = 7 tick)
const TIMING_SEEDS = [1, 2, 3, 4, 5];  // 전송 타이밍을 흔드는 시드들(내용 불변 증명용)
const NOMINAL = (ts) => ({ delayMin: 0, delayMax: 4, loss: 0.1, redundancy: 4, seed: ts }); // 지연+재정렬+손실(복원됨)
let FAILED = false;

// step-0001/0003 골든 — 회귀 기준선(전송 끔·INPUT_DELAY=1, STATE.md §2)
const GOLDEN = {
  42:   { hash: 0x053b46c7, chain: 0xf6bf5bb3 },
  7:    { hash: 0xa3d9fc76, chain: 0xb9bd47b9 },
  1234: { hash: 0xb95e74f5, chain: 0x12a3ba6a },
  99:   { hash: 0x61382ec8, chain: 0x05b378fb },
  2026: { hash: 0x6d49a41a, chain: 0x14eb17b1 },
};
// 전송 골든 — INPUT_DELAY=8 스케줄 사슬(전송 OFF/ON·타이밍 무관 불변). 내용 = f(seed, INPUT_DELAY).
const TGOLDEN = {
  42:   { hash: 0x08290f62, chain: 0xc6ad90c0 },
  7:    { hash: 0x1e7a4aa1, chain: 0x010e8d5f },
  1234: { hash: 0xdfaa8380, chain: 0xacf27e33 },
  99:   { hash: 0xfd34a8db, chain: 0xf0e7a8a7 },
  2026: { hash: 0x0d23de9d, chain: 0xb22abeff },
};

function check(cond, label) {
  if (!cond) { FAILED = true; console.log('  FAIL: ' + label); }
  return cond ? 'OK' : 'FAIL';
}
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }
function desyncOf(r) {
  const a = r.zone.hashes, f = r.follower.hashes; let d = 0;
  for (let i = 0; i < Math.min(a.length, f.length); i++) if (a[i] !== f[i]) d++;
  return d + (a.length !== f.length ? 1 : 0);
}

// ── reg: 회귀 0 — 전송 끔+INPUT_DELAY=1 → 0001/0003 골든 비트 동일(스케줄·naive 둘 다) ──
function reg(seeds) {
  console.log('== reg: 회귀 0 — 전송 끔(null)+INPUT_DELAY=1 → 0001/0003 골든 비트 동일(engine 추출 비-침습) ==');
  console.log('seed   | sched off hash | =골든 | sched on(권위) | =골든 | naive off | =골든 | 판정');
  for (const seed of seeds) {
    const g = GOLDEN[seed];
    const sOff = run({ seed, ticks: TICKS, replicate: false, transport: null, inputDelay: 1, schedule: true });
    const sOn = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: 1, schedule: true });
    const nOff = run({ seed, ticks: TICKS, replicate: false, transport: null, inputDelay: 1, schedule: false });
    const sOffOk = sOff.hash === g.hash && sOff.chain === g.chain;
    const sOnOk = sOn.hash === g.hash && sOn.chain === g.chain;
    const nOffOk = nOff.hash === g.hash && nOff.chain === g.chain;
    const ok =
      check(sOffOk, `seed ${seed}: sched off ${hex(sOff.hash)}/${hex(sOff.chain)} != 골든`) === 'OK' &&
      check(sOnOk, `seed ${seed}: sched on(권위) != 골든 — 추출/스케줄이 권위 침습`) === 'OK' &&
      check(nOffOk, `seed ${seed}: naive off != 골든`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(sOff.hash)}     | ${(sOffOk ? 'OK' : 'FAIL').padEnd(5)} | ${(sOnOk ? 'OK' : 'FAIL').padEnd(14)} | ${(sOnOk ? 'OK' : 'FAIL').padEnd(5)} | ${(nOffOk ? 'OK' : 'FAIL').padEnd(9)} | ${(nOffOk ? 'OK' : 'FAIL').padEnd(5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── conf: 동결 ISimCore v1 계약(engine 이전) 무수정 — 더미·array 결정론·수명주기·intent·표현무관(0003 유지) ──
function conf(seeds) {
  console.log(`== conf: ISimCore ${SIM_CONTRACT_VERSION} 계약 동결 유지(engine 추출 후) — 더미·array 통과 + 교차 동일 ==`);
  console.log('seed   | impl  | det(2x) | 수명주기 | intent수 | trace해시  | 판정');
  const factories = { dummy: SIM_FACTORIES.dummy, array: SIM_FACTORIES.array };
  function driveTrace(makeSim, seed) {
    const sim = makeSim(seed);
    const trace = [];
    const rng = mulberry32((seed ^ 0xBEEF) >>> 0);
    sim.spawn('av1'); trace.push(sim.serialize());
    sim.spawn('av2'); trace.push(sim.serialize());
    for (let k = 0; k < 5; k++) {
      const intents = [
        { avatar: 'av1', intent: { dx: (rng() % 3) - 1, dy: (rng() % 3) - 1 } },
        { avatar: 'av2', intent: { dx: (rng() % 3) - 1, dy: (rng() % 3) - 1 } },
        { avatar: 'ghost', intent: { dx: 1, dy: 1 } },
      ];
      trace.push('applied=' + sim.tick(intents) + ';' + sim.serialize());
    }
    sim.despawn('av1'); trace.push('ids=' + sim.liveIds().join(',') + ';' + sim.serialize());
    sim.tick([]); trace.push(sim.serialize());
    return trace;
  }
  for (const seed of seeds) {
    const perImpl = {};
    for (const [name, mk] of Object.entries(factories)) {
      const t1 = driveTrace(mk, seed), t2 = driveTrace(mk, seed);
      const det = JSON.stringify(t1) === JSON.stringify(t2);
      const sim = mk(seed); sim.spawn('av1'); sim.spawn('av2');
      const lifeAdd = sim.liveIds().join(',') === 'av1,av2';
      sim.despawn('av1');
      const lifeDel = sim.liveIds().join(',') === 'av2';
      const sim2 = mk(seed); sim2.spawn('a'); sim2.spawn('b');
      const ap = sim2.tick([
        { avatar: 'a', intent: { dx: 1, dy: 0 } },
        { avatar: 'b', intent: { dx: 0, dy: 1 } },
        { avatar: 'ghost', intent: { dx: 1, dy: 1 } },
      ]);
      const intentOk = ap === 2;
      const th = fnv1a(JSON.stringify(t1));
      perImpl[name] = th;
      const ok =
        check(det, `seed ${seed} ${name}: seed-only 결정론 위반`) === 'OK' &&
        check(lifeAdd && lifeDel, `seed ${seed} ${name}: 수명주기 위반`) === 'OK' &&
        check(intentOk, `seed ${seed} ${name}: intent 적용수 ${ap} != 2`) === 'OK';
      console.log(`${pad(seed, 6)} | ${name.padEnd(5)} | ${(det ? 'OK' : 'FAIL').padEnd(7)} | ${((lifeAdd && lifeDel) ? 'OK' : 'FAIL').padEnd(8)} | ${(intentOk ? 'OK' : 'FAIL').padEnd(8)} | ${hex(th)} | ${ok ? 'OK' : 'FAIL'}`);
    }
    const cross = perImpl.dummy === perImpl.array;
    check(cross, `seed ${seed}: 표현 무관 위반 — dummy ${hex(perImpl.dummy)} != array ${hex(perImpl.array)}`);
    console.log(`       | cross | dummy==array trace: ${cross ? 'OK (표현 무관)' : 'FAIL'}`);
  }
}

// ── prop: 결정론 전파(전송 ON) — 스케줄 권위 사슬 = 전송 골든(타이밍 불변), 추종자 매 tick 일치(desync 0) ──
function prop(seeds) {
  console.log('== prop: 전송 ON(지연·재정렬·손실) — 스케줄 권위 사슬 = 전송 골든(타이밍 불변) + 추종자 일치(desync 0) ==');
  console.log('seed   | 권위 hash  | =전송골든 | 추종자 desync | lateMiss | 타이밍5종 사슬 | 판정');
  for (const seed of seeds) {
    const tg = TGOLDEN[seed];
    let chains = new Set(), ds = 0, late = 0, base = null;
    for (const ts of TIMING_SEEDS) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(ts), inputDelay: INPUT_DELAY, schedule: true });
      chains.add(r.chain); ds += desyncOf(r); late += r.lateMissed;
      if (base === null) base = r;
    }
    const goldOk = base.hash === tg.hash && base.chain === tg.chain && base.fhash === tg.hash && base.fchain === tg.chain;
    const invariant = chains.size === 1;
    const ok =
      check(goldOk, `seed ${seed}: 권위/추종자 ${hex(base.hash)}/${hex(base.chain)} != 전송골든 ${hex(tg.hash)}/${hex(tg.chain)}`) === 'OK' &&
      check(invariant, `seed ${seed}: 타이밍 ${TIMING_SEEDS.length}종에서 사슬 ${chains.size}개 — 타이밍이 내용으로 누설`) === 'OK' &&
      check(ds === 0, `seed ${seed}: 추종자 desync 합 ${ds}`) === 'OK' &&
      check(late === 0, `seed ${seed}: 마감 미스 ${late}(예산 부족)`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(base.hash)} | ${(goldOk ? 'OK' : 'FAIL').padEnd(9)} | ${pad(ds, 13)} | ${pad(late, 8)} | ${pad(chains.size + ' uniq', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── auth: 권위 보존·수렴(전송 ON) — 권위=유일 소유, 추종자 자기권위 0, desync 0 ──
function auth(seeds) {
  console.log('== auth: 전송 ON — 권위 단일 소유(권위=1·추종자=0) + 겹친 뷰 수렴(desync 0) ==');
  console.log('seed   | 권위 ownViol | 권위 claims | 추종자 ownViol | 추종자 claims | desync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(1), inputDelay: INPUT_DELAY, schedule: true });
    const ds = desyncOf(r);
    const ok =
      check(r.zone.ownerViolations === 0, `seed ${seed}: 권위 ownViol ${r.zone.ownerViolations}`) === 'OK' &&
      check(r.follower.ownerViolations === 0, `seed ${seed}: 추종자 ownViol ${r.follower.ownerViolations}`) === 'OK' &&
      check(r.follower.authClaims === 0, `seed ${seed}: 추종자 자기권위 ${r.follower.authClaims} != 0`) === 'OK' &&
      check(ds === 0, `seed ${seed}: 겹친 뷰 desync ${ds} tick`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(r.zone.ownerViolations, 12)} | ${pad(r.zone.authClaims, 11)} | ${pad(r.follower.ownerViolations, 14)} | ${pad(r.follower.authClaims, 13)} | ${pad(ds, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── sep: 가설 핵심 — 타이밍↔내용 분리. 스케줄=타이밍 불변·desync 0 vs naive=타이밍 누설·desync>0 ──
function sep(seeds) {
  console.log('== sep: "타이밍은 토폴로지 함수, 내용만 시드 함수" — 스케줄(분리) vs naive(누설), 같은 전송 아래 ==');
  console.log('       (전송 타이밍 ' + TIMING_SEEDS.length + '종에 같은 입력열을 흘리고, 권위 사슬이 타이밍에 흔들리는가)');
  console.log('seed   | SCHED 사슬종수 | SCHED desync | =전송골든 | NAIVE 사슬종수 | NAIVE desync | 분리 입증');
  for (const seed of seeds) {
    const tg = TGOLDEN[seed];
    const sChains = new Set(), nChains = new Set();
    let sDs = 0, nDs = 0, sGold = true;
    for (const ts of TIMING_SEEDS) {
      const tp = { delayMin: 0, delayMax: 4, loss: 0, redundancy: 1, seed: ts }; // 손실 0 — 순수 지연·재정렬만
      const s = run({ seed, ticks: TICKS, replicate: true, transport: tp, inputDelay: INPUT_DELAY, schedule: true });
      const n = run({ seed, ticks: TICKS, replicate: true, transport: tp, inputDelay: INPUT_DELAY, schedule: false });
      sChains.add(s.chain); nChains.add(n.chain); sDs += desyncOf(s); nDs += desyncOf(n);
      if (s.chain !== tg.chain) sGold = false;
    }
    // 분리 입증: 스케줄은 타이밍 1종(불변)·desync 0·전송골든 / naive 는 타이밍 다종·desync>0
    const proved = sChains.size === 1 && sDs === 0 && sGold && nChains.size > 1 && nDs > 0;
    const ok = check(proved, `seed ${seed}: 분리 미입증 (sched ${sChains.size}/${sDs} naive ${nChains.size}/${nDs})`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(sChains.size, 14)} | ${pad(sDs, 12)} | ${(sGold ? 'OK' : 'FAIL').padEnd(9)} | ${pad(nChains.size, 14)} | ${pad(nDs, 12)} | ${ok ? 'OK (분리됨)' : 'FAIL'}`);
  }
}

// ── curve: 전송 열화 곡선 — ⒜ 지연 절벽(예산 경계) ⒝ 손실 복원(redundancy) ──
function curve(seeds) {
  console.log('== curve: 전송 열화 곡선 — 스케줄 복제가 어디까지 버티고 어디서 무너지는가 ==');
  console.log(`(INPUT_DELAY=${INPUT_DELAY} → 흡수 예산 = ${INPUT_DELAY - 1} tick. 시드 ${seeds.length}종 × 타이밍 3종 합산)`);

  console.log('\n  ⒜ 지연 절벽 (loss=0, redundancy=1): delayMax 가 예산을 넘으면 마감 미스 → 갈림');
  console.log('  delayMax | 예산내? | desync 합 | lateMiss 합 | 관측 maxDelay | 판정');
  for (const dmax of [2, 5, 7, 8, 10]) {
    let ds = 0, late = 0, maxd = 0;
    for (const seed of seeds) for (const ts of [1, 2, 3]) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: { delayMin: 0, delayMax: dmax, loss: 0, redundancy: 1, seed: ts }, inputDelay: INPUT_DELAY, schedule: true });
      ds += desyncOf(r); late += r.lateMissed; maxd = Math.max(maxd, r.stats.maxDelay);
    }
    const within = dmax <= INPUT_DELAY - 1;
    // 예산 안이면 desync 0·미스 0 이어야, 예산 밖이면 미스>0
    const ok = within ? (ds === 0 && late === 0) : (late > 0);
    if (!ok) FAILED = true;
    console.log(`  ${pad(dmax, 8)} | ${(within ? '예' : '아니오').padEnd(6)} | ${pad(ds, 9)} | ${pad(late, 11)} | ${pad(maxd, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }

  console.log('\n  ⒝ 손실 복원 (delayMax=2, loss=10%): redundancy(중복 송신)↑ → 손실 흡수 → desync→0');
  console.log('  redundancy | desync 합 | 손실 사본 | 총 사본 | 신뢰성 회복? | 판정');
  let prevDs = Infinity;
  for (const R of [1, 2, 3, 4]) {
    let ds = 0, lost = 0, copies = 0;
    for (const seed of seeds) for (const ts of [1, 2, 3]) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: { delayMin: 0, delayMax: 2, loss: 0.1, redundancy: R, seed: ts }, inputDelay: INPUT_DELAY, schedule: true });
      ds += desyncOf(r); lost += r.stats.lost; copies += r.stats.copies;
    }
    const monotone = ds <= prevDs;       // 중복 늘수록 desync 단조 감소(복원이 작동)
    const ok = monotone && (R < 3 || ds === 0); // R≥3 에서 완전 복원(이 파라미터)
    if (!ok) FAILED = true;
    console.log(`  ${pad(R, 10)} | ${pad(ds, 9)} | ${pad(lost, 9)} | ${pad(copies, 7)} | ${((ds < prevDs || ds === 0) ? '예' : '—').padEnd(11)} | ${ok ? 'OK' : 'FAIL'}`);
    prevDs = ds;
  }
}

// ── hide: 은닉 불변(전송 ON 켜도) — 클라 접점 누설 0·추종자 비노출 (0002/0003 유지) ──
function hide(seeds) {
  console.log('== hide: 전송 ON 켠 채 클라 접점 누설 0 + 추종자 비노출 + 수명주기 적용 완결 ==');
  console.log('seed   | 클라접점 | 누설 | 추종자노출 | views | applied | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(1), inputDelay: INPUT_DELAY, schedule: true });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let leaks = 0, followerExposed = 0, badAddr = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      if (peer === 'zone1f') followerExposed++;
      const probe = JSON.stringify(Object.assign({}, m.payload, { view: undefined }));
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe)) leaks++;
    }
    const ok =
      check(leaks === 0, `seed ${seed}: 누설 ${leaks}건`) === 'OK' &&
      check(followerExposed === 0, `seed ${seed}: 추종자 주소 클라 노출 ${followerExposed}건`) === 'OK' &&
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) === 'OK' &&
      check(r.client.views > 0, `seed ${seed}: 뷰 ${r.client.views} — 뷰가 흐르지 않음`) === 'OK' &&
      check(r.zone.applied === INTENTS, `seed ${seed}: applied ${r.zone.applied} != ${INTENTS}(전송이 입력 분실)`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(leaks, 4)} | ${pad(followerExposed, 10)} | ${pad(r.client.views, 5)} | ${pad(r.zone.applied, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── bytes: 입력 재현(상태 전송 0) + 신뢰성 비용(redundancy = 대역폭 세) ──
//   step-0004 의 진짜 화두는 *신뢰성의 대역폭 세*다 — 손실 복원을 위해 같은 입력을 R 번 송신.
//   추종자로 가는 상태 전송은 여전히 0(복제=재현, 상태전송 아님 — 0002/0003 불변).
//   ※ '전체-뷰 vs 입력' 절감은 단일 엔티티에선 한계적(0002 §6, ~8%) → at 도장+엔티티1 에선 break-even.
//      입력-복제의 본 이득은 *엔티티 수에 비례*(다중 엔티티 = 후속) — 여기선 정보로만 보고, pass 조건 아님.
function bytes(seeds) {
  console.log('== bytes: 추종자 복제 = 입력 재현(상태 전송 0) + 신뢰성 세(redundancy = R× 와이어 사본) ==');
  console.log('seed   | 논리 입력 | 입력 B | 상태전송 B | 와이어 사본 | =R×논리전송 | 손실(복원됨) | vs전체뷰(정보) | 판정');
  const INPUT = new Set(['enter', 'intent', 'leave']);
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(1), inputDelay: INPUT_DELAY, schedule: true });
    const toFollower = r.net.log.filter(m => m.to === 'zone1f'); // 논리(고유) 송신 — net.log 는 고유 1건씩
    let inputB = 0, stateB = 0, inputN = 0, stateN = 0;
    for (const m of toFollower) {
      const sz = JSON.stringify(m.payload).length;
      if (INPUT.has(m.payload.type)) { inputB += sz; inputN++; } else { stateB += sz; stateN++; }
    }
    // 전송된 라우트(게이트웨이→존 둘 다)의 논리 송신 수 — 와이어 사본 = R × 이것(손실 전).
    const logicalTransported = r.net.log.filter(m => m.from === 'gateway' && /^zone/.test(m.to) && INPUT.has(m.payload.type)).length;
    const redundancyOk = r.stats.copies === 4 * logicalTransported; // NOMINAL redundancy=4
    let hypoB = 0;
    for (const m of r.net.log) if (m.from === 'zone1' && m.payload.type === 'view') hypoB += JSON.stringify(m.payload).length;
    const vsView = hypoB > 0 ? ((1 - inputB / hypoB) * 100).toFixed(1) + '%' : 'n/a';
    const ok =
      check(stateB === 0 && stateN === 0, `seed ${seed}: 추종자로 상태 전송 ${stateN}건/${stateB}B (0 이어야)`) === 'OK' &&
      check(inputB > 0, `seed ${seed}: 입력 전송 0`) === 'OK' &&
      check(redundancyOk, `seed ${seed}: 와이어 사본 ${r.stats.copies} != 4×논리전송 ${logicalTransported}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(inputN, 9)} | ${pad(inputB, 6)} | ${pad(stateB, 10)} | ${pad(r.stats.copies, 11)} | ${(redundancyOk ? 'OK' : 'FAIL').padEnd(11)} | ${pad(r.stats.lost, 12)} | ${pad(vsView, 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── swap: 동결 Sim 교체(전송 ON) — makeSim 1줄만 바꿔 더미↔array → 전송 골든 비트 동일, 인프라 무수정 ──
function swap(seeds) {
  console.log('== swap: 전송 ON 에서도 단일 seam(makeSim)으로 더미↔array 교체 → 전송 골든 동일 + E2E 불변 ==');
  let infraRefs = 0; const offenders = [];
  for (const [cname, cls] of Object.entries(INFRA_CLASSES)) {
    const src = cls.toString();
    for (const sim of CONCRETE_SIM_NAMES) if (src.includes(sim)) { infraRefs++; offenders.push(`${cname}→${sim}`); }
  }
  check(infraRefs === 0, `인프라가 구체 시뮬 이름 참조 ${infraRefs}건: ${offenders.join(', ')}`);
  console.log(`구조: 인프라 클래스(${Object.keys(INFRA_CLASSES).length}개, engine 포함) 구체 시뮬 참조 = ${infraRefs}건 → 교체 = makeSim 단일 seam. ${infraRefs === 0 ? 'OK' : 'FAIL'}`);
  console.log('');
  console.log('seed   | dummy hash | array hash | =전송골든(둘다) | f-desync(d/a) | ownViol(d/a) | 판정');
  for (const seed of seeds) {
    const tg = TGOLDEN[seed];
    const rd = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(1), inputDelay: INPUT_DELAY, schedule: true, makeSim: SIM_FACTORIES.dummy });
    const ra = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(1), inputDelay: INPUT_DELAY, schedule: true, makeSim: SIM_FACTORIES.array });
    const swapped = rd.simId !== ra.simId;
    const goldBoth =
      rd.hash === tg.hash && rd.fhash === tg.hash && rd.chain === tg.chain && rd.fchain === tg.chain &&
      ra.hash === tg.hash && ra.fhash === tg.hash && ra.chain === tg.chain && ra.fchain === tg.chain;
    const ds = desyncOf(rd), da = desyncOf(ra);
    const ov = rd.zone.ownerViolations + rd.follower.ownerViolations;
    const oa = ra.zone.ownerViolations + ra.follower.ownerViolations;
    const ok =
      check(swapped, `seed ${seed}: simId 동일(${rd.simId}) — 교체 안 일어남`) === 'OK' &&
      check(goldBoth, `seed ${seed}: 두 구현 전송골든 비트 동일 실패 (d ${hex(rd.hash)} a ${hex(ra.hash)} 골든 ${hex(tg.hash)})`) === 'OK' &&
      check(ds === 0 && da === 0, `seed ${seed}: f-desync d ${ds} a ${da}`) === 'OK' &&
      check(ov === 0 && oa === 0, `seed ${seed}: ownViol d ${ov} a ${oa}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(rd.hash)} | ${hex(ra.hash)} | ${(goldBoth ? 'OK' : 'FAIL').padEnd(15)} | ${pad(ds + '/' + da, 13)} | ${pad(ov + '/' + oa, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── summary ──────────────────────────────────────────────────────────────
function summary(seeds) {
  console.log('== summary: 전송 모델 위에서 — 회귀 0 + 타이밍↔내용 분리 + 권위·수렴 불변 ==');
  for (const seed of seeds) {
    const g = GOLDEN[seed], tg = TGOLDEN[seed];
    const reg0 = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: 1, schedule: true });
    const onN = run({ seed, ticks: TICKS, replicate: true, transport: NOMINAL(3), inputDelay: INPUT_DELAY, schedule: true });
    const regOk = reg0.hash === g.hash && reg0.chain === g.chain;
    const tgOk = onN.hash === tg.hash && onN.chain === tg.chain && onN.fchain === tg.chain && desyncOf(onN) === 0;
    if (!regOk || !tgOk) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 회귀0 ${regOk ? 'OK' : 'FAIL'}(${hex(g.chain)}) · 전송ON 권위=추종자=전송골든 ${tgOk ? 'OK' : 'FAIL'}(${hex(tg.chain)})`);
  }
  console.log(`전송 substrate = engine/Net(지연·손실·재정렬) · 분리 = net-core/ZoneHost 논리-tick(INPUT_DELAY=${INPUT_DELAY}) (ticks ${TICKS})`);
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, conf, prop, auth, sep, curve, hide, bytes, swap };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  conf(seedArg); console.log('');
  prop(seedArg); console.log('');
  auth(seedArg); console.log('');
  sep(seedArg); console.log('');
  curve(seedArg); console.log('');
  hide(seedArg); console.log('');
  bytes(seedArg); console.log('');
  swap(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | conf | prop | auth | sep | curve | hide | bytes | swap | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
