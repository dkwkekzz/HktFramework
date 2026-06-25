// HktInfra step-0264 — 헤드리스 검증 (정리 #49 wiring: svc-exchange-core 영속/failover 메서드 믹스인 분리·svc-exchange-persist.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `xchsplit`.
//   더한 한 조각: ExchangeService 의 영속/스냅샷/failover 메서드(_bump·_snapState·_restore·_journal·crash·reconstruct)를 svc-exchange-persist.js 믹스인으로 분리(Object.assign prototype). 정의 위치만 이동·기능 0 → 0263 비트 동일(reg). svc-exchange-core.js 30.7KB→26.1KB(<30KB·#49 마지막 >30KB 박스 해소).
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `xchsplit`(가설) — list/buy 후 crash→reconstruct 가 durable 저널서 projection 비트 동일 복원·보존 불변 유지.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { ExchangeService } = NET;

// step-0264 정리 분할(#49 wiring) 검증 — 거래소 영속/failover 메서드를 svc-exchange-persist 믹스인으로 위임한 뒤,
//   *옮긴 경로*(list/buy → _journal durable → crash 후 reconstruct)가 projection 을 비트 동일 복원하고 보존 불변(conserved)을 지키는지 본다.
//   reg 0 가 비트 동일을 별도 증명. 결정론 ops 라 시드 무관이지만 5/5 관례 유지.
function xchsplit(seeds) {
  console.log('== xchsplit (0264 분할·#49): 거래소 영속/스냅샷/failover 메서드(_journal·crash·reconstruct)를 svc-exchange-persist 믹스인으로 위임 — list/buy 후 crash→reconstruct 가 durable 저널서 projection 복원(보존 불변)·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | pre(L/S) | post(L/S) | conserved | 판정');
  for (const seed of seeds) {
    const ex = new ExchangeService({ persist: true, snapInterval: 2 });
    const send = (op) => ex.onMsg({ from: 'gw', tick: 1, payload: op });
    send({ type: 'exchList', seller: 's1', item: 'sword', price: 10, itemId: 'i1' });
    send({ type: 'exchList', seller: 's2', item: 'shield', price: 5, itemId: 'i2' });
    send({ type: 'exchBuy', id: 1, buyer: 'b1' });
    const preL = ex.listed, preS = ex.sold, preCons = ex.conserved();
    ex.crash();
    ex.reconstruct();
    const ok = check(preCons && ex.conserved() && ex.listed === preL && ex.sold === preS && ex.open() === 1,
      `seed ${seed}: 복구 비정합 (listed ${ex.listed}/${preL}·sold ${ex.sold}/${preS}·open ${ex.open()})`);
    console.log(`${pad(seed, 6)} | ${pad(preL + '/' + preS, 8)} | ${pad(ex.listed + '/' + ex.sold, 9)} | ${pad(String(ex.conserved()), 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['xchsplit'] = xchsplit;
kit.ORDER.splice(1, 0, 'xchsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
