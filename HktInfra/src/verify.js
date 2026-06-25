// HktInfra step-0254 — 헤드리스 검증 (캐시 negative caching·침투 방어)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cacheneg`.
//   더한 한 조각: CacheStore.cacheNegative{on} — ON 이면 read-through miss 가 소스에도 없을 때 known-absent(negatives)로 기억 → 미존재 키 재조회는 소스 조회 없이 negHit 즉답(침투 방어). set 되면 해제. 미수신/OFF → 0253 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cacheneg`(가설) — ON: 미존재 'x' 2회 get → 1회만 소스 시도·negHits 1·'x'∈negatives. OFF(대조군): 같은 시퀀스 → negHits 0·negatives 빔.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { CacheStore } = NET;
const M = (type, extra) => ({ from: 'gw', tick: 1, payload: { type, ...extra } });

function cacheneg(seeds) {
  console.log('== cacheneg (0254·캐시 #3): negative caching 침투 방어 — ON 이면 소스에도 없는 키 miss 를 known-absent 로 기억 → 미존재 키 재조회는 소스 조회 없이 negHit 즉답. ON: 미존재 x 2회 get → negHits 1·x∈negatives. OFF: 같은 시퀀스 → negHits 0·negatives 빔. set 후엔 known-absent 해제. ==');
  console.log('seed   | ON negHits | ON neg멤버 | set후 해제 | OFF negHits | 판정');
  for (const seed of seeds) {
    const on = new CacheStore({ source: {} });   // 소스 빔(x 미존재)
    on.onMsg(M('cacheNegative', { on: true }));
    on.onMsg(M('cacheGet', { key: 'x' }));   // miss·소스 없음 → negatives 에 x 추가
    on.onMsg(M('cacheGet', { key: 'x' }));   // negative hit(소스 조회 없이)
    const negAfterGet = on.negatives.has('x');
    on.onMsg(M('cacheSet', { key: 'x', value: 'now-here' }));   // set → known-absent 해제
    const clearedAfterSet = !on.negatives.has('x');
    const off = new CacheStore({ source: {} });
    off.onMsg(M('cacheGet', { key: 'x' }));
    off.onMsg(M('cacheGet', { key: 'x' }));
    const ok = check(on.negHits === 1 && negAfterGet && clearedAfterSet && off.negHits === 0 && off.negatives.size === 0,
      `seed ${seed}: negative cache 위반 (ON negHits ${on.negHits}·멤버 ${negAfterGet}·set해제 ${clearedAfterSet}·OFF negHits ${off.negHits})`);
    console.log(`${pad(seed, 6)} | ${pad(on.negHits, 10)} | ${pad(negAfterGet, 10)} | ${pad(clearedAfterSet, 10)} | ${pad(off.negHits, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cacheneg'] = cacheneg;
kit.ORDER.splice(1, 0, 'cacheneg');

(async () => { process.exit(await kit.cli(process.argv)); })();
