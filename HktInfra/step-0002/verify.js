// HktInfra step-0002 — 헤드리스 검증
// 사용: node step-0002/verify.js <mode> [seed]
//   mode: reg | prop | auth | hide | bytes | all
//     reg   — 회귀 0: replicate off → step-0001 골든 해시와 비트 동일. on 이어도 권위 존 불변(비-침습).
//     prop  — 결정론 전파(가설): 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일.
//     auth  — 권위 보존 + 수렴: 권위=유일 소유자, 추종자 자기권위 0, desync(겹친 뷰 불일치) 0.
//     hide  — 추종자는 내부: 클라 접점 메시지에 'zone1f' 0건, 복제 켜도 클라 수명주기 불변.
//     bytes — 가설 계측: 추종자로 간 *상태 전송* 0바이트(전부 입력) vs 가정 상태전송(전체 뷰 스트림).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const { run, fnv1a, PUBLIC_ADDRS } = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const TICKS = 60;
const INTENTS = 20;
let FAILED = false;

// step-0001 골든 해시 — 회귀(reg) 기준선 (STATE.md §2 / step-0001 §5)
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

// ── ② 회귀 0 (reg): 복제 플래그 off → 골든 비트 동일. on → 권위 존 여전히 골든(비-침습) ──
function reg(seeds) {
  console.log('== reg: 회귀 0 — replicate off=골든 비트동일, on=권위 비-침습(골든 유지) ==');
  console.log('seed   | off hash   | off chain  | =골든 | on(권위) hash | =골든 | 판정');
  for (const seed of seeds) {
    const g = GOLDEN[seed];
    const off = run({ seed, ticks: TICKS, replicate: false });
    const on = run({ seed, ticks: TICKS, replicate: true });
    const offOk =
      check(off.hash === g.hash, `seed ${seed}: off hash ${hex(off.hash)} != 골든 ${hex(g.hash)}`) === 'OK' &&
      check(off.chain === g.chain, `seed ${seed}: off chain ${hex(off.chain)} != 골든 ${hex(g.chain)}`) === 'OK';
    // 복제 켜도 권위 존의 입력열은 1바이트도 안 바뀐다(추종자 미러는 다른 액터로) → 골든 그대로
    const onOk =
      check(on.hash === g.hash, `seed ${seed}: on(권위) hash ${hex(on.hash)} != 골든 ${hex(g.hash)} — 복제가 권위 침습`) === 'OK' &&
      check(on.chain === g.chain, `seed ${seed}: on(권위) chain ${hex(on.chain)} != 골든`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(off.hash)} | ${hex(off.chain)} | ${(offOk ? 'OK' : 'FAIL').padEnd(5)} | ${hex(on.hash).padEnd(13)} | ${(onOk ? 'OK' : 'FAIL').padEnd(5)} | ${offOk && onOk ? 'OK' : 'FAIL'}`);
  }
}

// ── ① 결정론 전파 (prop, 가설): 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일 ──
function prop(seeds) {
  console.log('== prop: 권위·추종자 매 tick 해시 사슬 일치 + 최종 상태 비트 동일 (복제=재현) ==');
  console.log('seed   | tick수 | 사슬불일치 tick | 최종상태 | hash       | chain      | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    const ah = r.zone.hashes, fh = r.follower.hashes;
    // 매 tick 해시 사슬을 인덱스별로 비교 — 한 tick 이라도 어긋나면 desync
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

// ── ③ 권위 보존 + 수렴 (auth): 권위=유일 소유자, 추종자 자기권위 0, desync 0 ──
function auth(seeds) {
  console.log('== auth: 권위 단일 소유(권위존=1·추종자=0) + 겹친 뷰 수렴(desync 0) ==');
  console.log('seed   | 권위 ownViol | 권위 claims | 추종자 ownViol | 추종자 claims | desync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    // 권위: 모든 엔티티를 자기 권위로 소유(claims = 엔티티수), 위반 0
    // 추종자: 위반 0(소유자 장부 = 권위 존), 자기 권위 주장 0(읽기 전용 재현)
    const ah = r.zone.hashes, fh = r.follower.hashes;
    let desync = 0;
    for (let i = 0; i < Math.min(ah.length, fh.length); i++) if (ah[i] !== fh[i]) desync++;
    const aClaims = r.zone.authClaims;       // 마지막 tick 기준(엔티티 1 — 입장 중)
    const fClaims = r.follower.authClaims;   // 0 이어야
    const ok =
      check(r.zone.ownerViolations === 0, `seed ${seed}: 권위 ownViol ${r.zone.ownerViolations}`) === 'OK' &&
      check(r.follower.ownerViolations === 0, `seed ${seed}: 추종자 ownViol ${r.follower.ownerViolations}`) === 'OK' &&
      check(fClaims === 0, `seed ${seed}: 추종자 자기권위 주장 ${fClaims} != 0`) === 'OK' &&
      check(desync === 0, `seed ${seed}: 겹친 뷰 desync ${desync} tick`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(r.zone.ownerViolations, 12)} | ${pad(aClaims, 11)} | ${pad(r.follower.ownerViolations, 14)} | ${pad(fClaims, 13)} | ${pad(desync, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── ④ 은닉 (hide): 추종자는 내부 — 클라 메시지에 'zone1f' 0건, 복제 켜도 수명주기 불변 ──
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

// ── ④ 가설 계측 (bytes): 추종자로 간 *상태 전송* 0바이트 — 전부 입력. vs 가정 상태전송 ──
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
      else { stateB += sz; stateN++; } // view/snapshot 등 — 0 이어야 한다
    }
    // 가정: 복제를 *상태 전송*으로 했다면 권위가 매 tick 추종자에 전체 뷰를 보냈을 것.
    // 권위가 게이트웨이로 보낸 view 스트림의 바이트가 그 대용 척도.
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

// ── 요약 (summary): 시드 평균 + 권위=추종자 골든 동시 도달 확인 ─────────────
function summary(seeds) {
  console.log('== summary: 권위·추종자가 입력만으로 동시에 골든 상태 도달 ==');
  let inSum = 0, hypoSum = 0;
  const INPUT = new Set(['enter', 'intent', 'leave']);
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true });
    const g = GOLDEN[seed];
    let inputB = 0, hypoB = 0;
    for (const m of r.net.log) {
      if (m.to === 'zone1f' && INPUT.has(m.payload.type)) inputB += JSON.stringify(m.payload).length;
      if (m.from === 'zone1' && m.payload.type === 'view') hypoB += JSON.stringify(m.payload).length;
    }
    inSum += inputB; hypoSum += hypoB;
    const match = (r.hash === g.hash && r.fhash === g.hash && r.chain === g.chain && r.fchain === g.chain);
    console.log(`  seed ${pad(seed, 4)}: 권위=추종자=골든 ${match ? 'OK' : 'FAIL'}  (hash ${hex(r.hash)} chain ${hex(r.chain)}, 입력 ${inputB}B vs 가정 ${hypoB}B)`);
    if (!match) FAILED = true;
  }
  console.log(`평균(시드 ${seeds.length}): 복제 입력 ${(inSum / seeds.length).toFixed(1)}B vs 가정 상태전송 ${(hypoSum / seeds.length).toFixed(1)}B → 절감 ${((1 - inSum / hypoSum) * 100).toFixed(1)}% (ticks ${TICKS})`);
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
if (mode === 'reg') reg(seedArg);
else if (mode === 'prop') prop(seedArg);
else if (mode === 'auth') auth(seedArg);
else if (mode === 'hide') hide(seedArg);
else if (mode === 'bytes') bytes(seedArg);
else if (mode === 'all') { reg(seedArg); console.log(''); prop(seedArg); console.log(''); auth(seedArg); console.log(''); hide(seedArg); console.log(''); bytes(seedArg); console.log(''); summary(seedArg); }
else { console.log('mode: reg | prop | auth | hide | bytes | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
