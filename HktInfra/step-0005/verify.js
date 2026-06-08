// HktInfra step-0005 — 헤드리스 검증
// 사용: node step-0005/verify.js <mode> [seed]
//   mode: reg | pred | conv | auth | curve | hide | swap | all
//     reg   — 회귀 0: 예측·뷰지연 노브=0 → 세계 사슬 = 0004 전송 골든(INPUT_DELAY=8)·0001/0003 골든(ID=1).
//             예측 ON 도 세계 사슬 *불변*(예측은 순수 클라 측 — 세계 사슬을 절대 건드리지 않는다).
//     pred  — 결정론 전파(클라 거울): 정확 예측 클라가 권위 뷰를 매 tick 비트 재현(confDesync 0)·오예측 0. 뷰 지연 아래.
//     conv  — 수렴: 뷰 지연 N 아래 확정 레이어 desync 0(권위 수렴) + 예측이 은닉한 뷰 RTT(응답성)가 N 따라 증가.
//     auth  — 권위 보존: 권위=유일 소유·추종자 자기권위 0·클라 자기권위 0(클라는 읽기 모델만, 권위 미주장) + 수렴 0.
//     curve — 가설 핵심: ⒜ 뷰 지연 곡선(은닉 지연·롤백 깊이 ↑, confDesync 0 평탄) ⒝ 정확 vs eager(오예측↑, 확정 수렴 불변).
//     hide  — 은닉 불변(예측 ON·뷰 지연): 클라 접점 누설 0·추종자 비노출·avatar 는 클라 자기 핸들(누설 아님).
//     swap  — 동결 Sim 교체: 클라 프록시가 더미·array 권위 둘 다 재현(confDesync 0)·세계=전송 골든·인프라 무참조.
// 모든 수치는 시드 [42, 7, 1234, 99, 2026] 으로 재현된다. 문서의 수치 = 이 출력.
'use strict';
const {
  run, fnv1a, PUBLIC_ADDRS, SIM_FACTORIES, SIM_CONTRACT_VERSION,
  mulberry32, INFRA_CLASSES, CONCRETE_SIM_NAMES,
} = require('./net-core.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const TICKS = 60;
const INTENTS = 20;
const INPUT_DELAY = 8;        // 권위 입력 지연(0004 동일) — 클라도 공유(정확 예측 모델)
const VIEW_DELAY = 6;         // 뷰 경로(존→클라) 공칭 지연 — 0005 의 한 조각
let FAILED = false;

// 0001/0003 골든 — 회귀 기준선(전송 끔·INPUT_DELAY=1)
const GOLDEN = {
  42:   { hash: 0x053b46c7, chain: 0xf6bf5bb3 },
  7:    { hash: 0xa3d9fc76, chain: 0xb9bd47b9 },
  1234: { hash: 0xb95e74f5, chain: 0x12a3ba6a },
  99:   { hash: 0x61382ec8, chain: 0x05b378fb },
  2026: { hash: 0x6d49a41a, chain: 0x14eb17b1 },
};
// 0004 전송 골든 — INPUT_DELAY=8 스케줄 사슬(전송·뷰지연·예측 무관 불변). 내용 = f(seed, 로그, INPUT_DELAY).
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

// ── reg: 회귀 0 — 예측·뷰지연 노브=0 → 골든 비트 동일. 예측 ON 도 세계 사슬 불변 ──
function reg(seeds) {
  console.log('== reg: 회귀 0 — 예측·뷰지연 노브=0 → 0001/0003(ID=1)·0004 전송 골든(ID=8) 비트 동일 ==');
  console.log('       (예측은 순수 클라 측 — 켜든 끄든 세계 사슬 불변: ON==OFF==골든)');
  console.log('seed   | ID=1 off chain | =골든 | ID=8 off chain | =전송골든 | ID=8 예측ON chain | =OFF | 판정');
  for (const seed of seeds) {
    const g = GOLDEN[seed], tg = TGOLDEN[seed];
    const off1 = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: 1, schedule: true, predict: false });
    const off8 = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, predict: false });
    const on8 = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true });
    const o1 = off1.chain === g.chain && off1.hash === g.hash;
    const o8 = off8.chain === tg.chain && off8.hash === tg.hash;
    const onInv = on8.chain === off8.chain && on8.hash === off8.hash; // 예측이 세계를 안 건드림
    const ok =
      check(o1, `seed ${seed}: ID=1 off ${hex(off1.chain)} != 골든`) === 'OK' &&
      check(o8, `seed ${seed}: ID=8 off ${hex(off8.chain)} != 전송골든`) === 'OK' &&
      check(onInv, `seed ${seed}: 예측 ON 이 세계 사슬 침습 (${hex(on8.chain)} != ${hex(off8.chain)})`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(off1.chain)}     | ${(o1 ? 'OK' : 'FAIL').padEnd(5)} | ${hex(off8.chain)}     | ${(o8 ? 'OK' : 'FAIL').padEnd(9)} | ${hex(on8.chain)}        | ${(onInv ? 'OK' : 'FAIL').padEnd(4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── pred: 결정론 전파 — 정확 예측 클라가 권위 뷰를 매 tick 비트 재현(confDesync 0)·오예측 0 ──
function pred(seeds) {
  console.log(`== pred: 클라 거울 — 정확 예측이 권위 뷰를 매 tick 비트 재현(confDesync 0)·오예측 0 (뷰 지연 ${VIEW_DELAY}) ==`);
  console.log('seed   | 세계=전송골든 | 검증 뷰 수 | confDesync | 오예측 | 확정 최종hash | =권위hash | 판정');
  for (const seed of seeds) {
    const tg = TGOLDEN[seed];
    const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true });
    const worldOk = r.chain === tg.chain && r.hash === tg.hash;
    // 클라 확정 레이어의 마지막 확정 hash == 권위의 그 tick hash (= 결정론 전파 확정)
    const lc = r.client.lastConfirmed;
    const cliFinal = r.proxy.confirmedHashes[lc - 1];
    const authAt = r.zone.hashes[lc - 1];
    const matchFinal = cliFinal === authAt;
    const ok =
      check(worldOk, `seed ${seed}: 세계 ${hex(r.chain)} != 전송골든`) === 'OK' &&
      check(r.viewsValidated > 0, `seed ${seed}: 검증 뷰 0`) === 'OK' &&
      check(r.confDesync === 0, `seed ${seed}: confDesync ${r.confDesync} — 클라 재현 != 권위`) === 'OK' &&
      check(r.mispredict === 0, `seed ${seed}: 정확 모델 오예측 ${r.mispredict}`) === 'OK' &&
      check(matchFinal, `seed ${seed}: 확정 최종 ${hex(cliFinal)} != 권위 ${hex(authAt)}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${(worldOk ? 'OK' : 'FAIL').padEnd(13)} | ${pad(r.viewsValidated, 10)} | ${pad(r.confDesync, 10)} | ${pad(r.mispredict, 6)} | ${hex(cliFinal)}    | ${(matchFinal ? 'OK' : 'FAIL').padEnd(9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── conv: 수렴 — 뷰 지연 N 아래 확정 desync 0 + 예측이 은닉한 뷰 RTT(응답성)가 N 따라 증가 ──
function conv(seeds) {
  console.log('== conv: 뷰 지연 아래 확정 레이어 desync 0(권위 수렴) + 예측이 은닉한 뷰 RTT(응답성) ==');
  console.log(`(예측 없으면 클라 화면은 확정(권위 뷰)만 = RTT 만큼 지연. 예측이 그 RTT 를 은닉. INPUT_DELAY=${INPUT_DELAY})`);
  console.log('seed   | 뷰지연 | confDesync | 오예측 | 은닉 RTT(평균) | 롤백 깊이(최대) | 판정');
  for (const seed of seeds) {
    let allOk = true; const line = [];
    for (const vd of [2, 6]) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: vd, predict: true });
      const ok = r.confDesync === 0 && r.mispredict === 0 && r.avgHidden > vd; // RTT = 기본 2홉 + vd > vd
      if (!ok) { FAILED = true; allOk = false; }
      line.push({ vd, r, ok });
    }
    for (const { vd, r, ok } of line) {
      console.log(`${pad(seed, 6)} | ${pad(vd, 6)} | ${pad(r.confDesync, 10)} | ${pad(r.mispredict, 6)} | ${pad(r.avgHidden.toFixed(2), 14)} | ${pad(r.specWindowMax, 15)} | ${ok ? 'OK' : 'FAIL'}`);
    }
    if (!allOk) check(false, `seed ${seed}: 수렴/은닉 위반`);
  }
}

// ── auth: 권위 보존 — 권위=1·추종자 자기권위 0·클라 자기권위 0(읽기 모델) + 수렴 0 ──
function auth(seeds) {
  console.log(`== auth: 뷰 지연 ${VIEW_DELAY} — 권위 단일 소유(권위=1·추종자=0·클라=0) + 확정 수렴(desync 0) ==`);
  console.log('seed   | 권위 ownViol | 추종자 ownViol | 추종자 claims | 클라 claims | 추종자 desync | 확정 desync | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true });
    const fds = desyncOf(r);
    const ok =
      check(r.zone.ownerViolations === 0, `seed ${seed}: 권위 ownViol ${r.zone.ownerViolations}`) === 'OK' &&
      check(r.follower.ownerViolations === 0, `seed ${seed}: 추종자 ownViol ${r.follower.ownerViolations}`) === 'OK' &&
      check(r.follower.authClaims === 0, `seed ${seed}: 추종자 자기권위 ${r.follower.authClaims}`) === 'OK' &&
      check(r.clientAuthClaims === 0, `seed ${seed}: 클라 자기권위 ${r.clientAuthClaims} (클라는 권위 미주장)`) === 'OK' &&
      check(fds === 0, `seed ${seed}: 추종자 desync ${fds}`) === 'OK' &&
      check(r.confDesync === 0, `seed ${seed}: 클라 확정 desync ${r.confDesync}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(r.zone.ownerViolations, 12)} | ${pad(r.follower.ownerViolations, 14)} | ${pad(r.follower.authClaims, 13)} | ${pad(r.clientAuthClaims, 11)} | ${pad(fds, 13)} | ${pad(r.confDesync, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── curve: 가설 핵심 — ⒜ 뷰 지연 곡선 ⒝ 정확 vs eager(합성 오예측) ──
function curve(seeds) {
  console.log('== curve: 클라 예측/조정 곡선 — 무엇이 자라고 무엇이 불변인가 ==');
  console.log(`(시드 ${seeds.length}종 합산. INPUT_DELAY=${INPUT_DELAY})`);

  console.log('\n  ⒜ 뷰 지연 곡선 (정확 모델): 은닉 RTT·롤백 깊이는 ↑, confDesync·오예측은 0 평탄(수렴 보장)');
  console.log('  뷰지연 | confDesync 합 | 오예측 합 | 은닉 RTT(평균) | 롤백 깊이(최대) | 판정');
  let prevHidden = -1;
  for (const vd of [0, 2, 4, 8, 12]) {
    let cds = 0, mis = 0, hsum = 0, hmaxAll = 0, n = 0;
    for (const seed of seeds) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: vd, predict: true });
      cds += r.confDesync; mis += r.mispredict; hsum += r.avgHidden; n++;
      if (r.specWindowMax > hmaxAll) hmaxAll = r.specWindowMax;
    }
    const avgHidden = hsum / n;
    const monotone = avgHidden > prevHidden;      // 은닉 RTT 가 뷰 지연 따라 단조 증가
    const ok = cds === 0 && mis === 0 && monotone; // 수렴 보장(평탄) + 응답성 이득(증가)
    if (!ok) FAILED = true;
    console.log(`  ${pad(vd, 6)} | ${pad(cds, 13)} | ${pad(mis, 9)} | ${pad(avgHidden.toFixed(2), 14)} | ${pad(hmaxAll, 15)} | ${ok ? 'OK' : 'FAIL'}`);
    prevHidden = avgHidden;
  }

  console.log('\n  ⒝ 정확 vs eager 화면 모델 (뷰 지연 ' + VIEW_DELAY + '): 오예측은 모델 정확도 따라 ↑, 확정 수렴은 *모델 무관* 0');
  console.log('  predictDelay | 모델     | 오예측 합 | 조정(snap) 합 | confDesync 합 | 판정');
  for (const pd of [INPUT_DELAY, INPUT_DELAY - 1, INPUT_DELAY - 4, 0]) {
    let mis = 0, recon = 0, cds = 0, views = 0;
    for (const seed of seeds) {
      const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true, predictDelay: pd });
      mis += r.mispredict; recon += r.reconciliations; cds += r.confDesync; views += r.viewsValidated;
    }
    const accurate = pd === INPUT_DELAY;
    // 정확 모델 = 오예측 0. eager(pd<ID) = 오예측>0. 단 confDesync 는 *항상* 0(안전망).
    const ok = (accurate ? mis === 0 : mis > 0) && cds === 0;
    if (!ok) FAILED = true;
    const tag = accurate ? '정확' : 'eager';
    console.log(`  ${pad(pd, 12)} | ${tag.padEnd(7)} | ${pad(mis, 9)} | ${pad(recon, 13)} | ${pad(cds, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 화면 정확도는 입력지연 모델 일치에 달렸으나(eager=러버밴딩), *확정 레이어는 모델 무관 권위로 수렴*(안전망).');
}

// ── hide: 은닉 불변(예측 ON·뷰 지연) — 클라 접점 누설 0·추종자 비노출·avatar 는 클라 자기 핸들 ──
function hide(seeds) {
  console.log(`== hide: 예측 ON·뷰 지연 ${VIEW_DELAY} — 클라 접점 누설 0 + 추종자 비노출 + 수명주기 완결 ==`);
  console.log('seed   | 클라접점 | 누설 | 추종자노출 | views | applied | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let leaks = 0, followerExposed = 0, badAddr = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      if (peer === 'zone1f') followerExposed++;
      // avatar 핸들(av\d+)은 클라 자기 것 — 누설 아님. 내부 토폴로지(zone/registry/sessionId/S\d+)만 검사.
      const probe = JSON.stringify(Object.assign({}, m.payload, { view: undefined }));
      if (/zone/i.test(probe) || /registry/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe)) leaks++;
    }
    const ok =
      check(leaks === 0, `seed ${seed}: 누설 ${leaks}건`) === 'OK' &&
      check(followerExposed === 0, `seed ${seed}: 추종자 주소 클라 노출 ${followerExposed}건`) === 'OK' &&
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) === 'OK' &&
      check(r.client.views > 0, `seed ${seed}: 뷰 ${r.client.views} — 뷰가 흐르지 않음`) === 'OK' &&
      check(r.zone.applied === INTENTS, `seed ${seed}: applied ${r.zone.applied} != ${INTENTS}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(leaks, 4)} | ${pad(followerExposed, 10)} | ${pad(r.client.views, 5)} | ${pad(r.zone.applied, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── swap: 동결 Sim 교체 — 클라 프록시가 더미·array 권위 둘 다 재현(confDesync 0)·인프라 무참조 ──
function swap(seeds) {
  console.log('== swap: 클라 프록시도 동결 Sim 계약만 안다 — 더미↔array 권위 둘 다 재현(confDesync 0) + 인프라 무참조 ==');
  let infraRefs = 0; const offenders = [];
  for (const [cname, cls] of Object.entries(INFRA_CLASSES)) {
    const src = cls.toString();
    for (const sim of CONCRETE_SIM_NAMES) if (src.includes(sim)) { infraRefs++; offenders.push(`${cname}→${sim}`); }
  }
  check(infraRefs === 0, `인프라가 구체 시뮬 이름 참조 ${infraRefs}건: ${offenders.join(', ')}`);
  console.log(`구조: 인프라 클래스(${Object.keys(INFRA_CLASSES).length}개, ProxySimulator 포함) 구체 시뮬 참조 = ${infraRefs}건 → 교체 = makeSim 단일 seam. ${infraRefs === 0 ? 'OK' : 'FAIL'}`);
  console.log('');
  console.log('seed   | dummy hash | array hash | =전송골든(둘다) | confDesync(d/a) | 오예측(d/a) | 판정');
  for (const seed of seeds) {
    const tg = TGOLDEN[seed];
    const rd = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true, makeSim: SIM_FACTORIES.dummy });
    const ra = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true, makeSim: SIM_FACTORIES.array });
    const swapped = rd.simId !== ra.simId;
    const goldBoth = rd.hash === tg.hash && rd.chain === tg.chain && ra.hash === tg.hash && ra.chain === tg.chain;
    const cd = rd.confDesync, ca = ra.confDesync;
    const md = rd.mispredict, ma = ra.mispredict;
    const ok =
      check(swapped, `seed ${seed}: simId 동일(${rd.simId})`) === 'OK' &&
      check(goldBoth, `seed ${seed}: 전송골든 불일치 (d ${hex(rd.hash)} a ${hex(ra.hash)})`) === 'OK' &&
      check(cd === 0 && ca === 0, `seed ${seed}: confDesync d ${cd} a ${ca}`) === 'OK' &&
      check(md === 0 && ma === 0, `seed ${seed}: 오예측 d ${md} a ${ma}`) === 'OK';
    console.log(`${pad(seed, 6)} | ${hex(rd.hash)} | ${hex(ra.hash)} | ${(goldBoth ? 'OK' : 'FAIL').padEnd(15)} | ${pad(cd + '/' + ca, 15)} | ${pad(md + '/' + ma, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── summary ──────────────────────────────────────────────────────────────
function summary(seeds) {
  console.log('== summary: 클라 예측/조정 — 회귀 0 + 결정론 전파(클라 거울) + 수렴 + 권위 불변 ==');
  for (const seed of seeds) {
    const g = GOLDEN[seed], tg = TGOLDEN[seed];
    const reg0 = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: 1, schedule: true, predict: false });
    const on = run({ seed, ticks: TICKS, replicate: true, transport: null, inputDelay: INPUT_DELAY, schedule: true, viewDelay: VIEW_DELAY, predict: true });
    const regOk = reg0.chain === g.chain && reg0.hash === g.hash;
    const convOk = on.chain === tg.chain && on.confDesync === 0 && on.mispredict === 0 && desyncOf(on) === 0;
    if (!regOk || !convOk) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 회귀0 ${regOk ? 'OK' : 'FAIL'}(${hex(g.chain)}) · 뷰지연 예측 confDesync 0·은닉 RTT ${on.avgHidden.toFixed(1)} ${convOk ? 'OK' : 'FAIL'}(세계 ${hex(tg.chain)} 불변)`);
  }
  console.log(`클라 예측/조정 = net-core/ProxySimulator(공유 결정론 코어) · 뷰 경로 지연 = engine/Net routeFilter(VIEW_DELAY=${VIEW_DELAY}) (ticks ${TICKS})`);
}

// ── CLI ────────────────────────────────────────────────────────────────
const mode = process.argv[2] || 'all';
const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
const MODES = { reg, pred, conv, auth, curve, hide, swap };
if (MODES[mode]) MODES[mode](seedArg);
else if (mode === 'all') {
  reg(seedArg); console.log('');
  pred(seedArg); console.log('');
  conv(seedArg); console.log('');
  auth(seedArg); console.log('');
  curve(seedArg); console.log('');
  hide(seedArg); console.log('');
  swap(seedArg); console.log('');
  summary(seedArg);
} else { console.log('mode: reg | pred | conv | auth | curve | hide | swap | all'); process.exit(2); }

console.log('');
console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
process.exit(FAILED ? 1 : 0);
