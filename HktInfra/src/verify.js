// HktInfra step-0445 — 헤드리스 검증 (#4 실 net.step 배리어 치환 5: 손실 하 per-client sseq gap-resync)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netlossy`.
//   더한 한 조각: async-net.makeZoneResync — 실 intent 에 per-client sseq 부여, 연속분만 holdback 통과·hole 감지·재전송으로
//   frontier 전진(async-core.makeResyncSite 재사용). 손실+재정렬 아래서도 방출열==totalOrder → simFold 수렴. run() 밖 → reg 0.
//   검증: ⒜ `reg`. ⒝ `netlossy` — 손실→재전송→방출 simFold==canonical·gaps>0·resyncs>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

function interleave(events, nsites, rnd) {
  const q = Array.from({ length: nsites }, () => []);
  for (const e of events) q[e.site].push(e);
  const out = []; let rem = events.length;
  while (rem > 0) { let s = rnd() % nsites; for (let k = 0; k < nsites && q[s].length === 0; k++) s = (s + 1) % nsites; out.push(q[s].shift()); rem--; }
  return out;
}
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// step-0445 #4 배리어 치환 5 — netlossy: 손실+재정렬→gap-resync→방출 simFold 수렴·gaps/resyncs>0.
function netlossy(seeds) {
  console.log('== netlossy (0445·#4 배리어 치환 5): 손실 하 per-client sseq gap-resync — 방출 simFold 수렴·재전송 실동작. ==');
  console.log('seed   | 이벤트 | simFold수렴 | gaps | resyncs | 판정');
  for (const seed of seeds) {
    const C = 4;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: 40 });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    let conv = true, gapsMin = Infinity, resMin = Infinity;
    const K = 6;
    for (let k = 0; k < K; k++) {
      const rnd = NET.mulberry32((seed ^ (0xC000 + k * 151)) >>> 0);
      const site = NET.makeZoneResync(C);
      const dropped = [];
      for (const e of interleave(events, C, rnd)) { if (rnd() % 5 === 0) dropped.push(e); else site.receive(e); }
      for (const e of shuffle(dropped, rnd)) site.resync(e);   // 재전송(임의 순서)
      const delivered = site.finish();
      if (NET.simFold(delivered, seed, s.avatars).digest !== canonical) conv = false;
      gapsMin = Math.min(gapsMin, site.gaps()); resMin = Math.min(resMin, site.resyncs());
    }
    const ok = check(conv && gapsMin > 0 && resMin > 0, `seed ${seed}: conv ${conv}·gaps≥${gapsMin}·resyncs≥${resMin}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(conv ? 'Y' : 'N', 11)} | ${pad(gapsMin, 4)} | ${pad(resMin, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netlossy'] = netlossy;
kit.ORDER.splice(1, 0, 'netlossy');

(async () => { process.exit(await kit.cli(process.argv)); })();
