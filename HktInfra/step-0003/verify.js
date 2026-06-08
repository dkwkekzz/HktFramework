// HktInfra step-0003 — 헤드리스 검증
// 사용: node step-0003/verify.js <mode> [seed]
//   mode: reg | conf | prop | auth | hide | bytes | swap | all
//     reg   — 회귀 0: 인터페이스 추출은 비-침습 → step-0001/0002 골든 해시와 비트 동일(off=골든, on=권위 비-침습).
//     conf  — 계약 동결(가설 핵심 a): 동결된 ISimCore 명세를 *실행 가능한 검사*로. 더미·array 둘 다 통과 + 교차 동일.
//     prop  — 결정론 전파: 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일(0002 유지).
//     auth  — 권위 보존 + 수렴: 권위=유일 소유자, 추종자 자기권위 0, desync 0(0002 유지).
//     hide  — 추종자는 내부: 클라 접점에 'zone1f' 0건, 복제 켜도 수명주기 불변(0002 유지).
//     bytes — 입력 재현 계측: 추종자로 간 상태 전송 0바이트(전부 입력)(0002 유지).
//     swap  — 가설 핵심 b: 단일 seam(makeSim)만 바꿔 더미→array 교체 → 골든 비트 동일 + 전 E2E 불변,
//             인프라 코드 무수정(구체 시뮬 이름 참조 = 0)을 구조적으로 확인.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const {
  run, fnv1a, PUBLIC_ADDRS, SIM_FACTORIES, SIM_CONTRACT_VERSION,
  DummySimCore, ArraySimCore, INFRA_CLASSES, CONCRETE_SIM_NAMES,
} = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const TICKS = 60;
const INTENTS = 20;
let FAILED = false;

// step-0001/0002 골든 해시 — 회귀 기준선 (STATE.md §2)
const GOLDEN = {
  42:   { hash: 0x053b46c7, chain: 0xf6bf5bb3 },
  7:    { hash: 0xa3d9fc76, chain: 0xb9bd47b9 },
  1234: { hash: 0xb95e74f5, chain: 0x12a3ba6a },
  99:   { hash: 0x61382ec8, chain: 0x05b378fb },
  2026: { hash: 0x6d49a41a, chain: 0x14eb17b1 },
};

function check(cond, label) {
  if (!cond) { FAILED = true; console.log('  FAIL: ' + label); }
  return cond ? 'OK' : 'FAIL';
}
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

