// HktInfra step-0268 — 헤드리스 검증 (정리 #49 인접·선제: svc-mail-core saga 헬퍼 믹스인 분리·svc-mail-saga.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mailsplit`.
//   더한 한 조각: MailService 의 saga 헬퍼(_custody·_resendPending·_readmit: 우편↔가방 escrow custody 레그 + 미해결 give 재전송/상한/포기 + 재admission)를 svc-mail-saga.js 믹스인으로 분리(Object.assign prototype). 정의 위치만 이동·기능 0 → 0267 비트 동일(reg). svc-mail-core.js 25.3KB→19.4KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `mailsplit`(가설) — _custody→pending+escrow, _resendPending→상한 포기, _readmit→재개 가 sagaConsistent 유지.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { MailService } = NET;

// step-0268 정리 분할(#49 인접) 검증 — 우편 saga 헬퍼를 svc-mail-saga 믹스인으로 위임한 뒤,
//   _custody(escrow give 발신)·_resendPending(상한 도달 포기)·_readmit(재admission)가 여전히 sagaConsistent 를 유지하는지 본다(투명 분할).
function mailsplit(seeds) {
  console.log('== mailsplit (0268 분할·#49 인접): 우편 saga 헬퍼(_custody·_resendPending·_readmit)를 svc-mail-saga 믹스인으로 위임 — escrow give→pending, 상한 포기, 재admission 이 sagaConsistent 유지·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | pend | abandon | readmit | saga정합 | 판정');
  for (const seed of seeds) {
    const m = new MailService({ saga: true, invMode: true, inv: 'inv', addr: 'mail', maxRetries: 1 });
    m.net = { send: () => {} };   // 스텁 net(발신 흡수)
    m._custody('item1', 'heroA', 'escrow', { leg: 'send', mailId: 1 });   // leg1: pending 1·gives 1·escrow 진입
    const pendOk = m.pendingGives() === 1 && m.gives === 1 && m.escrowItemIds().includes('item1') && m.sagaConsistent();
    m._resendPending();   // retryCount gid→1·retries 1
    m._resendPending();   // c(1)≥maxRetries(1) → 포기: pendingGive 제거·giveAbandoned 1·abandonedGive 적재
    const abandonOk = m.giveAbandoned === 1 && m.abandonedGive.size === 1 && m.sagaConsistent();
    m._readmit();   // 재admission: abandonedGive→pendingGive·readmitted 1
    const readmitOk = m.readmitted === 1 && m.abandonedGive.size === 0 && m.pendingGive.size === 1 && m.sagaConsistent();
    const ok = check(pendOk && abandonOk && readmitOk, `seed ${seed}: saga 헬퍼 위반 (pend ${m.pendingGives()}·aband ${m.giveAbandoned}·readmit ${m.readmitted})`);
    console.log(`${pad(seed, 6)} | ${pad(String(pendOk), 4)} | ${pad(String(abandonOk), 7)} | ${pad(String(readmitOk), 7)} | ${pad(String(m.sagaConsistent()), 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mailsplit'] = mailsplit;
kit.ORDER.splice(1, 0, 'mailsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
