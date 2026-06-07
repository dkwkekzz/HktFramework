// HktInfra step-0001 — 헤드리스 검증
// 사용: node step-0001/verify.js <mode> [seed]   (mode: lifecycle | hide | det | reject | all)
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const { run, fnv1a, PUBLIC_ADDRS } = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const TICKS = 60;
const INTENTS = 20;
let FAILED = false;

function check(cond, label) {
  if (!cond) { FAILED = true; console.log('  FAIL: ' + label); }
  return cond ? 'OK' : 'FAIL';
}
function pad(v, w) { return String(v).padStart(w); }

// ── ① E2E 수명주기 + ④ 권위 보존 (lifecycle) ───────────────────────────
function lifecycle(seeds) {
  console.log('== lifecycle: 인증→티켓→입장→intent/뷰 왕복→퇴장 E2E + 권위 보존 ==');
  console.log('seed   | views | applied | ownViol | session | events                              | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS });
    const ev = r.client.events;
    const sessionState = [...r.registry.sessions.values()].map(s => s.state).join(',') || '-';
    const ok =
      check(ev.includes('auth_ok'), `seed ${seed}: auth_ok 미수신`) === 'OK' &&
      check(ev.includes('connect_ok'), `seed ${seed}: connect_ok 미수신`) === 'OK' &&
      check(ev.includes('disconnect_ok'), `seed ${seed}: disconnect_ok 미수신`) === 'OK' &&
      check(r.client.views >= INTENTS, `seed ${seed}: 뷰 ${r.client.views} < intent ${INTENTS}`) === 'OK' &&
      check(r.zone.applied === INTENTS, `seed ${seed}: 적용 intent ${r.zone.applied} != ${INTENTS}`) === 'OK' &&
      check(r.zone.ownerViolations === 0, `seed ${seed}: 권위 위반 ${r.zone.ownerViolations}`) === 'OK' &&
      check(sessionState === 'closed', `seed ${seed}: 세션 상태 ${sessionState} != closed`) === 'OK';
    const evSummary = ['auth_ok', 'connect_ok', 'disconnect_ok'].filter(e => ev.includes(e)).join('+');
    console.log(`${pad(seed, 6)} | ${pad(r.client.views, 5)} | ${pad(r.zone.applied, 7)} | ${pad(r.zone.ownerViolations, 7)} | ${sessionState.padEnd(7)} | ${evSummary.padEnd(35)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── ② 은닉 (hide): 클라 접점 메시지에 내부 식별자 0 ─────────────────────
const FORBIDDEN = [/zone/i, /registry/i, /sessionId/, /"S\d+"/, /\bav\d+:/ /* 직렬화 뷰 문자열은 허용 — 아래에서 별도 처리 */];
function hide(seeds) {
  console.log('== hide: 클라 수신/발신 메시지의 내부 주소·식별자 누설 검사 ==');
  console.log('seed   | 클라접점 msgs | 누설 | 비공개 주소 접촉 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let leaks = 0;
    let badAddr = 0;
    for (const m of clientMsgs) {
      // 비공개 주소와의 직접 통신(클라가 존/레지스트리를 아는가)
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      // 페이로드 안의 내부 식별자 — 단 view 본문(view 키)은 아바타 공개 정보라 제외하고 검사
      const probe = JSON.stringify(Object.assign({}, m.payload, { view: undefined }));
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe)) leaks++;
    }
    const ok =
      check(leaks === 0, `seed ${seed}: 내부 식별자 누설 ${leaks}건`) === 'OK' &&
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 12)} | ${pad(leaks, 4)} | ${pad(badAddr, 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── ③ 결정론 (det): 같은 시드 2회 → 존 상태 비트 동일 + 해시 사슬 일치 ────
// 비교 대상 직전 step 이 없는 첫 step — 자기 재현이 곧 이후 시리즈의 회귀(reg) 기준선이다.
function det(seeds) {
  console.log('== det: 같은 시드·로그 2회 실행 → 상태 비트 비교 + 해시 사슬 일치 ==');
  console.log('seed   | state 동일 | hash       | chain      | 판정');
  for (const seed of seeds) {
    const r1 = run({ seed, ticks: TICKS });
    const r2 = run({ seed, ticks: TICKS });
    const sameState = r1.state === r2.state;
    const sameChain = r1.chain === r2.chain && r1.hash === r2.hash;
    const ok =
      check(sameState, `seed ${seed}: 상태 불일치`) === 'OK' &&
      check(sameChain, `seed ${seed}: 해시 사슬 불일치`) === 'OK';
    console.log(`${pad(seed, 6)} | ${sameState ? 'bit-equal ' : 'DIFF      '} | 0x${r1.hash.toString(16).padStart(8, '0')} | 0x${r1.chain.toString(16).padStart(8, '0')} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── ⑤ 가설 (reject): 세션 경계가 실재한다 — 무자격 트래픽은 존에 닿지 못한다 ──
function reject(seeds) {
  console.log('== reject: (a) 위조 티켓 (b) 티켓 재사용 (c) 퇴장 후 intent ==');
  console.log('seed   | a:거부/입장0 | b:침입거부/세션1 | c:드롭/chain동일 | 판정');
  for (const seed of seeds) {
    // (a) 위조 티켓 — connect_fail, 존 입장 0
    const ra = run({ seed, ticks: TICKS, scenario: { badTicket: true } });
    const aOk =
      check(ra.client.events.includes('connect_fail'), `seed ${seed} (a): connect_fail 미수신`) === 'OK' &&
      check(ra.zone.enterCount === 0, `seed ${seed} (a): 위조 티켓이 존 입장 ${ra.zone.enterCount}`) === 'OK';
    // (b) 티켓 재사용 — 침입자 connect_fail, 세션·입장은 본 클라 1뿐
    const rb = run({ seed, ticks: TICKS, scenario: { reuseTicket: true } });
    const bOk =
      check(rb.intruder.events.includes('connect_fail'), `seed ${seed} (b): 침입자 미거부`) === 'OK' &&
      check(!rb.intruder.events.includes('connect_ok'), `seed ${seed} (b): 침입자 입장!`) === 'OK' &&
      check(rb.registry.sessions.size === 1, `seed ${seed} (b): 세션 ${rb.registry.sessions.size} != 1`) === 'OK' &&
      check(rb.zone.enterCount === 1, `seed ${seed} (b): 존 입장 ${rb.zone.enterCount} != 1`) === 'OK';
    // (c) 퇴장 후 intent — 게이트웨이 드롭 1, 존 해시 사슬은 기준 실행과 동일(존이 영향 0)
    const rBase = run({ seed, ticks: TICKS });
    const rc = run({ seed, ticks: TICKS, scenario: { postLogoutIntent: true } });
    const cOk =
      check(rc.gateway.dropped === 1, `seed ${seed} (c): 드롭 ${rc.gateway.dropped} != 1`) === 'OK' &&
      check(rc.chain === rBase.chain, `seed ${seed} (c): 퇴장 후 intent 가 존에 영향`) === 'OK';
    console.log(`${pad(seed, 6)} | ${(aOk ? 'OK' : 'FAIL').padEnd(11)} | ${(bOk ? 'OK' : 'FAIL').padEnd(15)} | ${(cOk ? 'OK' : 'FAIL').padEnd(15)} | ${aOk && bOk && cOk ? 'OK' : 'FAIL'}`);
  }
}

// ── 요약 (all): 시드 평균 + 회귀 기준선(골든 해시) ──────────────────────
function summary(seeds) {
  console.log('== summary: 시드 평균 + 이후 step 의 회귀(reg) 기준선이 될 골든 해시 ==');
  let vSum = 0, aSum = 0, mSum = 0;
  const goldens = [];
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS });
    vSum += r.client.views; aSum += r.zone.applied; mSum += r.net.log.length;
    goldens.push(`seed ${pad(seed, 4)}: hash 0x${r.hash.toString(16).padStart(8, '0')}  chain 0x${r.chain.toString(16).padStart(8, '0')}`);
  }
  console.log(`평균(시드 ${seeds.length}개): views ${(vSum / seeds.length).toFixed(1)} · applied ${(aSum / seeds.length).toFixed(1)} · 총 메시지 ${(mSum / seeds.length).toFixed(1)} (ticks ${TICKS}, intents ${INTENTS})`);
  for (const g of goldens) console.log('  ' + g);
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
if (mode === 'lifecycle') lifecycle(seedArg);
else if (mode === 'hide') hide(seedArg);
else if (mode === 'det') det(seedArg);
else if (mode === 'reject') reject(seedArg);
else if (mode === 'all') { lifecycle(seedArg); console.log(''); hide(seedArg); console.log(''); det(seedArg); console.log(''); reject(seedArg); console.log(''); summary(seedArg); }
else { console.log('mode: lifecycle | hide | det | reject | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