// ── reg: 회귀 0 — 인터페이스 추출 비-침습. off=골든 비트동일, on=권위 비-침습 ──
function reg(seeds) {
  console.log('== reg: 회귀 0 — Sim 인터페이스 추출 비-침습(off=골든, on=권위 불변) ==');
  console.log('seed   | off hash   | off chain  | =골든 | on(권위) hash | =골든 | 판정');
  for (const seed of seeds) {
    const g = GOLDEN[seed];
    const off = run({ seed, ticks: TICKS, replicate: false });
    const on = run({ seed, ticks: TICKS, replicate: true });
    const offOk =
      check(off.hash === g.hash, `seed ${seed}: off hash ${hex(off.hash)} != 골든 ${hex(g.hash)}`) === 'OK' &&
      check(off.chain === g.chain, `seed ${seed}: off chain ${hex(off.chain)} != 골든 ${hex(g.chain)}`) === 'OK';
    const onOk =
      check(on.hash === g.hash, `seed ${seed}: on(권위) hash ${hex(on.hash)} != 골든 — 추출이 권위 침습`) === 'OK' &&
      check(on.chain === g.chain, `seed ${seed}: on(권위) chain ${hex(on.chain)} != 골든`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(off.hash)} | ${hex(off.chain)} | ${(offOk ? 'OK' : 'FAIL').padEnd(5)} | ${hex(on.hash).padEnd(13)} | ${(onOk ? 'OK' : 'FAIL').padEnd(5)} | ${offOk && onOk ? 'OK' : 'FAIL'}`);
  }
}

// ── conf: 동결된 ISimCore 계약을 실행 가능한 명세로 — 더미·array 둘 다 통과 + 교차 동일 ──
// 계약 v1: ① seed-only 결정론(2회 재현 동일) ② 수명주기(spawn 추가/despawn 제거·순서) ③ intent 적용수 정확
//          ④ 표현 무관(더미 vs array 비트 동일 trace) — C++ 교체가 의존할 핵심 불변.
function conf(seeds) {
  console.log(`== conf: ISimCore 계약 ${SIM_CONTRACT_VERSION} 동결 — 실행 가능 명세(더미·array 통과 + 교차 동일) ==`);
  console.log('seed   | impl  | det(2x) | 수명주기 | intent수 | trace해시  | 판정');
  const factories = { dummy: SIM_FACTORIES.dummy, array: SIM_FACTORIES.array };

  // 한 구현에 고정 호출열을 먹이고 매 단계 serialize() 를 모아 trace 해시를 만든다(결정론적 시나리오).
  function driveTrace(makeSim, seed) {
    const sim = makeSim(seed);
    const trace = [];
    const rng = require('./net-core.js').mulberry32((seed ^ 0xBEEF) >>> 0);
    sim.spawn('av1'); trace.push(sim.serialize());
    sim.spawn('av2'); trace.push(sim.serialize());
    for (let k = 0; k < 5; k++) {
      const intents = [
        { avatar: 'av1', intent: { dx: (rng() % 3) - 1, dy: (rng() % 3) - 1 } },
        { avatar: 'av2', intent: { dx: (rng() % 3) - 1, dy: (rng() % 3) - 1 } },
        { avatar: 'ghost', intent: { dx: 1, dy: 1 } }, // 존재 안 함 — applied 에 안 잡혀야
      ];
      const applied = sim.tick(intents);
      trace.push('applied=' + applied + ';' + sim.serialize());
    }
    sim.despawn('av1'); trace.push('ids=' + sim.liveIds().join(',') + ';' + sim.serialize());
    sim.tick([]); trace.push(sim.serialize());
    return trace;
  }

  const traceHash = {};
  for (const seed of seeds) {
    const perImpl = {};
    for (const [name, mk] of Object.entries(factories)) {
      const t1 = driveTrace(mk, seed);
      const t2 = driveTrace(mk, seed);                 // ① 2회 재현
      const det = JSON.stringify(t1) === JSON.stringify(t2);
      // ② 수명주기: 첫 두 trace 가 av1, av1|av2 (스폰 순서·추가), despawn 후 av1 빠짐
      const sim = mk(seed);
      sim.spawn('av1'); sim.spawn('av2');
      const lifeAdd = sim.liveIds().join(',') === 'av1,av2';
      sim.despawn('av1');
      const lifeDel = sim.liveIds().join(',') === 'av2';
      // ③ intent 적용수: 살아있는 2 + ghost 1 → applied = 2 (ghost 제외)
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
        check(det, `seed ${seed} ${name}: seed-only 결정론 위반(2회 trace 불일치)`) === 'OK' &&
        check(lifeAdd && lifeDel, `seed ${seed} ${name}: 수명주기 위반(spawn/despawn 순서·집합)`) === 'OK' &&
        check(intentOk, `seed ${seed} ${name}: intent 적용수 ${ap} != 2(ghost 누락 실패)`) === 'OK';
      console.log(`${pad(seed, 6)} | ${name.padEnd(5)} | ${(det ? 'OK' : 'FAIL').padEnd(7)} | ${((lifeAdd && lifeDel) ? 'OK' : 'FAIL').padEnd(8)} | ${(intentOk ? 'OK' : 'FAIL').padEnd(8)} | ${hex(th)} | ${ok ? 'OK' : 'FAIL'}`);
    }
    // ④ 표현 무관: 더미 trace 해시 == array trace 해시
    const cross = perImpl.dummy === perImpl.array;
    check(cross, `seed ${seed}: 표현 무관 위반 — dummy trace ${hex(perImpl.dummy)} != array ${hex(perImpl.array)}`);
    console.log(`       | cross | dummy==array trace: ${cross ? 'OK (표현 무관 — 계약이 표현 누설 안 함)' : 'FAIL'}`);
    traceHash[seed] = perImpl.dummy;
  }
}

// ── prop: 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일 (0002 유지) ──
function prop(seeds) {
  console.log('== prop: 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일 (복제=재현) ==');
  console.log('seed   | tick수 | 사슬불일치 tick | 최종상태 | hash       | chain      | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    const ah = r.zone.hashes, fh = r.follower.hashes;
    let mismatch = -1;
    const n = Math.max(ah.length, fh.length);
    for (let i = 0; i < n; i++) { if (ah[i] !== fh[i]) { mismatch = i; break; } }
    const sameLen = ah.length === fh.length;
    const sameState = r.state === r.fstate;
    const sameHash = r.hash === r.fhash && r.chain === r.fchain;
    const ok =
      check(sameLen, `seed ${seed}: tick 수 권위 ${ah.length} != 추종자 ${fh.length}`) === 'OK' &&
      check(mismatch === -1, `seed ${seed}: 해시 사슬 tick ${mismatch} 에서 desync`) === 'OK' &&
      check(sameState, `seed ${seed}: 최종 상태 문자열 불일치`) === 'OK' &&
      check(sameHash, `seed ${seed}: 최종 hash/chain 불일치`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(ah.length, 6)} | ${pad(mismatch === -1 ? '없음' : mismatch, 14)} | ${(sameState ? 'bit-equal' : 'DIFF').padEnd(8)} | ${hex(r.hash)} | ${hex(r.chain)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── auth: 권위=유일 소유자, 추종자 자기권위 0, desync 0 (0002 유지) ──
function auth(seeds) {
  console.log('== auth: 권위 단일 소유(권위존=1·추종자=0) + 겹친 뷰 수렴(desync 0) ==');
  console.log('seed   | 권위 ownViol | 권위 claims | 추종자 ownViol | 추종자 claims | desync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    const ah = r.zone.hashes, fh = r.follower.hashes;
    let desync = 0;
    for (let i = 0; i < Math.min(ah.length, fh.length); i++) if (ah[i] !== fh[i]) desync++;
    const aClaims = r.zone.authClaims;
    const fClaims = r.follower.authClaims;
    const ok =
      check(r.zone.ownerViolations === 0, `seed ${seed}: 권위 ownViol ${r.zone.ownerViolations}`) === 'OK' &&
      check(r.follower.ownerViolations === 0, `seed ${seed}: 추종자 ownViol ${r.follower.ownerViolations}`) === 'OK' &&
      check(fClaims === 0, `seed ${seed}: 추종자 자기권위 주장 ${fClaims} != 0`) === 'OK' &&
      check(desync === 0, `seed ${seed}: 겹친 뷰 desync ${desync} tick`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(r.zone.ownerViolations, 12)} | ${pad(aClaims, 11)} | ${pad(r.follower.ownerViolations, 14)} | ${pad(fClaims, 13)} | ${pad(desync, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── hide: 추종자는 내부 — 클라 메시지에 'zone1f' 0건, 복제 켜도 수명주기 불변 (0002 유지) ──
function hide(seeds) {
  console.log('== hide: 복제 켠 채 클라 접점 누설 0 + 수명주기 불변(views/applied) ==');
  console.log('seed   | 클라접점 | 누설 | 추종자주소 노출 | views | applied | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
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
      check(r.client.views >= INTENTS, `seed ${seed}: 뷰 ${r.client.views} < ${INTENTS}(복제가 수명주기 침습)`) === 'OK' &&
      check(r.zone.applied === INTENTS, `seed ${seed}: applied ${r.zone.applied} != ${INTENTS}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(leaks, 4)} | ${pad(followerExposed, 15)} | ${pad(r.client.views, 5)} | ${pad(r.zone.applied, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── bytes: 추종자로 간 상태 전송 0바이트 — 전부 입력 (0002 유지) ──
function bytes(seeds) {
  console.log('== bytes: 추종자 복제 = 입력 재현(상태 전송 0). vs 가정(전체 뷰 스트림) 절감 ==');
  console.log('seed   | 입력 msgs | 입력 B | 상태전송 B | 가정 상태전송 B | 절감 | 판정');
  const INPUT = new Set(['enter', 'intent', 'leave']);
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    const toFollower = r.net.log.filter(m => m.to === 'zone1f');
    let inputB = 0, stateB = 0, inputN = 0, stateN = 0;
    for (const m of toFollower) {
      const sz = JSON.stringify(m.payload).length;
      if (INPUT.has(m.payload.type)) { inputB += sz; inputN++; }
      else { stateB += sz; stateN++; }
    }
    let hypoB = 0;
    for (const m of r.net.log) if (m.from === 'zone1' && m.payload.type === 'view') hypoB += JSON.stringify(m.payload).length;
    const saving = hypoB > 0 ? (1 - inputB / hypoB) * 100 : 0;
    const ok =
      check(stateB === 0 && stateN === 0, `seed ${seed}: 추종자로 상태 전송 ${stateN}건/${stateB}B (0 이어야)`) === 'OK' &&
      check(inputB > 0, `seed ${seed}: 입력 전송 0 — 복제가 일어나지 않음`) === 'OK' &&
      check(inputB < hypoB, `seed ${seed}: 입력 ${inputB}B >= 가정 상태전송 ${hypoB}B (절감 없음)`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(inputN, 9)} | ${pad(inputB, 6)} | ${pad(stateB, 10)} | ${pad(hypoB, 15)} | ${pad(saving.toFixed(1) + '%', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── swap: 가설 핵심 — 단일 seam(makeSim)만 바꿔 더미→array 교체 → 골든 비트 동일 + 전 E2E 불변 ──
//   + 구조적 단일 seam: 인프라 클래스 소스 어디에도 구체 시뮬 이름 0건(교체 = 팩토리 1줄, 인프라 무수정).
function swap(seeds) {
  console.log('== swap: 단일 seam 으로 더미↔array(=C++ 스탠드인) 교체 → 골든 동일 + E2E 불변 ==');

  // 구조적 단일 seam: 인프라 클래스 소스에 'DummySimCore'/'ArraySimCore' 참조 0건이어야.
  let infraRefs = 0;
  const offenders = [];
  for (const [cname, cls] of Object.entries(INFRA_CLASSES)) {
    const src = cls.toString();
    for (const sim of CONCRETE_SIM_NAMES) {
      if (src.includes(sim)) { infraRefs++; offenders.push(`${cname}→${sim}`); }
    }
  }
  check(infraRefs === 0, `인프라가 구체 시뮬 이름 참조 ${infraRefs}건: ${offenders.join(', ')} (단일 seam 위반)`);
  console.log(`구조: 인프라 클래스(${Object.keys(INFRA_CLASSES).length}개) 의 구체 시뮬 이름 참조 = ${infraRefs}건` +
    ` → 교체 지점 = run.makeSim 단일 seam(인프라 코드 무수정). ${infraRefs === 0 ? 'OK' : 'FAIL'}`);
  console.log('');
  console.log('seed   | dummy hash | array hash | =골든(둘다) | f-desync(둘다) | ownViol(둘다) | leak(둘다) | 판정');

  for (const seed of seeds) {
    const g = GOLDEN[seed];
    const rd = run({ seed, ticks: TICKS, replicate: true, makeSim: SIM_FACTORIES.dummy });
    const ra = run({ seed, ticks: TICKS, replicate: true, makeSim: SIM_FACTORIES.array });

    function desyncOf(r) {
      const ah = r.zone.hashes, fh = r.follower.hashes; let d = 0;
      for (let i = 0; i < Math.min(ah.length, fh.length); i++) if (ah[i] !== fh[i]) d++;
      return d + (ah.length !== fh.length ? 1 : 0);
    }
    function leaksOf(r) {
      const cm = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
      let lk = 0;
      for (const m of cm) {
        const peer = m.from.startsWith('client') ? m.to : m.from;
        if (peer === 'zone1f') lk++;
      }
      return lk;
    }
    // 구현이 실제로 갈렸는지 확인 — 같은 골든이어도 simId 는 달라야(교체가 일어났다는 증거)
    const swapped = rd.simId !== ra.simId;
    const goldBoth =
      rd.hash === g.hash && rd.fhash === g.hash && rd.chain === g.chain && rd.fchain === g.chain &&
      ra.hash === g.hash && ra.fhash === g.hash && ra.chain === g.chain && ra.fchain === g.chain;
    const ds = desyncOf(rd), da = desyncOf(ra);
    const ov = rd.zone.ownerViolations + rd.follower.ownerViolations;
    const oa = ra.zone.ownerViolations + ra.follower.ownerViolations;
    const lk = leaksOf(rd), la = leaksOf(ra);
    const ok =
      check(swapped, `seed ${seed}: simId 동일(${rd.simId}) — 교체가 일어나지 않음`) === 'OK' &&
      check(goldBoth, `seed ${seed}: 두 구현이 골든에 비트 동일 도달 실패 (dummy ${hex(rd.hash)} / array ${hex(ra.hash)} / 골든 ${hex(g.hash)})`) === 'OK' &&
      check(ds === 0 && da === 0, `seed ${seed}: f-desync dummy ${ds} array ${da} != 0`) === 'OK' &&
      check(ov === 0 && oa === 0, `seed ${seed}: ownViol dummy ${ov} array ${oa} != 0`) === 'OK' &&
      check(lk === 0 && la === 0, `seed ${seed}: 추종자 클라 노출 dummy ${lk} array ${la} != 0`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(rd.hash)} | ${hex(ra.hash)} | ${((rd.hash === g.hash && ra.hash === g.hash) ? 'OK' : 'FAIL').padEnd(11)} | ${pad(ds + '/' + da, 14)} | ${pad(ov + '/' + oa, 13)} | ${pad(lk + '/' + la, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── summary: 시드 평균 + 더미/array 가 동시에 골든 도달 ─────────────────────
function summary(seeds) {
  console.log('== summary: 동결 인터페이스 뒤 두 구현이 입력만으로 동시에 골든 도달 + 단일 seam ==');
  const factories = [['dummy', SIM_FACTORIES.dummy], ['array', SIM_FACTORIES.array]];
  for (const seed of seeds) {
    const g = GOLDEN[seed];
    const parts = factories.map(([name, mk]) => {
      const r = run({ seed, ticks: TICKS, replicate: true, makeSim: mk });
      const match = (r.hash === g.hash && r.fhash === g.hash && r.chain === g.chain && r.fchain === g.chain);
      if (!match) FAILED = true;
      return `${name}=${match ? 'OK' : 'FAIL'}`;
    });
    console.log(`  seed ${pad(seed, 4)}: 권위=추종자=골든  ${parts.join('  ')}  (hash ${hex(g.hash)} chain ${hex(g.chain)})`);
  }
  let infraRefs = 0;
  for (const cls of Object.values(INFRA_CLASSES)) {
    const src = cls.toString();
    for (const sim of CONCRETE_SIM_NAMES) if (src.includes(sim)) infraRefs++;
  }
  console.log(`계약 ${SIM_CONTRACT_VERSION} 동결 · 구현 2종(dummy/array) · 인프라의 구체 시뮬 참조 ${infraRefs}건 → 교체 seam = makeSim 1곳 (ticks ${TICKS})`);
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
if (mode === 'reg') reg(seedArg);
else if (mode === 'conf') conf(seedArg);
else if (mode === 'prop') prop(seedArg);
else if (mode === 'auth') auth(seedArg);
else if (mode === 'hide') hide(seedArg);
else if (mode === 'bytes') bytes(seedArg);
else if (mode === 'swap') swap(seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  conf(seedArg); console.log('');
  prop(seedArg); console.log('');
  auth(seedArg); console.log('');
  hide(seedArg); console.log('');
  bytes(seedArg); console.log('');
  swap(seedArg); console.log('');
  summary(seedArg);
}
else { console.log('mode: reg | conf | prop | auth | hide | bytes | swap | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
