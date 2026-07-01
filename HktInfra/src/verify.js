// HktInfra step-0443 — 헤드리스 검증 (#4 실 net.step 배리어 치환 3: 존 수신 메일박스 스트리밍 holdback 재정렬)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netreorder`.
//   더한 한 조각: async-net.makeZoneMailbox — 실 Net intent 를 교차-client 재정렬로 스트림 수신, low-water-mark 안정
//   holdback(async-core 재사용)으로 점진 방출 → close 잔여 flush. 어떤 인터리빙이든 방출열==totalOrder → simFold 수렴.
//   async-net 은 run() 밖 substrate → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `netreorder` — 인터리빙 불변 방출 sig·방출 simFold==canonical·close前 방출>0(점진).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// 교차-client 재정렬 도착: client 별 링크는 FIFO(각 client subseq 순서 보존)·client 끼리 임의 인터리빙.
function interleave(events, nsites, rnd) {
  const q = Array.from({ length: nsites }, () => []);
  for (const e of events) q[e.site].push(e);
  const out = []; let rem = events.length;
  while (rem > 0) { let s = rnd() % nsites; for (let k = 0; k < nsites && q[s].length === 0; k++) s = (s + 1) % nsites; out.push(q[s].shift()); rem--; }
  return out;
}

// step-0443 #4 배리어 치환 3 — netreorder: 스트리밍 holdback 재정렬 → 인터리빙 불변·simFold 수렴·점진 방출.
function netreorder(seeds) {
  console.log('== netreorder (0443·#4 배리어 치환 3): 존 메일박스 스트리밍 holdback — 인터리빙 불변·simFold 수렴·점진. ==');
  console.log('seed   | 이벤트 | 방출sig불변 | simFold수렴 | close前방출 | 판정');
  for (const seed of seeds) {
    const C = 4;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: 40 });
    const canonical = NET.simFold(NET.totalOrder(s.events), seed, s.avatars).digest;
    let sigInv = true, foldConv = true, beforeMin = Infinity;
    const K = 6; let sig0 = null;
    for (let k = 0; k < K; k++) {
      const rnd = NET.mulberry32((seed ^ (0xA000 + k * 137)) >>> 0);
      const mbox = NET.makeZoneMailbox(C);
      for (const e of interleave(s.events, C, rnd)) mbox.receive(e);
      const delivered = mbox.close();
      if (sig0 === null) sig0 = mbox.sig(); else if (mbox.sig() !== sig0) sigInv = false;
      if (NET.simFold(delivered, seed, s.avatars).digest !== canonical) foldConv = false;
      beforeMin = Math.min(beforeMin, mbox.beforeCloseCount());
    }
    const ok = check(sigInv && foldConv && beforeMin > 0, `seed ${seed}: sigInv ${sigInv}·fold ${foldConv}·before ${beforeMin}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(sigInv ? 'Y' : 'N', 11)} | ${pad(foldConv ? 'Y' : 'N', 11)} | ${pad(beforeMin, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netreorder'] = netreorder;
kit.ORDER.splice(1, 0, 'netreorder');

(async () => { process.exit(await kit.cli(process.argv)); })();
